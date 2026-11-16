# Page entreprise du « Mon espace » recruteur (JOB-066, REC-25) : lecture et modification de
# l'entreprise du recruteur connecté. La route ne prend pas d'identifiant : un recruteur ne peut
# viser que sa propre entreprise. Tous les recruteurs rattachés à l'entreprise peuvent la modifier.
# La page publique reste celle de JOB-021 (jobup/companies.py). Contrat : docs/api/company-page.md
from typing import Any
from uuid import uuid4

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.utils.datastructures import MultiValueDict
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .candidates import isRecruiter
from .companies import withActiveOffers
from .models import Company, JobCategory, User
from .profile import PHOTO_MAX_PIXELS, PHOTO_MAX_SIZE, reencodedPhoto
from .shortlist import ownRecruiter


class CompanyChanges(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    # Nom et secteur obligatoires (REC-25) ; localisation et présentation facultatives
    name: str = Field(min_length=1, max_length=128)
    sector: int
    city: str = Field(default="", max_length=64)
    description: str = Field(default="", max_length=2048)

    @field_validator("sector")
    @classmethod
    def knownSector(cls, value: int) -> int:
        if value not in JobCategory.values:
            raise ValueError("unknown sector")
        return value


MESSAGES = {
    "name": "Le nom de l’entreprise est obligatoire (128 caractères maximum).",
    "sector": "Choisissez un secteur dans la liste.",
    "city": "La localisation ne doit pas dépasser 64 caractères.",
    "description": "La présentation ne doit pas dépasser 2048 caractères.",
}


def changeErrors(e: ValidationError) -> dict[str, str]:
    errors: dict[str, str] = {}
    for error in e.errors():
        field = str(error["loc"][0])
        if error["type"] == "extra_forbidden":
            errors[field] = "Ce champ ne peut pas être modifié."
        else:
            errors[field] = MESSAGES[field]
    return errors


def ownCompany(user: User) -> Company | None:
    recruiter = ownRecruiter(user)
    if recruiter is None or recruiter.company is None:
        return None
    return withActiveOffers(Company.objects.filter(pk=recruiter.company.pk)).first()


def companyPage(company: Company) -> dict[str, Any]:
    # Champs de la page publique, et le nombre d'offres en cours pour l'aperçu côté étudiant
    return {**company.to_dict(), "active_offers": company.active_offers}


def checkedLogo(logo: UploadedFile) -> tuple[bytes, str] | str:
    # Mêmes contrôles que la photo de l'étudiant (JOB-008) : le format est lu dans le contenu,
    # quel que soit le nom du fichier, et l'image est réenregistrée sans ses métadonnées
    if logo.size is None or logo.size > PHOTO_MAX_SIZE:
        return "Le logo ne doit pas dépasser 2 Mo."
    try:
        with Image.open(logo, formats=["JPEG", "PNG"]) as image:
            if image.width * image.height > PHOTO_MAX_PIXELS:
                return "Le logo ne doit pas dépasser 25 mégapixels."
            return reencodedPhoto(image)
    except Exception:  # noqa: BLE001
        return "Le logo doit être au format JPG ou PNG."


@api_view(["GET", "PATCH"])
def recruiter_company(request: Request) -> Response:
    user: User = request.user
    if not isRecruiter(user):
        return Response({"error": "Forbidden"}, status=403)
    company = ownCompany(user)
    if company is None:
        # Compte recruteur sans entreprise : rattacher une entreprise est hors de JOB-066
        return Response({"error": "No company"}, status=404)
    if request.method == "GET":
        return Response(companyPage(company))

    # JSON, ou multipart quand un nouveau logo est envoyé avec les champs
    data = request.data
    if isinstance(data, MultiValueDict):
        fields = {key: data.get(key) for key in data if key != "logo"}
    elif isinstance(data, dict):
        fields = data
    else:
        return Response({"error": "Invalid payload"}, status=400)

    errors: dict[str, str] = {}
    changes: CompanyChanges | None = None
    try:
        changes = CompanyChanges.model_validate(fields)
    except ValidationError as e:
        errors = changeErrors(e)
    if (
        changes is not None
        and Company.objects.filter(name__iexact=changes.name)
        .exclude(pk=company.pk)
        .exists()
    ):
        errors["name"] = "Une autre entreprise porte déjà ce nom."

    files = request.FILES
    logo = files.get("logo") if isinstance(files, MultiValueDict) else None
    newLogo: tuple[bytes, str] | None = None
    if logo is not None:
        checked = checkedLogo(logo) if isinstance(logo, UploadedFile) else None
        if isinstance(checked, tuple):
            newLogo = checked
        else:
            errors["logo"] = checked or "Le logo doit être au format JPG ou PNG."

    # Tout ou rien : au moindre refus, la fiche précédente est conservée
    if errors or changes is None:
        return Response({"errors": errors}, status=400)

    old = company.logo.name
    with transaction.atomic():
        for field, value in changes.model_dump().items():
            setattr(company, field, value)
        if newLogo is not None:
            content, extension = newLogo
            # Un nouveau nom à chaque logo, pour que son URL change aussi
            company.logo.save(
                f"{uuid4().hex}.{extension}", ContentFile(content), save=False
            )
        company.save()
    if newLogo is not None and old:
        company.logo.storage.delete(old)
    return Response(companyPage(company))
