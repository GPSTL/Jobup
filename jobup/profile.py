# Student profile API (JOB-008): reading and updating the profile, and replacing
# the photo. Contract with the front end: docs/api/profile.md
import io
from datetime import date
from typing import Annotated, Any
from uuid import uuid4

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import UploadedFile
from django.utils.datastructures import MultiValueDict
from PIL import Image, ImageOps
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationError,
    field_validator,
)
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .api import canViewStudent, getStudent
from .models import JobCategory, StudyDegree, User


def canEditStudent(user: User, id: int) -> bool:
    return id == user.pk


# Profil complet (JOB-071) : limites des compétences, stockées séparées par des virgules
# dans Student.skills (256 caractères)
SKILLS_MAX = 20
SKILL_MAX_LENGTH = 40
SKILLS_STORED_MAX_LENGTH = 256
# Expérience professionnelle, en mois (stages et alternances compris) : 50 ans au plus
EXPERIENCE_MAX_MONTHS = 600

Skill = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=SKILL_MAX_LENGTH),
]


class ProfileChanges(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    description: str = Field(default="", max_length=500)
    desired_position: str = Field(default="", max_length=100)
    education: str = Field(default="", max_length=100)
    study_degree: StudyDegree | None = None
    category: JobCategory | None = None
    experience_level: int = Field(default=0, ge=0, le=EXPERIENCE_MAX_MONTHS)
    skills: list[Skill] = Field(default=[], max_length=SKILLS_MAX)
    region: str = Field(default="", max_length=64)
    available_from: date | None = None

    @field_validator("study_degree", "category", "experience_level", mode="before")
    @classmethod
    def notBoolean(cls, value: Any) -> Any:
        # true est un entier pour Python : refusé, comme un texte
        if isinstance(value, bool) or isinstance(value, str):
            raise ValueError("not a number")
        return value

    @field_validator("available_from", mode="before")
    @classmethod
    def isoDate(cls, value: Any) -> Any:
        # Une date « AAAA-MM-JJ » ou null : pas un nombre de secondes
        if value is not None and not isinstance(value, str):
            raise ValueError("not a date")
        return value

    @field_validator("skills")
    @classmethod
    def storableSkills(cls, skills: list[str]) -> list[str]:
        # Une fois chacune, quelle que soit sa casse ; jamais de virgule, le séparateur stocké
        if any("," in skill for skill in skills):
            raise ValueError("comma")
        unique: dict[str, str] = {}
        for skill in skills:
            unique.setdefault(skill.casefold(), skill)
        kept = list(unique.values())
        if len(", ".join(kept)) > SKILLS_STORED_MAX_LENGTH:
            raise ValueError("too long")
        return kept

    def storedValue(self, field: str) -> Any:
        # Valeur à enregistrer dans Student
        value = getattr(self, field)
        if field == "skills":
            return ", ".join(value)
        if field in ("study_degree", "category"):
            return None if value is None else int(value)
        return value


# Champs texte : le message quand ils sont trop longs
TOO_LONG_MESSAGES = {
    "description": "La présentation ne doit pas dépasser 500 caractères.",
    "desired_position": "Le poste recherché ne doit pas dépasser 100 caractères.",
    "education": "La formation ne doit pas dépasser 100 caractères.",
    "region": "La région ne doit pas dépasser 64 caractères.",
}
# Autres champs : le message, quelle que soit l'erreur
FIELD_MESSAGES = {
    "study_degree": "Choisissez un niveau d’études de la liste.",
    "category": "Choisissez un domaine de la liste.",
    "experience_level": f"L’expérience est un nombre de mois, de 0 à {EXPERIENCE_MAX_MONTHS}.",
    "skills": (
        f"Indiquez au plus {SKILLS_MAX} compétences, de {SKILL_MAX_LENGTH} caractères "
        "au plus chacune et sans virgule."
    ),
    "available_from": "Indiquez une date valide.",
}


def profileErrors(e: ValidationError) -> dict[str, str]:
    errors: dict[str, str] = {}
    for error in e.errors():
        field = str(error["loc"][0])
        if field in errors:
            # Une compétence fautive donne une erreur par élément : un seul message
            continue
        if error["type"] == "extra_forbidden":
            errors[field] = "Ce champ ne peut pas être modifié."
        elif field in TOO_LONG_MESSAGES:
            errors[field] = (
                TOO_LONG_MESSAGES[field]
                if error["type"] == "string_too_long"
                else "Ce champ doit être un texte."
            )
        else:
            errors[field] = FIELD_MESSAGES[field]
    return errors


PHOTO_MAX_SIZE = 2 * 1024 * 1024
# Once decoded, each pixel takes up to 4 bytes in memory
PHOTO_MAX_PIXELS = 25_000_000


def photoError(message: str) -> Response:
    return Response({"errors": {"photo": message}}, status=400)


def reencodedPhoto(image: Image.Image) -> tuple[bytes, str]:
    # Saved again from its pixels alone, so without its metadata (EXIF with the
    # GPS position, XMP, comment) except the color profile. The orientation
    # given by the EXIF is applied to the pixels.
    kind, extension = ("PNG", "png") if image.format == "PNG" else ("JPEG", "jpg")
    ImageOps.exif_transpose(image, in_place=True)
    content = io.BytesIO()
    image.save(content, kind, icc_profile=image.info.get("icc_profile"), comment=b"")
    return content.getvalue(), extension


@api_view(["POST"])
def student_photo(request: Request, id: int) -> Response:
    user: User = request.user
    if not canEditStudent(user, id):
        return Response({"error": "Forbidden"}, status=403)

    target = getStudent(id)
    if target is None:
        return Response({"error": "Student not found"}, status=404)

    files = request.FILES
    # Checked for the type checker: DRF does not type FILES
    photo = files.get("photo") if isinstance(files, MultiValueDict) else None
    if not isinstance(photo, UploadedFile):
        return photoError("Aucune photo reçue.")
    # The size is None only for a file created without it, never for an upload
    if photo.size is None or photo.size > PHOTO_MAX_SIZE:
        return photoError("La photo ne doit pas dépasser 2 Mo.")
    try:
        # Format read from the content, whatever the file name. Pillow raises
        # various errors when the file is not a JPG or PNG image.
        with Image.open(photo, formats=["JPEG", "PNG"]) as image:
            # Only the header is read so far: a light file can hold a huge image
            if image.width * image.height > PHOTO_MAX_PIXELS:
                return photoError("La photo ne doit pas dépasser 25 mégapixels.")
            content, extension = reencodedPhoto(image)
    except Exception:  # noqa: BLE001
        return photoError("La photo doit être au format JPG ou PNG.")

    old = target.photo.name
    # A new name for each photo, so that its URL changes too
    target.photo.save(f"{uuid4().hex}.{extension}", ContentFile(content), save=False)
    target.save(update_fields=["photo"])
    if old:
        target.photo.storage.delete(old)
    return Response(target.to_dict())


@api_view(["GET", "PATCH"])
def student(request: Request, id: int) -> Response:
    user: User = request.user
    allowed = (
        canViewStudent(user, id)
        if request.method == "GET"
        else canEditStudent(user, id)
    )
    if not allowed:
        return Response({"error": "Forbidden"}, status=403)

    target = getStudent(id)
    if target is None:
        return Response({"error": "Student not found"}, status=404)

    if request.method == "PATCH":
        if not isinstance(request.data, dict):
            return Response({"error": "Invalid payload"}, status=400)
        try:
            changes = ProfileChanges.model_validate(request.data)
        except ValidationError as e:
            return Response({"errors": profileErrors(e)}, status=400)
        # Only the fields sent are changed
        for field in changes.model_fields_set:
            setattr(target, field, changes.storedValue(field))
        target.save(update_fields=changes.model_fields_set)

    return Response(target.to_dict())
