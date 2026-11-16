"""Public, read-only published offers for visitors and students (JOB-068)."""

from rest_framework.decorators import api_view, permission_classes, renderer_classes
from rest_framework.permissions import AllowAny
from rest_framework.renderers import JSONRenderer
from rest_framework.request import Request
from rest_framework.response import Response

from .models import Offer


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
