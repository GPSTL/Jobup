"""Recruiter offers, applicants and application decisions (JOB-040, JOB-044)."""

from collections.abc import Mapping
from typing import Any
from urllib.parse import urlsplit

from django.db import transaction
from django.db.models import Count, Q
from pydantic import ValidationError
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .candidates import candidateCard, isRecruiter
from .contracts import ContractUpload, storeContract
from .interviews import (
    PENDING,
    Proposal,
    cancel,
    interviewOf,
    interviewStates,
    propose,
    recruiterInterview,
    upcomingInterviews,
)
from .models import (
    ApplicationStatus,
    Contract,
    ContractStage,
    Conversation,
    JobApplication,
    Offer,
    Recruiter,
)
from .notifications import notifyContract


def submittedApplications():
    # Keep final decisions and closed offers available, but never expose drafts.
    return JobApplication.objects.filter(submitted_at__isnull=False).exclude(
        status=ApplicationStatus.DRAFT
    )


def offerSummary(offer: Offer) -> dict:
    return {
        "id": offer.pk,
        "title": offer.title,
        "description": offer.description,
        "created_at": offer.created_at,
        "is_active": offer.is_active,
        # Image choisie à la création (JOB-065) ; vide : image par défaut de la carte
        "image_url": offer.image_url,
    }


# ----- Création et publication d'une offre (JOB-051, repris par JOB-065, REC-22) -----

# Messages en français : le formulaire « Créer une offre » les affiche sous chaque champ
REQUIRED = {
    "required": "Ce champ est obligatoire.",
    "blank": "Ce champ est obligatoire.",
}


def tooLong(limit: int) -> dict[str, str]:
    return {"max_length": f"{limit} caractères maximum."}


class OfferCreateSerializer(serializers.ModelSerializer):
    # L'entreprise n'est pas un champ : l'offre est toujours rattachée à celle du recruteur
    class Meta:
        model = Offer
        fields = [
            "title",
            "description",
            "requirements",
            "category",
            "image_url",
            "contract_type",
            "duration",
            "start_date",
            "location",
        ]
        extra_kwargs = {
            "title": {"error_messages": {**REQUIRED, **tooLong(128)}},
            "description": {"error_messages": {**REQUIRED, **tooLong(2048)}},
            "requirements": {"error_messages": tooLong(256)},
            "category": {
                "error_messages": {
                    "required": "Choisissez un secteur.",
                    "null": "Choisissez un secteur.",
                    "invalid_choice": "Choisissez un secteur dans la liste.",
                }
            },
            "image_url": {
                "error_messages": {
                    "invalid": "Utilisez une URL HTTP ou HTTPS valide.",
                    **tooLong(200),
                }
            },
            "contract_type": {
                "error_messages": {"invalid_choice": "Choisissez un type de contrat."}
            },
            "duration": {"error_messages": tooLong(64)},
            "start_date": {"error_messages": {"invalid": "Indiquez une date valide."}},
            "location": {"error_messages": tooLong(128)},
        }

    def to_internal_value(self, data: Any) -> Any:
        if not isinstance(data, Mapping):
            raise serializers.ValidationError(
                {"non_field_errors": ["Un objet JSON est attendu."]}
            )
        # Jamais de champ ignoré en silence : ni recruteur, ni entreprise, ni publication
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError(
                {key: ["Ce champ ne peut pas être défini."] for key in unknown}
            )
        return super().to_internal_value(data)

    def validate_image_url(self, value: str) -> str:
        if value and urlsplit(value).scheme not in {"http", "https"}:
            raise serializers.ValidationError("Utilisez une URL HTTP ou HTTPS valide.")
        return value


def publishedOffer(offer: Offer) -> dict[str, Any]:
    # Offre publiée, telle que la lira la page étudiant (contrat partagé avec JOB-068)
    company = offer.recruiter.company
    return {
        "id": offer.pk,
        "title": offer.title,
        "description": offer.description,
        "requirements": offer.requirements,
        "category": offer.category,
        "image_url": offer.image_url,
        "contract_type": offer.contract_type,
        "duration": offer.duration,
        "start_date": offer.start_date,
        "location": offer.location,
        "company": {"id": company.pk, "name": company.name} if company else None,
        "is_active": offer.is_active,
        "created_at": offer.created_at,
    }


