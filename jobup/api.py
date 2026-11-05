from uuid import uuid4

from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from .models import Role, SignupSerializer, Student, User

# from .models import token_generator


def getStudent(_id: int) -> Student | None:
    return Student.objects.filter(user_id=_id).select_related("user").first()


def canViewStudent(user: User, id: int) -> bool:
    return user.role == Role.ADMIN or id == user.pk


def canEditStudent(user: User, id: int) -> bool:
    return id == user.pk


class Credentials(BaseModel):
    email: str
    password: str


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


@api_view(["POST"])
@permission_classes([AllowAny])
def api_login(request: Request) -> Response:
    try:
        creds = Credentials.model_validate(request.data)
    except ValidationError:
        return Response({"error": "Invalid payload"}, status=400)
    user = authenticate(request._request, username=creds.email, password=creds.password)
    if not isinstance(user, User):
        return Response({"error": "Invalid credentials"}, status=401)
    login(request._request, user)
    return Response(user.to_dict())


@api_view(["POST"])
def api_logout(request: Request) -> Response:
    logout(request._request)
    return Response(status=204)


@api_view(["GET"])
def me(request: Request) -> Response:
    user: User = request.user
    return Response(user.to_dict())


@api_view(["POST"])
def student_photo(request: Request, id: int) -> Response:
    user: User = request.user
    if not canEditStudent(user, id):
        return Response({"error": "Forbidden"}, status=403)

    target = getStudent(id)
    if target is None:
        return Response({"error": "Student not found"}, status=404)

    photo = request.FILES.get("photo")
    if photo is None:
        return Response({"errors": {"photo": "Aucune photo reçue."}}, status=400)
    if photo.size > PHOTO_MAX_SIZE:
        return Response({"errors": {"photo": "La photo ne doit pas dépasser 2 Mo."}}, status=400)
    try:
        # Format read from the content, whatever the file name. Pillow raises
        # various errors when the file is not a JPG or PNG image.
        with Image.open(photo, formats=["JPEG", "PNG"]) as image:
            image.verify()
            extension = "png" if image.format == "PNG" else "jpg"
    except Exception:
        return Response({"errors": {"photo": "La photo doit être au format JPG ou PNG."}}, status=400)

    old = target.photo.name
    # A new name for each photo, so that its URL changes too
    target.photo.save(f"{uuid4().hex}.{extension}", photo, save=False)
    target.save(update_fields=["photo"])
    if old:
        target.photo.storage.delete(old)
    return Response(target.to_dict())


@api_view(["GET", "PATCH"])
def student(request: Request, id: int) -> Response:
    user: User = request.user
    allowed = canViewStudent(user, id) if request.method == "GET" else canEditStudent(user, id)
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


@api_view(["GET"])
@permission_classes([AllowAny])
def csrf(request):
    return Response({"csrfToken": get_token(request._request)})


@api_view(["POST"])
@permission_classes([AllowAny])
def signup(request: Request):
    serializer = SignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({"message": "User successfully registered"}, status=201)


# @api_view(["POST"])
# @permission_classes([AllowAny])
# def confirm_email(request: Request):
#     user = getUser(request.uid)
#     if user is None or not token_generator.check_token(user, request.token):
#         return Response({"error": "Invalid request"}, status=400)
#     user.email_confirmed = True
#     user.is_active = True
#     return Response({"message": "User email successfully confirmed"}, status=201)
