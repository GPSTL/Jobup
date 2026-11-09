"""Read-only offers and their submitted applicants (JOB-040, REC-11)."""

from django.db.models import Count, Q
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .candidates import candidateCard, isRecruiter
from .models import ApplicationStatus, JobApplication, Offer


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
    }


@api_view(["GET"])
def recruiter_offers(request: Request) -> Response:
    if not isRecruiter(request.user):
        return Response({"error": "Forbidden"}, status=403)
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
