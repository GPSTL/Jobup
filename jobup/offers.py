"""Public, read-only published offers for visitors and students (JOB-068)."""

from rest_framework.decorators import api_view, permission_classes, renderer_classes
from rest_framework.permissions import AllowAny
from rest_framework.renderers import JSONRenderer
from rest_framework.request import Request
from rest_framework.response import Response

from .models import Offer, Role, SavedOffer, Student


def publishedOffers():
    # The existing model uses is_active as its only publication flag.
    return Offer.objects.filter(is_active=True).select_related("recruiter__company")


def publicOffer(offer: Offer) -> dict:
    company = offer.recruiter.company
    return {
        "id": offer.pk,
        "title": offer.title,
        "description": offer.description,
        "requirements": offer.requirements,
        "category": offer.category,
        "created_at": offer.created_at,
        "company": (
            {"id": company.pk, "name": company.name, "city": company.city}
            if company is not None
            else None
        ),
    }


@api_view(["GET"])
@permission_classes([AllowAny])
@renderer_classes([JSONRenderer])
def offers(_: Request) -> Response:
    found = publishedOffers().order_by("-created_at", "-id")
    return Response([publicOffer(offer) for offer in found])


@api_view(["GET"])
@permission_classes([AllowAny])
@renderer_classes([JSONRenderer])
def offer(_: Request, id: int) -> Response:
    found = publishedOffers().filter(pk=id).first()
    if found is None:
        return Response({"error": "Offer not found"}, status=404)
    return Response(publicOffer(found))


def studentFor(request: Request) -> Student | None:
    if request.user.role != Role.STUDENT:
        return None
    return Student.objects.filter(user=request.user).first()


@api_view(["GET", "POST", "DELETE"])
@renderer_classes([JSONRenderer])
def savedOffers(request: Request, id: int | None = None) -> Response:
    student = studentFor(request)
    if student is None:
        return Response({"error": "Forbidden"}, status=403)

    if request.method == "GET":
        entries = (
            SavedOffer.objects.filter(student=student, offer__is_active=True)
            .select_related("offer__recruiter__company")
            .order_by("-created_at", "-pk")
        )
        return Response(
            [
                {**publicOffer(entry.offer), "saved_at": entry.created_at}
                for entry in entries
            ]
        )

    if id is None:
        return Response({"error": "Offer id is required"}, status=400)

    if request.method == "DELETE":
        SavedOffer.objects.filter(student=student, offer_id=id).delete()
        return Response(status=204)

    target = publishedOffers().filter(pk=id).first()
    if target is None:
        return Response({"error": "Offer not found"}, status=404)
    entry, created = SavedOffer.objects.get_or_create(student=student, offer=target)
    return Response(
        {**publicOffer(target), "saved_at": entry.created_at},
        status=201 if created else 200,
    )
