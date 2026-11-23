"""Administrator login, account list and account details, separate from Django Admin.

Contract with the front end: docs/api/admin-users.md
"""

import os
from typing import Any, Literal

from django.contrib.auth import authenticate, login
from django.contrib.auth.views import redirect_to_login
from django.contrib.staticfiles.views import serve
from django.core.paginator import EmptyPage, Paginator
from django.db.models import F, Q, QuerySet
from django.db.models.expressions import OrderBy
from django.db.models.functions import Lower
from django.http import FileResponse
from django.shortcuts import redirect
from django.utils import timezone
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from .api import Credentials
from .models import JobApplication, Recruiter, Role, SchoolManager, Student, User

# Login page of the administration (ADM-13), open to everyone
LOGIN_PAGE = "/administration"

# Rows per page offered by the table; the first one is the default
PAGE_SIZES = (10, 25, 50)

# Sortable columns -> the fields compared, in this order; the id comes last so
# that accounts with the same values keep the same order from one page to the next
SORTS: dict[str, tuple[str, ...]] = {
    "last_name": ("last_name", "first_name"),
    "first_name": ("first_name", "last_name"),
    "email": ("email",),
    "role": ("role",),
    "date_joined": ("date_joined",),
}

# Account types of the "Type de compte" filter -> role
ROLES: dict[str, Role] = {
    "student": Role.STUDENT,
    "manager": Role.MANAGER,
    "recruiter": Role.RECRUITER,
    "admin": Role.ADMIN,
}

# Fields of a row of the table
ROW_FIELDS = (
    "id",
    "first_name",
    "last_name",
    "email",
    "role",
    "date_joined",
    "is_active",
    "suspended_at",
)


class UserFilters(BaseModel):
    # Query of GET /api/administration/users; an empty criterion is not applied
    model_config = ConfigDict(str_strip_whitespace=True)

    q: str = Field(default="", max_length=100)
    status: Literal["", "active", "suspended"] = ""
    role: Literal["", "student", "manager", "recruiter", "admin"] = ""
    # A column of SORTS, preceded by "-" for the descending order
    sort: str = "-date_joined"
    page: int = Field(default=1, ge=1)
    page_size: int = PAGE_SIZES[0]

    @field_validator("sort")
    @classmethod
    def known_sort(cls, value: str) -> str:
        if value.removeprefix("-") not in SORTS:
            raise ValueError(f"sort must be one of {list(SORTS)}, or preceded by -")
        return value

    @field_validator("page_size")
    @classmethod
    def offered_page_size(cls, value: int) -> int:
        if value not in PAGE_SIZES:
            raise ValueError(f"page_size must be one of {PAGE_SIZES}")
        return value


def isAdmin(user: User) -> bool:
    # The role only: a superuser of another role is not an administrator of JobUp
    return user.role == Role.ADMIN


def matching(accounts: QuerySet[User], query: str) -> QuerySet[User]:
    # Every word must be found in the first name, the last name, the e-mail or the
    # school or company of the account: "alice paris" finds Alice Martin of
    # Université Paris
    for word in query.split():
        accounts = accounts.filter(
            Q(first_name__icontains=word)
            | Q(last_name__icontains=word)
            | Q(email__icontains=word)
            | Q(student__school__name__icontains=word)
            | Q(school_manager__school__name__icontains=word)
            | Q(recruiter__company__name__icontains=word)
        )
    return accounts


def ordering(sort: str) -> list[OrderBy]:
    descending = sort.startswith("-")
    column = sort.removeprefix("-")
    # Names and e-mails ignore the case
    keys = [
        F(field) if field in ("date_joined", "role") else Lower(field)
        for field in SORTS[column]
    ]
    keys.append(F("pk"))
    return [
        key.desc(nulls_last=True) if descending else key.asc(nulls_last=True)
        for key in keys
    ]


def accountRow(row: dict[str, Any]) -> dict[str, Any]:
    return {
        **row,
        # A date only for a suspended account
        "suspended_at": None if row["is_active"] else row["suspended_at"],
        "detail_url": f"/administration/users/{row['id']}",
    }


def react_page(request):
    # insecure: the same index.html as the other pages, also served when DEBUG is
    # off (tests). The path is fixed, never taken from the request
    return serve(request, "index.html", insecure=True)


def admin_login_page(request):
    # /administration: the login form of the administrators, for anyone; an
    # administrator already logged in goes on to the list (front end)
    return react_page(request)


def admin_page(request):
    # The other pages of the administration (ADM-13): the admin login for a
    # visitor, then back to this page; the home page for an account of another role
    if not request.user.is_authenticated:
        return redirect_to_login(request.get_full_path(), login_url=LOGIN_PAGE)
    if not isAdmin(request.user):
        return redirect("/")
    return react_page(request)


@api_view(["POST"])
@permission_classes([AllowAny])
def admin_login(request: Request) -> Response:
    # Opens a session for an administrator only (ADM-13). Another account gets
    # the same answer as a wrong password: the form does not reveal its role
    try:
        creds = Credentials.model_validate(request.data)
    except ValidationError:
        return Response({"error": "Invalid payload"}, status=400)
    user = authenticate(request._request, username=creds.email, password=creds.password)
    if not isinstance(user, User) or not isAdmin(user):
        return Response({"error": "Invalid credentials"}, status=401)
    login(request._request, user)
    return Response(user.to_dict())


