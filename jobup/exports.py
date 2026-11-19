# Exports CSV des données de chaque rôle : candidatures de l'étudiant, étudiants de l'école,
# offres et candidats du recruteur, comptes pour l'administration. Chaque export se filtre
# par la query string, comme la liste à l'écran.
# Contrat avec le front end : docs/api/exports.md
import csv
from collections.abc import Iterable
from datetime import datetime
from typing import Any, Literal, TypeVar

from django.db.models import Count, F, Q
from django.db.models.functions import Coalesce, Lower
from django.http import HttpResponse
from django.utils import timezone
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .administration import isAdmin, matching
from .api import getOwnStudent
from .candidates import isRecruiter
from .models import (
    ApplicationStatus,
    Contract,
    ContractStage,
    JobApplication,
    Offer,
    Role,
    User,
)
from .offers import publishedOffers
from .school import (
    ACCEPTED,
    APPLYING,
    CONTRACT,
    SEARCHING,
    SIGNED,
    schoolOrRefusal,
    schoolStudents,
    sentApplications,
    studentProgress,
)

# Excel en français ouvre un CSV en UTF-8 avec BOM et séparé par des points-virgules
DELIMITER = ";"
MAX_IDS = 500

# Groupes de statuts proposés par les filtres, et leurs libellés comme à l'écran
STATUS_GROUPS = {
    "draft": (ApplicationStatus.DRAFT,),
    "submitted": (ApplicationStatus.SUBMITTED,),
    "review": (ApplicationStatus.READ, ApplicationStatus.IN_REVIEW),
    "accepted": (ApplicationStatus.ACCEPTED,),
    "refused": (ApplicationStatus.REFUSED,),
}
STATUS_LABELS = {
    ApplicationStatus.DRAFT: "Brouillon",
    ApplicationStatus.SUBMITTED: "Postulée",
    ApplicationStatus.READ: "En cours d’étude",
    ApplicationStatus.IN_REVIEW: "En cours d’étude",
    ApplicationStatus.ACCEPTED: "Acceptée",
    ApplicationStatus.REFUSED: "Refusée",
}
CONTRACT_LABELS = {
    ContractStage.DEPOSITED: "Déposé",
    ContractStage.VALIDATED: "Validé par l’école",
    ContractStage.SIGNED: "Signé",
}
PROGRESS_LABELS = {
    SEARCHING: "En recherche",
    APPLYING: "Candidatures en cours",
    ACCEPTED: "Candidature acceptée",
    CONTRACT: "Contrat en cours",
    SIGNED: "Contrat signé",
}
ROLES = {
    "student": Role.STUDENT,
    "school": Role.MANAGER,
    "recruiter": Role.RECRUITER,
    "admin": Role.ADMIN,
}
ROLE_LABELS = {
    Role.STUDENT: "Étudiant",
    Role.MANAGER: "École",
    Role.RECRUITER: "Recruteur",
    Role.ADMIN: "Administrateur",
}

# Libellés des secteurs d'une offre, les mêmes que front/utils/companies.ts
SECTORS = {
    1: "Informatique",
    2: "Data et intelligence artificielle",
    3: "Cybersécurité",
    4: "Business et stratégie",
    5: "Management et administration",
    6: "Gestion de projet et produit",
    7: "Ingénierie",
    8: "Biotechnologies et sciences appliquées",
    9: "Énergie et environnement",
    10: "Marketing et croissance",
    11: "Vente et développement commercial",
    12: "Communication et relations publiques",
    13: "Finance et comptabilité",
    14: "Banque et assurance",
    15: "Juridique et conformité",
    16: "Conseil",
    17: "Design UX/UI et graphisme",
    18: "Médias, journalisme et contenu",
    19: "Arts, culture et divertissement",
    20: "Ressources humaines et recrutement",
    21: "Éducation et formation",
    22: "Social et associatif",
    23: "Santé",
    24: "Pharmacie et recherche",
    25: "Sport et bien-être",
    26: "Logistique et supply chain",
    27: "Immobilier et architecture",
    28: "Hôtellerie, restauration et tourisme",
    29: "Artisanat et construction",
    99: "Autre",
}

Group = Literal["draft", "submitted", "review", "accepted", "refused"]
Model = TypeVar("Model", bound=BaseModel)


class Filters(BaseModel):
    # Une valeur vide (« Tous ») est un filtre absent ; une liste s'écrit « a,b,c »
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    @field_validator("*", mode="before")
    @classmethod
    def splitList(cls, value: Any, info) -> Any:
        annotation = str(cls.model_fields[info.field_name].annotation)
        if isinstance(value, str) and annotation.startswith("list"):
            return [part for part in value.split(",") if part.strip()]
        return value


class StudentApplicationFilters(Filters):
    status: list[Group] = []


class SchoolStudentFilters(Filters):
    status: list[
        Literal["searching", "applying", "accepted", "contract", "signed"]
    ] = []
    q: str = Field(default="", max_length=100)


