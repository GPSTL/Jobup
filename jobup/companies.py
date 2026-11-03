# API de consultation des entreprises (JOB-021) : répertoire et page de présentation.
# Lecture seule et accessible sans connexion, comme la page publique de Job-30.
from typing import Any

from django.db.models import Count, Q
from pydantic import BaseModel, Field, ValidationError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from .models import Company, JobCategory, Offer

# « 1–6 sur 60 » sur la maquette Explorer les entreprises
PAGE_SIZE = 6


class CompanyFilters(BaseModel):
    q: str = ""
    sector: JobCategory | None = None
    city: str = ""
    page: int = Field(default=1, ge=1)


def withActiveOffers(companies):
    # Nombre d'offres en cours, toutes offres des recruteurs de l'entreprise confondues
    return companies.annotate(
        active_offers=Count("recruiters__offers", filter=Q(recruiters__offers__is_active=True))
    )


def companyCard(company: Company) -> dict[str, Any]:
    card = company.to_dict()
    # La carte affiche la présentation (maquette Job-30) ; le site ne sert qu'à la page de l'entreprise
    del card["website"]
    card["active_offers"] = company.active_offers
    return card


def offerSummary(offer: Offer) -> dict[str, Any]:
    return {
        "id": offer.pk,
        "title": offer.title,
        "category": offer.category,
        "created_at": offer.created_at,
    }


@api_view(["GET"])
@permission_classes([AllowAny])
def companies(request: Request) -> Response:
    try:
        # Un filtre vide (ex. « Tous les secteurs ») équivaut à un filtre absent
        params = {key: value for key, value in request.query_params.dict().items() if value.strip()}
        filters = CompanyFilters.model_validate(params)
    except ValidationError:
        return Response({"error": "Invalid filters"}, status=400)

    # Les filtres se combinent ; tri par nom pour une pagination stable
    found = Company.objects.all()
    if filters.q.strip():
        found = found.filter(name__icontains=filters.q.strip())
    if filters.sector is not None:
        found = found.filter(sector=filters.sector)
    if filters.city.strip():
        found = found.filter(city__icontains=filters.city.strip())

    count = found.count()
    start = (filters.page - 1) * PAGE_SIZE
    page = withActiveOffers(found).order_by("name")[start : start + PAGE_SIZE]
    return Response({
        "count": count,
        "page": filters.page,
        "pages": max(1, -(-count // PAGE_SIZE)),
        "results": [companyCard(company) for company in page],
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def company(_: Request, id: int) -> Response:
    target = withActiveOffers(Company.objects.filter(pk=id)).first()
    if target is None:
        return Response({"error": "Company not found"}, status=404)

    offers = Offer.objects.filter(recruiter__company=target, is_active=True).order_by("-created_at")
    return Response({
        **target.to_dict(),
        "active_offers": target.active_offers,
        "offers": [offerSummary(offer) for offer in offers],
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def cities(_: Request) -> Response:
    # Options du menu « Toute la France » : villes renseignées par au moins une entreprise
    found = Company.objects.exclude(city="").values_list("city", flat=True).distinct().order_by("city")
    return Response(list(found))