@api_view(["GET"])
def user_list(request: Request) -> Response:
    user: User = request.user
    if not isAdmin(user):
        return Response({"error": "Forbidden"}, status=403)
    try:
        # An empty criterion (e.g. "Tous les statuts") is an absent one
        params = {
            key: value
            for key, value in request.query_params.dict().items()
            if value.strip()
        }
        filters = UserFilters.model_validate(params)
    except ValidationError:
        return Response({"error": "Invalid filters"}, status=400)

    # Every account, administrators and suspended ones included
    accounts = matching(User.objects.all(), filters.q)
    if filters.status:
        accounts = accounts.filter(is_active=filters.status == "active")
    if filters.role:
        accounts = accounts.filter(role=ROLES[filters.role])

    paginator = Paginator(
        accounts.order_by(*ordering(filters.sort)).values(*ROW_FIELDS),
        filters.page_size,
    )
    try:
        page = paginator.page(filters.page)
    except EmptyPage:
        return Response({"error": "Page not found"}, status=404)
    return Response(
        {
            "count": paginator.count,
            "page": page.number,
            "page_size": filters.page_size,
            "total_pages": paginator.num_pages,
            "results": [accountRow(row) for row in page.object_list],
        }
    )


def organization(user: User) -> tuple[str | None, str | None]:
    # (school, company) of the account: the school of a student or of a school
    # manager, the company of a recruiter; None without a profile or an organization
    if user.role == Role.STUDENT:
        student = Student.objects.select_related("school").filter(user=user).first()
        return (student.school.name if student and student.school else None), None
    if user.role == Role.MANAGER:
        manager = SchoolManager.objects.select_related("school").filter(user=user)
        manager = manager.first()
        return (manager.school.name if manager and manager.school else None), None
    if user.role == Role.RECRUITER:
        recruiter = Recruiter.objects.select_related("company").filter(user=user)
        recruiter = recruiter.first()
        return None, (
            recruiter.company.name if recruiter and recruiter.company else None
        )
    return None, None


def userProfile(user: User) -> dict[str, Any]:
    # Profile of any account for the administrators (ADM-02, JOB-064). The photo, the
    # CV and the applications only exist for a student, and an account without a
    # profile is shown too: no school, company, photo, CV nor application
    student = (
        Student.objects.filter(user=user).first() if user.role == Role.STUDENT else None
    )
    school, company = organization(user)
    return {
        **user.to_dict(),
        "date_joined": user.date_joined,
        "is_active": user.is_active,
        "suspended_at": user.suspended_at if not user.is_active else None,
        "school": school,
        "company": company,
        "photo_url": student.photo.url if student and student.photo else None,
        # Never asked: neither the signup (ETU-01) nor the profile (ETU-02) has a
        # phone number, so the profile says it is not given
        "phone": None,
        # Sent ones only: a draft never reached a recruiter (JOB-033). None for the
        # accounts that cannot apply
        "applications_sent": (
            JobApplication.objects.filter(
                student=student, submitted_at__isnull=False
            ).count()
            if student
            else 0
        )
        if user.role == Role.STUDENT
        else None,
        "cv_url": f"/api/administration/users/{user.pk}/cv"
        if student and student.resume
        else None,
        # An administrator account cannot be suspended
        "can_suspend": user.role != Role.ADMIN,
    }


@api_view(["GET"])
def user_detail(request, id: int):
    if not isAdmin(request.user):
        return Response({"error": "Forbidden"}, status=403)
    user = User.objects.filter(pk=id).first()
    if user is None:
        return Response({"error": "User not found"}, status=404)
    return Response(userProfile(user))


@api_view(["POST", "DELETE"])
def user_suspension(request, id: int):
    # POST suspends an account (ADM-03), DELETE gives it back (ADM-04). A suspended
    # account can no longer log in, and its open sessions end at their next request:
    # Django refuses an inactive user. Calling twice changes nothing more (a second
    # suspension keeps the first date). Answers the updated profile. An administrator
    # account can never be suspended, so that the administration cannot lock itself out
    if not isAdmin(request.user):
        return Response({"error": "Forbidden"}, status=403)
    user = User.objects.filter(pk=id).first()
    if user is None:
        return Response({"error": "User not found"}, status=404)
    if user.role == Role.ADMIN:
        return Response({"error": "An administrator cannot be suspended"}, status=403)
    if request.method == "POST" and user.is_active:
        user.is_active = False
        user.suspended_at = timezone.now()
        user.save(update_fields=["is_active", "suspended_at"])
    elif request.method == "DELETE" and not user.is_active:
        user.is_active = True
        user.suspended_at = None
        user.save(update_fields=["is_active", "suspended_at"])
    return Response(userProfile(user))


@api_view(["GET"])
def user_cv(request, id: int):
    if not isAdmin(request.user):
        return Response({"error": "Forbidden"}, status=403)
    student = Student.objects.filter(user_id=id, user__role=Role.STUDENT).first()
    if student is None or not student.resume:
        return Response({"error": "Resume not found"}, status=404)
    try:
        file = student.resume.open("rb")
    except FileNotFoundError:
        return Response({"error": "Resume not found"}, status=404)
    return FileResponse(
        file, as_attachment=True, filename=os.path.basename(student.resume.name or "")
    )
