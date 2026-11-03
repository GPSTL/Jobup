from collections.abc import Mapping
from urllib.parse import urlsplit

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, BasePermission
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
        "image_url": offer.image_url,
        "requirements": offer.requirements,
        "category": offer.get_category_display(),
        "company": offer.company_display_name or offer.recruiter.company.name,
        "contract_type": offer.contract_type,
        "duration": offer.duration,
        "start_date": offer.start_date.isoformat() if offer.start_date else None,
        "location": offer.location,
        "created_at": offer.created_at.isoformat(),
    }


class OfferPagination(PageNumberPagination):
    page_size = 6


@api_view(["GET"])
@permission_classes([IsRecruiter])
def offer_list(request):
    paginator = OfferPagination()
    page = paginator.paginate_queryset(owned_offers(request.user), request)
    return paginator.get_paginated_response([serialize_offer(offer) for offer in page])


class OfferUpdateSerializer(serializers.ModelSerializer):
    company = serializers.CharField(source="company_display_name", max_length=128, allow_blank=True)

    class Meta:
        model = Offer
        fields = ["title", "description", "image_url", "requirements", "contract_type",
                  "duration", "start_date", "company", "location"]

    def to_internal_value(self, data):
        if not isinstance(data, Mapping):
            raise serializers.ValidationError({"non_field_errors": ["Un objet JSON est attendu."]})
        # Never silently accept ownership, publication or category changes.
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({key: "Ce champ ne peut pas être modifié." for key in unknown})
        return super().to_internal_value(data)

    def validate_image_url(self, value):
        if value and urlsplit(value).scheme not in {"http", "https"}:
            raise serializers.ValidationError("Utilisez une URL HTTP ou HTTPS.")
        return value


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsRecruiter])
def offer_detail(request, id):
    # Return the same 404 for absent, unpublished and other recruiters' offers.
    with transaction.atomic():
        queryset = owned_offers(request.user)
        if request.method != "GET":
            queryset = queryset.select_for_update()
        offer = get_object_or_404(queryset, pk=id)
        if request.method == "DELETE":
            # Withdraw from all consultations while retaining existing applications.
            offer.is_active = False
            offer.save(update_fields=["is_active"])
            return Response(status=204)
        if request.method == "PATCH":
            serializer = OfferUpdateSerializer(offer, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
        return Response(serialize_offer(offer))


@api_view(["GET"])
@permission_classes([AllowAny])
def public_offer_list(request):
    queryset = Offer.objects.filter(is_active=True).select_related("recruiter__company").order_by("-created_at", "-pk")
    # The public search page shares the same active-offer source as student reads.
    if query := request.query_params.get("q", "").strip():
        queryset = queryset.filter(Q(title__icontains=query) | Q(requirements__icontains=query)
                                   | Q(company_display_name__icontains=query) | Q(recruiter__company__name__icontains=query))
    if location := request.query_params.get("location", "").strip():
        queryset = queryset.filter(location__icontains=location)
    if category := request.query_params.get("category", "").strip():
        if not category.isdigit():
            return Response({"category": ["Secteur invalide."]}, status=400)
        queryset = queryset.filter(category=int(category))
    paginator = OfferPagination()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response([serialize_offer(offer) for offer in page])


@api_view(["GET"])
@permission_classes([AllowAny])
def public_offer_detail(request, id):
    offer = get_object_or_404(Offer.objects.select_related("recruiter__company"), pk=id, is_active=True)
    return Response(serialize_offer(offer))
