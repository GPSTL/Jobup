from django.contrib.auth import authenticate, login, logout
from pydantic import BaseModel, ValidationError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from .models import User, canViewStudent, getStudent


class Credentials(BaseModel):
    email: str
    password: str


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


@api_view(["GET"])
def student(request: Request, id: int) -> Response:
    user: User = request.user
    if not canViewStudent(user, id):
        return Response({"error": "Forbidden"}, status=403)

    target = getStudent(id)
    if target is None:
        return Response({"error": "Student not found"}, status=404)
    return Response(target.to_dict())
