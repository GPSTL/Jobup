from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from .models import Offer, Role


class IsRecruiter(BasePermission):
    message = "Cet espace est réservé aux recruteurs."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == Role.RECRUITER


def owned_offers(user):
    # Ownership stays with the individual recruiter, including within one company.
    return Offer.objects.filter(
        recruiter__user=user, is_active=True
    ).select_related("recruiter__company").order_by("-created_at", "-pk")


def serialize_offer(offer):
    return {
        "id": offer.pk,
        "title": offer.title,
        "description": offer.description,
        "image_url": offer.image_url or "/static/img/recruiter/offer-team.webp",
        "requirements": offer.requirements,
        "category": offer.get_category_display(),
        "company": offer.recruiter.company.name,
        "created_at": offer.created_at.isoformat(),
    }


@api_view(["GET"])
@permission_classes([IsRecruiter])
def offer_list(request):
    return Response([serialize_offer(offer) for offer in owned_offers(request.user)])


@api_view(["GET"])
@permission_classes([IsRecruiter])
def offer_detail(request, id):
    # Return the same 404 for absent, unpublished and other recruiters' offers.
    offer = get_object_or_404(owned_offers(request.user), pk=id)
    return Response(serialize_offer(offer))