def createOffer(request: Request) -> Response:
    recruiter = (
        Recruiter.objects.filter(user=request.user).select_related("company").first()
    )
    if recruiter is None or recruiter.company is None:
        # Une offre est toujours publiée au nom d'une entreprise
        return Response({"error": "No company"}, status=404)
    serializer = OfferCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    offer = serializer.save(recruiter=recruiter, is_active=True)
    return Response(publishedOffer(offer), status=201)


@api_view(["GET", "POST"])
def recruiter_offers(request: Request) -> Response:
    if not isRecruiter(request.user):
        return Response({"error": "Forbidden"}, status=403)
    if request.method == "POST":
        return createOffer(request)
    offers = (
        Offer.objects.filter(recruiter__user=request.user)
        .annotate(
            applicant_count=Count(
                "applications",
                filter=Q(applications__submitted_at__isnull=False)
                & ~Q(applications__status=ApplicationStatus.DRAFT),
            )
        )
        .order_by("-created_at", "-pk")
    )
    return Response(
        [
            {**offerSummary(offer), "applicant_count": offer.applicant_count}
            for offer in offers
        ]
    )


@api_view(["GET"])
def recruiter_offer(request: Request, id: int) -> Response:
    if not isRecruiter(request.user):
        return Response({"error": "Forbidden"}, status=403)
    offer = (
        Offer.objects.select_related("recruiter__company")
        .filter(pk=id, recruiter__user=request.user)
        .first()
    )
    if offer is None:
        return Response({"error": "Offer not found"}, status=404)
    return Response(publishedOffer(offer))


@api_view(["GET"])
def offer_applicants(request: Request, id: int) -> Response:
    if not isRecruiter(request.user):
        return Response({"error": "Forbidden"}, status=403)
    # Same response for missing and foreign offers, even within the same company.
    offer = Offer.objects.filter(pk=id, recruiter__user=request.user).first()
    if offer is None:
        return Response({"error": "Offer not found"}, status=404)
    applications = list(
        submittedApplications()
        .filter(offer=offer)
        .select_related("student__user", "student__school")
        .order_by("-submitted_at", "-pk")
    )
    interviews = interviewStates(applications)
    return Response(
        {
            "offer": offerSummary(offer),
            "applications": [
                {
                    "id": application.pk,
                    "candidate": candidateCard(application.student),
                    "status": application.status,
                    "submitted_at": application.submitted_at,
                    # Entretien proposé, ou confirmé avec son créneau ; None sans entretien
                    "interview": interviews.get(application.pk),
                }
                for application in applications
            ],
        }
    )


class DecisionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(ApplicationStatus.ACCEPTED, ApplicationStatus.REFUSED)
    )
    message = serializers.CharField(required=False, allow_blank=True, max_length=1024)


def applicationDetail(application: JobApplication) -> dict:
    contract = Contract.objects.filter(application=application).first()
    conversation = (
        Conversation.objects.filter(
            student=application.student, recruiter=application.offer.recruiter
        ).first()
        if application.status == ApplicationStatus.ACCEPTED
        else None
    )
    return {
        "id": application.pk,
        "offer": offerSummary(application.offer),
        "candidate": candidateCard(application.student),
        "status": application.status,
        "submitted_at": application.submitted_at,
        "message": application.message,
        "decision_message": application.decision_message,
        "conversation_id": conversation.pk if conversation else None,
        # Contrat déposé pour cette candidature acceptée, suivi ensuite par l'école et l'étudiant
        "contract": contract.to_dict() if contract else None,
        # Entretien proposé au candidat, et les autres entretiens confirmés du recruteur que
        # de nouveaux créneaux ne doivent pas chevaucher
        "interview": recruiterInterview(application),
        "upcoming_interviews": upcomingInterviews(
            application.offer.recruiter_id, application
        ),
    }


