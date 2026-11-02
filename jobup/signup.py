"""Student registration contract for JOB-027; profile fields are completed later."""
import re

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_protect
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Role, Student, User

REQUIRED = "Ce champ est obligatoire."
EMAIL_TAKEN = "Cette adresse e-mail est déjà utilisée."
NAME_RE = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '’-][A-Za-zÀ-ÖØ-öø-ÿ]+)*")


@api_view(["GET"])
@permission_classes([AllowAny])
def csrf(request):
    return Response({"csrfToken": get_token(request._request)})


@api_view(["POST"])
@permission_classes([AllowAny])
@csrf_protect
def signup(request):
    if not isinstance(request.data, dict):
        return Response({"error": "Invalid payload"}, status=400)
    values = {}
    errors = {}
    for key in ("prenom", "nom", "email", "password"):
        value = request.data.get(key)
        if not isinstance(value, str):
            errors[key] = REQUIRED
            continue
        values[key] = value if key == "password" else value.strip()
        if not values[key]:
            errors[key] = REQUIRED
    for key, label in (("prenom", "prénom"), ("nom", "nom")):
        if key not in errors:
            if not NAME_RE.fullmatch(values[key]):
                errors[key] = f"Le {label} ne doit contenir que des lettres."
            elif len(values[key]) > 32:
                errors[key] = "32 caractères maximum."
    if "email" not in errors:
        email = values["email"].lower()
        try:
            validate_email(email)
            if len(email) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]{2,}", email):
                raise ValidationError("Invalid email")
        except ValidationError:
            errors["email"] = "Adresse e-mail invalide (ex. : nom@exemple.fr)."
        values["email"] = email
    if "password" not in errors:
        password = values["password"]
        if len(password) < 8 or not re.search(r"[A-Z]", password) or not re.search(r"[0-9]", password):
            errors["password"] = "8 caractères minimum, dont une majuscule et un chiffre."
    if errors:
        return Response({"errors": errors}, status=400)
    if User.objects.filter(email__iexact=values["email"]).exists():
        return Response({"errors": {"email": EMAIL_TAKEN}}, status=409)
    try:
        with transaction.atomic():
            user = User.objects.create_user(
                email=values["email"], password=values["password"],
                first_name=values["prenom"], name=values["nom"], role=Role.STUDENT,
            )
            Student.objects.create(user=user)
    except IntegrityError:
        if User.objects.filter(email__iexact=values["email"]).exists():
            return Response({"errors": {"email": EMAIL_TAKEN}}, status=409)
        raise
    return Response(user.to_dict(), status=201)