class RecruiterFilters(Filters):
    # « offers » : une ligne par offre ; « candidates » : une ligne par candidature reçue
    content: Literal["offers", "candidates"] = "offers"
    # Offres choisies, toutes les siennes si aucune
    offer: list[int] = Field(default=[], max_length=MAX_IDS)
    offer_status: Literal["", "active", "closed"] = ""
    # Statuts des candidatures ; les brouillons ne sont jamais exportés
    status: list[Literal["submitted", "review", "accepted", "refused"]] = []


class UserExportFilters(Filters):
    q: str = Field(default="", max_length=100)
    role: Literal["", "student", "school", "recruiter", "admin"] = ""
    status: Literal["", "active", "suspended"] = ""
    school: int | None = Field(default=None, ge=1)
    # Comptes cochés dans la liste
    ids: list[int] = Field(default=[], max_length=MAX_IDS)


def parse(model: type[Model], request: Request) -> Model | None:
    params = {
        key: value
        for key, value in request.query_params.dict().items()
        if value.strip()
    }
    try:
        return model.model_validate(params)
    except ValidationError:
        return None


def cell(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return timezone.localtime(value).strftime("%d/%m/%Y %H:%M")
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@", "\t", "\r"):
        # Texte saisi par un utilisateur : jamais interprété comme une formule du tableur
        return "'" + value
    return value


def csvResponse(name: str, header: list[str], rows: Iterable[list[Any]]):
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = (
        f'attachment; filename="{name}-{timezone.localdate():%Y-%m-%d}.csv"'
    )
    response.write("﻿")
    writer = csv.writer(response, delimiter=DELIMITER)
    writer.writerow(header)
    for row in rows:
        writer.writerow([cell(value) for value in row])
    return response


def statuses(groups: Iterable[str]) -> list[int]:
    return [status for group in groups for status in STATUS_GROUPS[group]]


def degree(value: int | None) -> str:
    return f"Bac + {value}" if value else ""


# ----- Étudiant ----- #


@api_view(["GET"])
def applications_export(request: Request) -> Response | HttpResponse:
    student = getOwnStudent(request.user)
    if student is None:
        return Response({"error": "Forbidden"}, status=403)
    filters = parse(StudentApplicationFilters, request)
    if filters is None:
        return Response({"error": "Invalid filters"}, status=400)

    applications = JobApplication.objects.filter(student=student).select_related(
        "offer__recruiter__company"
    )
    if filters.status:
        applications = applications.filter(status__in=statuses(filters.status))
    contracts = {
        contract.application_id: contract
        for contract in Contract.objects.filter(application__student=student)
    }
    rows = []
    for application in applications.order_by("-updated_at", "-pk"):
        company = application.offer.recruiter.company
        contract = contracts.get(application.pk)
        rows.append(
            [
                application.offer.title,
                company.name if company else "",
                STATUS_LABELS[application.status],
                application.submitted_at,
                application.updated_at,
                CONTRACT_LABELS[contract.stage] if contract else "",
            ]
        )
    return csvResponse(
        "candidatures",
        ["Offre", "Entreprise", "Statut", "Envoyée le", "Mise à jour le", "Contrat"],
        rows,
    )


@api_view(["GET"])
def offer_export(request: Request, id: int) -> Response | HttpResponse:
    # Une offre publiée, avec ce que toute la plateforme en voit : pas de compteurs ni de candidats
    if getOwnStudent(request.user) is None:
        return Response({"error": "Forbidden"}, status=403)
    offer = publishedOffers().filter(pk=id).first()
    if offer is None:
        return Response({"error": "Offer not found"}, status=404)
    company = offer.recruiter.company
    return csvResponse(
        "offre",
        [
            "Offre",
            "Entreprise",
            "Ville",
            "Secteur",
            "Description",
            "Profil recherché",
            "Publiée le",
        ],
        [
            [
                offer.title,
                company.name if company else "",
                company.city if company else "",
                SECTORS.get(offer.category, ""),
                offer.description,
                offer.requirements,
                offer.created_at,
            ]
        ],
    )


# ----- École ----- #


@api_view(["GET"])
def school_students_export(request: Request) -> Response | HttpResponse:
    school = schoolOrRefusal(request.user)
    if isinstance(school, Response):
        return school
    filters = parse(SchoolStudentFilters, request)
    if filters is None:
        return Response({"error": "Invalid filters"}, status=400)

    students = list(
        schoolStudents(school).order_by(
            Lower("user__last_name"), Lower("user__first_name"), "pk"
        )
    )
    for word in filters.q.split():
        students = [
            student
            for student in students
            if word.casefold()
            in f"{student.user.first_name} {student.user.last_name}".casefold()
        ]
    progresses = studentProgress(school, students)
    # Contrat le plus avancé de chaque étudiant
    contracts: dict[int, Contract] = {}
    for contract in Contract.objects.filter(
        school=school, student__in=students
    ).select_related("company"):
        known = contracts.get(contract.student_id)
        if known is None or contract.stage > known.stage:
            contracts[contract.student_id] = contract
    rows = []
    for student in students:
        status, count = progresses[student.pk]
        if filters.status and status not in filters.status:
            continue
        contract = contracts.get(student.pk)
        rows.append(
            [
                student.user.first_name,
                student.user.last_name,
                student.user.email,
                degree(student.study_degree),
                PROGRESS_LABELS[status],
                count,
                contract.company.name if contract else "",
                CONTRACT_LABELS[contract.stage] if contract else "",
            ]
        )
    return csvResponse(
        "etudiants",
        [
            "Prénom",
            "Nom",
            "E-mail",
            "Niveau d’études",
            "Avancement",
            "Candidatures envoyées",
            "Entreprise du contrat",
            "Étape du contrat",
        ],
        rows,
    )


# ----- Recruteur ----- #


@api_view(["GET"])
def recruiter_offers_export(request: Request) -> Response | HttpResponse:
    if not isRecruiter(request.user):
        return Response({"error": "Forbidden"}, status=403)
    filters = parse(RecruiterFilters, request)
    if filters is None:
        return Response({"error": "Invalid filters"}, status=400)

    # Seulement ses propres offres : un identifiant étranger est ignoré
    offers = Offer.objects.filter(recruiter__user=request.user)
    if filters.offer:
        offers = offers.filter(pk__in=filters.offer)
    if filters.offer_status:
        offers = offers.filter(is_active=filters.offer_status == "active")
    offers = offers.order_by("-created_at", "-pk")
    groups = filters.status or ["submitted", "review", "accepted", "refused"]

    if filters.content == "offers":
        # Les candidatures comptées respectent le filtre de statut
        wanted = Q(applications__status__in=statuses(groups)) & Q(
            applications__submitted_at__isnull=False
        )
        counts = {
            "total": Count("applications", filter=wanted),
            **{
                group: Count(
                    "applications",
                    filter=Q(applications__status__in=statuses([group]))
                    & Q(applications__submitted_at__isnull=False),
                )
                for group in ("submitted", "review", "accepted", "refused")
            },
        }
        rows = [
            [
                offer.title,
                "Publiée" if offer.is_active else "Clôturée",
                offer.created_at,
                offer.get_contract_type_display(),
                offer.location,
                offer.total,  # type: ignore[attr-defined]
                offer.submitted,  # type: ignore[attr-defined]
                offer.review,  # type: ignore[attr-defined]
                offer.accepted,  # type: ignore[attr-defined]
                offer.refused,  # type: ignore[attr-defined]
            ]
            for offer in offers.annotate(**counts)
        ]
        return csvResponse(
            "offres",
            [
                "Offre",
                "Statut",
                "Créée le",
                "Type de contrat",
                "Lieu",
                "Candidatures",
                "Postulées",
                "En cours d’étude",
                "Acceptées",
                "Refusées",
            ],
            rows,
        )

    received = (
        sentApplications()
        .filter(offer__in=offers, status__in=statuses(groups))
        .select_related("offer", "student__user", "student__school")
        .order_by("offer__created_at", "offer_id", "-submitted_at", "-pk")
    )
    rows = [
        [
            application.offer.title,
            application.student.user.first_name,
            application.student.user.last_name,
            application.student.school.name if application.student.school else "",
            degree(application.student.study_degree),
            application.student.experience_level,
            application.student.skills,
            application.student.region,
            STATUS_LABELS[application.status],
            application.submitted_at,
        ]
        for application in received
    ]
    return csvResponse(
        "candidats",
        [
            "Offre",
            "Prénom",
            "Nom",
            "École",
            "Niveau d’études",
            "Expérience (mois)",
            "Compétences",
            "Région",
            "Statut",
            "Envoyée le",
        ],
        rows,
    )


# ----- Administration ----- #


@api_view(["GET"])
def users_export(request: Request) -> Response | HttpResponse:
    if not isAdmin(request.user):
        return Response({"error": "Forbidden"}, status=403)
    filters = parse(UserExportFilters, request)
    if filters is None:
        return Response({"error": "Invalid filters"}, status=400)

    accounts = User.objects.annotate(
        school_name=Coalesce(
            F("student__school__name"), F("school_manager__school__name")
        ),
        company_name=F("recruiter__company__name"),
    )
    accounts = matching(accounts, filters.q)
    if filters.role:
        accounts = accounts.filter(role=ROLES[filters.role])
    if filters.status:
        accounts = accounts.filter(is_active=filters.status == "active")
    if filters.school is not None:
        accounts = accounts.filter(student__school_id=filters.school)
    if filters.ids:
        accounts = accounts.filter(pk__in=filters.ids)
    rows = [
        [
            account.pk,
            account.first_name,
            account.last_name,
            account.email,
            ROLE_LABELS[Role(account.role)],
            account.school_name,  # type: ignore[attr-defined]
            account.company_name,  # type: ignore[attr-defined]
            account.date_joined,
            "Actif" if account.is_active else "Suspendu",
            None if account.is_active else account.suspended_at,
        ]
        for account in accounts.order_by(Lower("last_name"), Lower("first_name"), "pk")
    ]
    return csvResponse(
        "utilisateurs",
        [
            "Id",
            "Prénom",
            "Nom",
            "E-mail",
            "Rôle",
            "École",
            "Entreprise",
            "Inscription",
            "Statut",
            "Suspendu le",
        ],
        rows,
    )
