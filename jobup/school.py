# Espace école : rattachement des étudiants, suivi de leurs candidatures, validation et
# signature des contrats, et conversations avec eux. Côté étudiant : choix de son école.
# Contrat avec le front end : docs/api/school.md
from collections import defaultdict
from collections.abc import Iterable
from typing import Any

from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .conversations import candidateSummary, withLastMessage
from .models import (
    ApplicationStatus,
    Contract,
    ContractStage,
    Conversation,
    JobApplication,
    Role,
    School,
    SchoolManager,
    SchoolRequest,
    SchoolRequestStatus,
    Student,
    User,
)
from .notifications import (
    notifyContract,
    notifySchoolRequest,
    notifySchoolRequestDecision,
)

# Avancement d'un étudiant pour l'école, du plus avancé au moins avancé
SEARCHING, APPLYING, ACCEPTED, CONTRACT, SIGNED = (
    "searching",
    "applying",
    "accepted",
    "contract",
    "signed",
)


def getManager(user: User) -> SchoolManager | None:
    if user.role != Role.MANAGER:
        return None
    return SchoolManager.objects.filter(user=user).select_related("school").first()


def schoolOrRefusal(user: User) -> School | Response:
    # L'école de l'employé connecté, ou la réponse à renvoyer : 403 pour un autre rôle,
    # 409 tant que son compte n'est rattaché à aucune école
    manager = getManager(user)
    if manager is None:
        return Response({"error": "Forbidden"}, status=403)
    if manager.school is None:
        return Response({"error": "No school"}, status=409)
    return manager.school


def schoolStudents(school: School):
    return Student.objects.filter(school=school, user__is_active=True).select_related(
        "user"
    )


def person(student: Student) -> dict[str, Any]:
    user = student.user
    return {
        # Id du compte, comme /api/recruiter/candidates/<id>
        "id": user.pk,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "photo_url": student.photo.url if student.photo else None,
    }


def progress(applications: Iterable[JobApplication], contracts: Iterable[Contract]):
    # Étape la plus avancée de l'étudiant : un brouillon n'est pas une candidature envoyée
    stages = {contract.stage for contract in contracts}
    if ContractStage.SIGNED in stages:
        return SIGNED
    if stages:
        return CONTRACT
    statuses = {application.status for application in applications}
    if ApplicationStatus.ACCEPTED in statuses:
        return ACCEPTED
    return APPLYING if statuses else SEARCHING


def sentApplications():
    return JobApplication.objects.filter(submitted_at__isnull=False).exclude(
        status=ApplicationStatus.DRAFT
    )


def studentProgress(
    school: School, students: list[Student]
) -> dict[int, tuple[str, int]]:
    # Pour chaque étudiant : son avancement et son nombre de candidatures envoyées
    applications: dict[int, list[JobApplication]] = defaultdict(list)
    for application in sentApplications().filter(student__in=students):
        applications[application.student_id].append(application)
    contracts: dict[int, list[Contract]] = defaultdict(list)
    for contract in Contract.objects.filter(school=school, student__in=students):
        contracts[contract.student_id].append(contract)
    return {
        student.pk: (
            progress(applications[student.pk], contracts[student.pk]),
            len(applications[student.pk]),
        )
        for student in students
    }


def schoolContract(contract: Contract) -> dict[str, Any]:
    application = contract.application
    return {
        **contract.to_dict(),
        "student": person(contract.student),
        "company": contract.company.name,
        "offer_title": application.offer.title if application else "",
        "application_id": application.pk if application else None,
    }


def schoolContracts(school: School):
    return Contract.objects.filter(school=school).select_related(
        "student__user", "company", "application__offer"
    )


# ----- Compte de l'école ----- #


class SchoolName(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=128)


@api_view(["GET", "POST"])
def school(request: Request) -> Response:
    user: User = request.user
    manager = getManager(user)
    if manager is None:
        return Response({"error": "Forbidden"}, status=403)

    if request.method == "POST":
        # Le compte choisit son établissement une seule fois, en le nommant
        if manager.school is not None:
            return Response({"error": "School already set"}, status=409)
        try:
            body = SchoolName.model_validate(request.data)
        except ValidationError:
            return Response(
                {
                    "errors": {
                        "name": "Indiquez le nom de votre établissement (128 caractères maximum)."
                    }
                },
                status=400,
            )
        with transaction.atomic():
            target, _ = School.objects.get_or_create(name=body.name)
            # Un établissement qui a déjà un compte école n'est pas repris par un autre
            if SchoolManager.objects.filter(school=target).exists():
                return Response(
                    {
                        "errors": {
                            "name": "Cet établissement est déjà rattaché à un compte école."
                        }
                    },
                    status=409,
                )
            manager.school = target
            manager.save(update_fields=["school"])
        return Response({"school": {"id": target.pk, "name": target.name}}, status=201)

    if manager.school is None:
        return Response({"school": None})
    students = list(schoolStudents(manager.school))
    statuses = [
        status for status, _ in studentProgress(manager.school, students).values()
    ]
    return Response(
        {
            "school": {"id": manager.school.pk, "name": manager.school.name},
            "stats": {
                "students": len(students),
                "searching": statuses.count(SEARCHING),
                "signed": statuses.count(SIGNED),
                "pending_requests": SchoolRequest.objects.filter(
                    school=manager.school, status=SchoolRequestStatus.PENDING
                ).count(),
                "contracts_to_validate": Contract.objects.filter(
                    school=manager.school, stage=ContractStage.DEPOSITED
                ).count(),
            },
        }
    )