@api_view(["GET", "PATCH"])
def recruiter_application(request: Request, id: int) -> Response:
    # The offer's owner, not another recruiter in the same company, may open/decide.
    if not isRecruiter(request.user):
        return Response({"error": "Forbidden"}, status=403)
    with transaction.atomic():
        application = (
            submittedApplications()
            .select_for_update()
            .select_related("offer__recruiter", "student__user", "student__school")
            .filter(pk=id, offer__recruiter__user=request.user)
            .first()
        )
        if application is None:
            return Response({"error": "Application not found"}, status=404)

        if request.method == "GET":
            if application.status == ApplicationStatus.SUBMITTED:
                application.status = ApplicationStatus.IN_REVIEW
                application.save(update_fields=["status", "updated_at"])
        else:
            serializer = DecisionSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            status = serializer.validated_data["status"]
            if application.status in (
                ApplicationStatus.ACCEPTED,
                ApplicationStatus.REFUSED,
            ):
                # An identical retry does not resend any notification.
                if application.status != status:
                    return Response({"error": "Decision already made"}, status=409)
            elif application.status not in (
                ApplicationStatus.READ,
                ApplicationStatus.IN_REVIEW,
            ):
                return Response(
                    {"error": "Application must be opened first"}, status=409
                )
            else:
                application.status = status
                application.decision_message = serializer.validated_data.get(
                    "message", ""
                )
                application.save(
                    update_fields=["status", "decision_message", "updated_at"]
                )
        # Even already-accepted historical applications get the same conversation.
        if application.status == ApplicationStatus.ACCEPTED:
            Conversation.objects.get_or_create(
                student=application.student, recruiter=application.offer.recruiter
            )
        return Response(applicationDetail(application))


@api_view(["POST"])
def application_contract(request: Request, id: int) -> Response:
    # Dépôt du contrat d'une candidature acceptée, par le recruteur propriétaire de l'offre :
    # il arrive dans l'espace de l'école de l'étudiant. Renvoyer la demande ne crée rien de plus.
    if not isRecruiter(request.user):
        return Response({"error": "Forbidden"}, status=403)
    application = (
        submittedApplications()
        .select_related("offer__recruiter__company", "student__user", "student__school")
        .filter(pk=id, offer__recruiter__user=request.user)
        .first()
    )
    if application is None:
        return Response({"error": "Application not found"}, status=404)
    company = application.offer.recruiter.company
    if application.status != ApplicationStatus.ACCEPTED or company is None:
        return Response({"error": "Application not accepted"}, status=409)
    school = application.student.school
    if school is None:
        return Response({"error": "Student has no school"}, status=409)
    # JOB-045 : le PDF et les dates sont obligatoires ; renvoyer un contrat remplace le précédent
    upload = ContractUpload(request)
    if upload.errors:
        return Response({"errors": upload.errors}, status=400)
    stored = storeContract(
        application,
        upload,
        {"school": school, "company": company, "student": application.student},
    )
    if isinstance(stored, Response):
        return stored
    contract, created = stored
    contract_id, version = contract.pk, contract.version
    transaction.on_commit(
        lambda: notifyContract(contract_id, ContractStage.DEPOSITED, version),
        robust=True,
    )
    return Response(applicationDetail(application), status=201 if created else 200)


# Erreurs d'une proposition qui tiennent à l'état de la candidature plutôt qu'aux créneaux
PROPOSAL_CONFLICTS = {"Recruiter busy"}


@api_view(["POST", "DELETE"])
def recruiter_interview(request: Request, id: int) -> Response:
    # Proposer un ou plusieurs créneaux d'entretien (POST, remplace une proposition encore
    # sans réponse) ou annuler l'entretien (DELETE). Seul l'auteur de l'offre y a accès.
    if not isRecruiter(request.user):
        return Response({"error": "Forbidden"}, status=403)
    with transaction.atomic():
        application = (
            submittedApplications()
            .select_for_update()
            .select_related("offer__recruiter", "student__user", "student__school")
            .filter(pk=id, offer__recruiter__user=request.user)
            .first()
        )
        if application is None:
            return Response({"error": "Application not found"}, status=404)
        if request.method == "DELETE":
            if not cancel(application):
                return Response({"error": "Interview not found"}, status=404)
            return Response(applicationDetail(application))
        if application.status not in PENDING:
            return Response({"error": "Application not in review"}, status=409)
        current = interviewOf(application)
        if (
            current is not None
            and current.slots.filter(chosen_at__isnull=False).exists()
        ):
            return Response({"error": "Interview already confirmed"}, status=409)
        try:
            proposal = Proposal.model_validate(request.data)
        except ValidationError:
            return Response({"error": "Invalid payload"}, status=400)
        error = propose(application, proposal)
        if error is not None:
            code, index = error
            return Response(
                {"error": code, "slot": index},
                status=409 if code in PROPOSAL_CONFLICTS else 400,
            )
        return Response(applicationDetail(application), status=201)
