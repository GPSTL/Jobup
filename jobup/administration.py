"""Administrator login, account list and student details, separate from Django Admin.

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
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from .api import Credentials
from .models import JobApplication, Role, School, Student, User

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
    "school": ("school",),
    "date_joined": ("date_joined",),
}

# Fields of a row of the table
ROW_FIELDS = (
    "id",
    "first_name",
    "last_name",
    "email",
    "role",
    "school",
    "date_joined",
    "is_active",
    "suspended_at",
)


class UserFilters(BaseModel):
    # Query of GET /api/administration/users; an empty criterion is not applied
    model_config = ConfigDict(str_strip_whitespace=True)

    q: str = Field(default="", max_length=100)
    status: Literal["", "active", "suspended"] = ""
    school: int | None = Field(default=None, ge=1)
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


def studentAccounts() -> QuerySet[User]:
    # Every student account, suspended ones included, with the school of its
    # profile (None without a profile or a school)
    return User.objects.filter(role=Role.STUDENT).annotate(
        school=F("student__school__name")
    )


def matching(accounts: QuerySet[User], query: str) -> QuerySet[User]:
    # Every word must be found in the first name, the last name, the e-mail or
    # the school: "alice paris" finds Alice Martin of Université Paris
    for word in query.split():
        accounts = accounts.filter(
            Q(first_name__icontains=word)
            | Q(last_name__icontains=word)
            | Q(email__icontains=word)
            | Q(student__school__name__icontains=word)
        )
    return accounts


def ordering(sort: str) -> list[OrderBy]:
    descending = sort.startswith("-")
    column = sort.removeprefix("-")
    # Names, e-mails and schools ignore the case; accounts without a school come last
    keys = [
        F(field) if field == "date_joined" else Lower(field) for field in SORTS[column]
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

    accounts = matching(studentAccounts(), filters.q)
    if filters.status:
        accounts = accounts.filter(is_active=filters.status == "active")
    if filters.school is not None:
        accounts = accounts.filter(student__school_id=filters.school)

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


@api_view(["GET"])
def user_filters(request: Request) -> Response:
    # Values of the "École" filter: the schools of at least one student account
    user: User = request.user
    if not isAdmin(user):
        return Response({"error": "Forbidden"}, status=403)
    schools = (
        School.objects.filter(students__user__role=Role.STUDENT)
        .distinct()
        .order_by(Lower("name"), "pk")
        .values("id", "name")
    )
    return Response({"schools": list(schools)})


@api_view(["GET"])
def user_detail(request, id: int):
    if not isAdmin(request.user):
        return Response({"error": "Forbidden"}, status=403)
    user = User.objects.filter(pk=id, role=Role.STUDENT).first()
    if user is None:
        return Response({"error": "Student not found"}, status=404)
    student = Student.objects.select_related("school").filter(user=user).first()
    return Response(
        {
            **user.to_dict(),
            "date_joined": user.date_joined,
            "is_active": user.is_active,
            "suspended_at": user.suspended_at if not user.is_active else None,
            "school": student.school.name if student and student.school else None,
            # No phone field is collected or stored by the current student model.
            "phone": None,
            "applications_sent": JobApplication.objects.filter(
                student=student, submitted_at__isnull=False
            ).count()
            if student
            else 0,
            "cv_url": f"/api/administration/users/{user.pk}/cv"
            if student and student.resume
            else None,
        }
    )


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