# ----- Étudiants ----- #


@api_view(["GET"])
def school_students(request: Request) -> Response:
    target = schoolOrRefusal(request.user)
    if isinstance(target, Response):
        return target
    students = list(
        schoolStudents(target).order_by("user__last_name", "user__first_name")
    )
    progresses = studentProgress(target, students)
    return Response(
        [
            {
                **person(student),
                "status": progresses[student.pk][0],
                "application_count": progresses[student.pk][1],
            }
            for student in students
        ]
    )


@api_view(["GET"])
def school_student(request: Request, id: int) -> Response:
    target = schoolOrRefusal(request.user)
    if isinstance(target, Response):
        return target
    # Même réponse pour un étudiant inconnu ou d'une autre école
    student = schoolStudents(target).filter(user_id=id).first()
    if student is None:
        return Response({"error": "Student not found"}, status=404)
    applications = list(
        sentApplications()
        .filter(student=student)
        .select_related("offer__recruiter__company")
        .order_by("-submitted_at", "-pk")
    )
    contracts = list(schoolContracts(target).filter(student=student))
    conversation = Conversation.objects.filter(
        student=student, school_manager__user=request.user
    ).first()
    return Response(
        {
            **person(student),
            "status": progress(applications, contracts),
            "applications": [
                {
                    "id": application.pk,
                    "offer_title": application.offer.title,
                    "company": application.offer.recruiter.company.name,
                    "status": application.status,
                    "submitted_at": application.submitted_at,
                }
                for application in applications
            ],
            "contracts": [schoolContract(contract) for contract in contracts],
            "conversation_id": conversation.pk if conversation else None,
        }
    )


# ----- Demandes de rattachement ----- #


class RequestDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(pattern=r"^(accepted|refused)$")


@api_view(["GET"])
def school_requests(request: Request) -> Response:
    target = schoolOrRefusal(request.user)
    if isinstance(target, Response):
        return target
    requests = SchoolRequest.objects.filter(
        school=target, status=SchoolRequestStatus.PENDING, student__user__is_active=True
    ).select_related("student__user")
    return Response(
        [
            {
                "id": item.pk,
                "student": person(item.student),
                "created_at": item.created_at,
            }
            for item in requests.order_by("created_at", "pk")
        ]
    )


@api_view(["PATCH"])
def school_request(request: Request, id: int) -> Response:
    target = schoolOrRefusal(request.user)
    if isinstance(target, Response):
        return target
    try:
        decision = RequestDecision.model_validate(request.data)
    except ValidationError:
        return Response({"error": "Invalid payload"}, status=400)
    with transaction.atomic():
        item = (
            SchoolRequest.objects.select_for_update()
            .select_related("student")
            .filter(pk=id, school=target)
            .first()
        )
        if item is None:
            return Response({"error": "Request not found"}, status=404)
        if item.status != SchoolRequestStatus.PENDING:
            return Response({"error": "Request already decided"}, status=409)
        accepted = decision.status == "accepted"
        item.status = (
            SchoolRequestStatus.ACCEPTED if accepted else SchoolRequestStatus.REFUSED
        )
        item.save(update_fields=["status"])
        if accepted:
            item.student.school = target
            item.student.save(update_fields=["school"])
        request_id = item.pk
        transaction.on_commit(
            lambda: notifySchoolRequestDecision(request_id), robust=True
        )
    return Response({"id": request_id, "status": decision.status})


# ----- Contrats ----- #


class ContractChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stage: int


@api_view(["GET"])
def school_contracts(request: Request) -> Response:
    target = schoolOrRefusal(request.user)
    if isinstance(target, Response):
        return target
    contracts = schoolContracts(target).order_by("stage", "-deposited_at", "-pk")
    return Response([schoolContract(contract) for contract in contracts])


