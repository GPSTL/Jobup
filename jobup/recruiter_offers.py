"""Read-only offers and their submitted applicants (JOB-040, REC-11)."""

from collections.abc import Mapping
from typing import Any
from urllib.parse import urlsplit

from django.db.models import Count, Q
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .candidates import candidateCard, isRecruiter
from .models import ApplicationStatus, JobApplication, Offer, Recruiter


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
def offer_applicants(request: Request, id: int) -> Response:
    if not isRecruiter(request.user):
        return Response({"error": "Forbidden"}, status=403)
    # Same response for missing and foreign offers, even within the same company.
    offer = Offer.objects.filter(pk=id, recruiter__user=request.user).first()
    if offer is None:
        return Response({"error": "Offer not found"}, status=404)
    applications = (
        submittedApplications()
        .filter(offer=offer)
        .select_related("student__user", "student__school")
        .order_by("-submitted_at", "-pk")
    )
    return Response(
        {
            "offer": offerSummary(offer),
            "applications": [
                {
                    "id": application.pk,
                    "candidate": candidateCard(application.student),
                    "status": application.status,
                    "submitted_at": application.submitted_at,
                }
                for application in applications
            ],
        }
    )
