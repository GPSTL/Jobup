import os

from django.contrib.auth import authenticate, login, logout
from django.http import FileResponse
from django.middleware.csrf import get_token
from pydantic import BaseModel, ValidationError
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from .models import (
    FINAL_STATUSES,
    DraftSerializer,
    JobApplication,
    Role,
    SignupSerializer,
    Student,
    User,
)

# from .models import token_generator


def getStudent(_id: int) -> Student | None:
    return Student.objects.filter(user_id=_id).select_related("user").first()


def getOwnStudent(user: User) -> Student | None:
    if user.role != Role.STUDENT:
        return None
    return getStudent(user.pk)


def getApplication(student: Student, id: int) -> JobApplication | None:
    return (
        JobApplication.objects.filter(pk=id, student=student)
        .select_related("student", "offer__recruiter__company")
        .first()
    )


def canViewStudent(user: User, id: int) -> bool:
    return user.role == Role.ADMIN or id == user.pk


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


@api_view(["GET"])
def applications(request: Request) -> Response:
    student = getOwnStudent(request.user)
    if student is None:
        return Response({"error": "Forbidden"}, status=403)

    own = JobApplication.objects.filter(student=student).select_related(
        "offer__recruiter__company"
    )
    in_progress = own.exclude(
        status__in=FINAL_STATUSES
    )  # Front ordering .order_by("-updated_at")
    completed = own.filter(status__in=FINAL_STATUSES)
    return Response(
        {
            "in_progress": [a.to_dict() for a in in_progress],
            "completed": [a.to_dict() for a in completed],
        }
    )


@api_view(["PUT"])
@parser_classes([MultiPartParser, JSONParser])
def application_draft(request: Request) -> Response:
    student = getOwnStudent(request.user)
    if student is None:
        return Response({"error": "Forbidden"}, status=403)

    serializer: DraftSerializer = DraftSerializer(data=request.data)  # type: ignore
    serializer.is_valid(raise_exception=True)
    existing = JobApplication.objects.filter(
        student=student, offer=serializer.validated_data["offer"]
    ).first()
    if existing is not None and not existing.is_draft:
        return Response({"error": "Application already submitted"}, status=409)

    application, created = serializer.save_draft(student)
    return Response(application.to_detail_dict(), status=201 if created else 200)


@api_view(["GET"])
def application(request: Request, id: int) -> Response:
    student = getOwnStudent(request.user)
    if student is None:
        return Response({"error": "Forbidden"}, status=403)

    target = getApplication(student, id)
    if target is None:
        return Response({"error": "Application not found"}, status=404)
    return Response(target.to_detail_dict())


@api_view(["POST"])
def application_submit(request: Request, id: int) -> Response:
    student = getOwnStudent(request.user)
    if student is None:
        return Response({"error": "Forbidden"}, status=403)

    target = getApplication(student, id)
    if target is None:
        return Response({"error": "Application not found"}, status=404)
    if not target.is_draft:
        return Response({"error": "Application already submitted"}, status=409)
    if not target.offer.is_active:
        return Response({"error": "Offer is no longer active"}, status=400)
    if not student.resume:
        return Response({"error": "A resume is required"}, status=400)

    target.submit()
    return Response(target.to_detail_dict())


@api_view(["GET"])
def application_document(request: Request, id: int, kind: str):
    student = getOwnStudent(request.user)
    if student is None:
        return Response({"error": "Forbidden"}, status=403)

    target = getApplication(student, id)
    if target is None:
        return Response({"error": "Application not found"}, status=404)

    files = {"resume": target.sent_resume, "cover_letter": target.cover_letter}
    document = files.get(kind)
    if not document:
        return Response({"error": "Document not found"}, status=404)
    return FileResponse(
        document.open("rb"),
        as_attachment=True,
        filename=os.path.basename(document.name),  # type: ignore
    )


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