@api_view(["PATCH"])
def school_contract(request: Request, id: int) -> Response:
    target = schoolOrRefusal(request.user)
    if isinstance(target, Response):
        return target
    try:
        change = ContractChange.model_validate(request.data)
    except ValidationError:
        return Response({"error": "Invalid payload"}, status=400)
    if change.stage not in (ContractStage.VALIDATED, ContractStage.SIGNED):
        return Response({"error": "Invalid stage"}, status=400)
    with transaction.atomic():
        contract = (
            schoolContracts(target)
            .select_for_update(of=("self",))
            .filter(pk=id)
            .first()
        )
        if contract is None:
            return Response({"error": "Contract not found"}, status=404)
        # Une étape après l'autre : ni saut, ni retour en arrière
        if change.stage != contract.stage + 1:
            return Response({"error": "Stage not allowed"}, status=409)
        contract.stage = change.stage
        if change.stage == ContractStage.VALIDATED:
            contract.validated_at = timezone.now()
        else:
            contract.signed_at = timezone.now()
        contract.save(update_fields=["stage", "validated_at", "signed_at"])
        contract_id, stage = contract.pk, contract.stage
        transaction.on_commit(lambda: notifyContract(contract_id, stage), robust=True)
    return Response(schoolContract(contract))


# ----- Conversations avec les étudiants ----- #


@api_view(["GET", "POST"])
def school_conversations(request: Request) -> Response:
    user: User = request.user
    target = schoolOrRefusal(user)
    if isinstance(target, Response):
        return target
    manager = target.managers.get(user=user)

    if request.method == "POST":
        student_id = request.data.get("student_id")
        # bool est un int en Python : refusé explicitement
        if (
            isinstance(student_id, bool)
            or not isinstance(student_id, int)
            or student_id <= 0
        ):
            return Response({"error": "Invalid student_id"}, status=400)
        student = schoolStudents(target).filter(user_id=student_id).first()
        if student is None:
            return Response({"error": "Student not found"}, status=404)
        conversation, created = Conversation.objects.get_or_create(
            student=student, school_manager=manager
        )
        return Response(
            {"id": conversation.pk, "created": created, "student": person(student)},
            status=201 if created else 200,
        )

    conversations = Conversation.objects.filter(school_manager=manager).select_related(
        "student__user"
    )
    return Response(
        [
            candidateSummary(conversation, user)
            for conversation in withLastMessage(conversations)
        ]
    )


# ----- Côté étudiant : choisir son école ----- #


class SchoolChoice(BaseModel):
    model_config = ConfigDict(extra="forbid")

    school_id: int = Field(ge=1)


def getOwnStudent(user: User) -> Student | None:
    if user.role != Role.STUDENT:
        return None
    return Student.objects.filter(user=user).select_related("school").first()


def studentSchoolState(student: Student) -> dict[str, Any]:
    pending = (
        SchoolRequest.objects.filter(student=student).select_related("school").first()
    )
    # Une demande acceptée est devenue Student.school
    shown = (
        pending if pending and pending.status != SchoolRequestStatus.ACCEPTED else None
    )
    return {
        "school": (
            {"id": student.school.pk, "name": student.school.name}
            if student.school
            else None
        ),
        "request": (
            {
                "school": {"id": shown.school.pk, "name": shown.school.name},
                "status": (
                    "pending"
                    if shown.status == SchoolRequestStatus.PENDING
                    else "refused"
                ),
            }
            if shown
            else None
        ),
        # Seules les écoles qui ont un compte peuvent valider une demande
        "schools": (
            []
            if student.school or (shown and shown.status == SchoolRequestStatus.PENDING)
            else [
                {"id": item.pk, "name": item.name}
                for item in School.objects.annotate(managers_count=Count("managers"))
                .filter(managers_count__gt=0)
                .order_by("name")
            ]
        ),
    }


@api_view(["GET"])
def student_school(request: Request) -> Response:
    student = getOwnStudent(request.user)
    if student is None:
        return Response({"error": "Forbidden"}, status=403)
    return Response(studentSchoolState(student))


@api_view(["POST", "DELETE"])
def student_school_request(request: Request) -> Response:
    student = getOwnStudent(request.user)
    if student is None:
        return Response({"error": "Forbidden"}, status=403)
    existing = SchoolRequest.objects.filter(student=student).first()

    if request.method == "DELETE":
        # Seule une demande en attente s'annule
        if existing is None or existing.status != SchoolRequestStatus.PENDING:
            return Response({"error": "No pending request"}, status=404)
        existing.delete()
        return Response(studentSchoolState(student))

    try:
        choice = SchoolChoice.model_validate(request.data)
    except ValidationError:
        return Response({"error": "Invalid payload"}, status=400)
    if student.school is not None or (
        existing is not None and existing.status == SchoolRequestStatus.PENDING
    ):
        return Response({"error": "Already requested"}, status=409)
    chosen = School.objects.filter(pk=choice.school_id, managers__isnull=False).first()
    if chosen is None:
        return Response({"error": "School not found"}, status=404)
    with transaction.atomic():
        # Après un refus, une nouvelle demande remplace l'ancienne
        if existing is not None:
            existing.delete()
        request_id = SchoolRequest.objects.create(student=student, school=chosen).pk
        transaction.on_commit(lambda: notifySchoolRequest(request_id), robust=True)
    return Response(studentSchoolState(student), status=201)
