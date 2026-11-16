# Student profile API (JOB-008): reading and updating the profile, and replacing
# the photo. Contract with the front end: docs/api/profile.md
import io
from uuid import uuid4

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import UploadedFile
from django.utils.datastructures import MultiValueDict
from PIL import Image, ImageOps
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .api import canViewStudent, getStudent
from .models import User


def canEditStudent(user: User, id: int) -> bool:
    return id == user.pk


class ProfileChanges(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    description: str = Field(default="", max_length=500)
    desired_position: str = Field(default="", max_length=100)


TOO_LONG_MESSAGES = {
    "description": "La présentation ne doit pas dépasser 500 caractères.",
    "desired_position": "Le poste recherché ne doit pas dépasser 100 caractères.",
}


def profileErrors(e: ValidationError) -> dict[str, str]:
    errors: dict[str, str] = {}
    for error in e.errors():
        field = str(error["loc"][0])
        if error["type"] == "extra_forbidden":
            errors[field] = "Ce champ ne peut pas être modifié."
        elif error["type"] == "string_too_long":
            errors[field] = TOO_LONG_MESSAGES[field]
        else:  # string_type
            errors[field] = "Ce champ doit être un texte."
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
            setattr(target, field, getattr(changes, field))
        target.save(update_fields=changes.model_fields_set)

    return Response(target.to_dict())
