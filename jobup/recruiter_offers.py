"""Recruiter offers, applicants and application decisions (JOB-040, JOB-044)."""

from django.db import transaction
from django.db.models import Count, Q
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .candidates import candidateCard, isRecruiter
from .models import ApplicationStatus, Conversation, JobApplication, Offer


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


class DecisionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(ApplicationStatus.ACCEPTED, ApplicationStatus.REFUSED)
    )
    message = serializers.CharField(required=False, allow_blank=True, max_length=1024)


def applicationDetail(application: JobApplication) -> dict:
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
