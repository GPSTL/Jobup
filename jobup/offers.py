from collections.abc import Mapping
from urllib.parse import urlsplit

from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from .models import JobCategory, Offer, Recruiter, Role


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
        "image_url": offer.image_url,
        "requirements": offer.requirements,
        "category": offer.get_category_display(),
        "company": offer.company_display_name or offer.recruiter.company.name,
        "contract_type": offer.contract_type,
        "duration": offer.duration,
        "location": offer.location,
        "start_date": offer.start_date.isoformat() if offer.start_date else None,
        "created_at": offer.created_at.isoformat(),
    }


class OfferCreateSerializer(serializers.ModelSerializer):
    company = serializers.CharField(source="company_display_name", max_length=128, required=False, allow_blank=True)

    class Meta:
        model = Offer
        fields = ["title", "description", "requirements", "category", "image_url",
                  "contract_type", "duration", "start_date", "company", "location"]

    def to_internal_value(self, data):
        if not isinstance(data, Mapping):
            raise serializers.ValidationError({"non_field_errors": ["Un objet JSON est attendu."]})
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({key: ["Ce champ ne peut pas être défini."] for key in unknown})
        return super().to_internal_value(data)

    def validate_image_url(self, value):
        if value and urlsplit(value).scheme not in {"http", "https"}:
            raise serializers.ValidationError("Utilisez une URL HTTP ou HTTPS.")
        return value


@api_view(["GET", "POST"])
@permission_classes([IsRecruiter])
def offer_list(request):
    if request.method == "POST":
        recruiter = get_object_or_404(Recruiter, user=request.user)
        serializer = OfferCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        offer = serializer.save(recruiter=recruiter, is_active=True)
        return Response(serialize_offer(offer), status=201)
    return Response([serialize_offer(offer) for offer in owned_offers(request.user)])


@api_view(["GET"])
@permission_classes([IsRecruiter])
def offer_categories(request):
    return Response([{"value": value, "label": label} for value, label in JobCategory.choices])


@api_view(["GET"])
@permission_classes([IsRecruiter])
def offer_detail(request, id):
    # Return the same 404 for absent, unpublished and other recruiters' offers.
    offer = get_object_or_404(owned_offers(request.user), pk=id)
    return Response(serialize_offer(offer))
