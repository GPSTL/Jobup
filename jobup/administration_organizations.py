"""Companies and schools for the administrators: lists and validation.

A company or a school starts "pending". An administrator validates or refuses it,
and can change their mind at any time, including back to "pending".

Contract with the front end: docs/api/admin-organizations.md
"""

from typing import Any, Literal

from django.core.paginator import EmptyPage, Paginator
from django.db.models import Count, F, Model, Q, QuerySet
from django.db.models.expressions import OrderBy
from django.db.models.functions import Lower
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .administration import PAGE_SIZES, isAdmin
from .models import Company, ReviewStatus, School

# Status names of the API -> value stored
STATUSES: dict[str, ReviewStatus] = {
    "pending": ReviewStatus.PENDING,
    "validated": ReviewStatus.VALIDATED,
    "refused": ReviewStatus.REFUSED,
}
STATUS_NAMES = {value: name for name, value in STATUSES.items()}

# Sortable columns -> the fields compared; the id comes last for a stable order
COMPANY_SORTS: dict[str, tuple[str, ...]] = {
    "name": ("name",),
    "city": ("city", "name"),
    "recruiters": ("recruiter_count", "name"),
    "status": ("status", "name"),
}
SCHOOL_SORTS: dict[str, tuple[str, ...]] = {
    "name": ("name",),
    "students": ("student_count", "name"),
    "managers": ("manager_count", "name"),
    "status": ("status", "name"),
}
COUNT_FIELDS = ("recruiter_count", "student_count", "manager_count")


class OrganizationFilters(BaseModel):
    # Query of GET /api/administration/companies and /schools; an empty criterion is
    # not applied
    model_config = ConfigDict(str_strip_whitespace=True)

    q: str = Field(default="", max_length=100)
    status: Literal["", "pending", "validated", "refused"] = ""
    sort: str = "name"
    page: int = Field(default=1, ge=1)
    page_size: int = PAGE_SIZES[0]

    @field_validator("page_size")
    @classmethod
    def offered_page_size(cls, value: int) -> int:
        if value not in PAGE_SIZES:
            raise ValueError(f"page_size must be one of {PAGE_SIZES}")
        return value


class StatusChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["pending", "validated", "refused"]


def companies() -> QuerySet[Company]:
    return Company.objects.annotate(recruiter_count=Count("recruiters", distinct=True))


def schools() -> QuerySet[School]:
    return School.objects.annotate(
        student_count=Count("students", distinct=True),
        manager_count=Count("managers", distinct=True),
    )


def companyRow(company: Company) -> dict[str, Any]:
    return {
        "id": company.pk,
        "name": company.name,
        "siret": company.siret,
        "city": company.city,
        "website": company.website,
        "status": STATUS_NAMES[ReviewStatus(company.status)],
        "recruiters": company.recruiter_count,  # type: ignore[attr-defined]
    }


def schoolRow(school: School) -> dict[str, Any]:
    return {
        "id": school.pk,
        "name": school.name,
        "status": STATUS_NAMES[ReviewStatus(school.status)],
        "students": school.student_count,  # type: ignore[attr-defined]
        "managers": school.manager_count,  # type: ignore[attr-defined]
    }


def ordering(sorts: dict[str, tuple[str, ...]], sort: str) -> list[OrderBy] | None:
    # None for a column that is not sortable; text ignores the case
    descending = sort.startswith("-")
    column = sort.removeprefix("-")
    if column not in sorts:
        return None
    keys = [
        Lower(field) if field in ("name", "city") else F(field)
        for field in sorts[column]
    ]
    keys.append(F("pk"))
    return [key.desc() if descending else key.asc() for key in keys]


def listing(
    request: Request,
    accounts: QuerySet[Any],
    search_fields: tuple[str, ...],
    sorts: dict[str, tuple[str, ...]],
    row: Any,
) -> Response:
    if not isAdmin(request.user):
        return Response({"error": "Forbidden"}, status=403)
    try:
        params = {
            key: value
            for key, value in request.query_params.dict().items()
            if value.strip()
        }
        filters = OrganizationFilters.model_validate(params)
    except ValidationError:
        return Response({"error": "Invalid filters"}, status=400)
    order = ordering(sorts, filters.sort)
    if order is None:
        return Response({"error": "Invalid filters"}, status=400)

    # Every word must be found in one of the fields
    for word in filters.q.split():
        condition = Q()
        for field in search_fields:
            condition |= Q(**{f"{field}__icontains": word})
        accounts = accounts.filter(condition)
    if filters.status:
        accounts = accounts.filter(status=STATUSES[filters.status])

    paginator = Paginator(accounts.order_by(*order), filters.page_size)
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
            "results": [row(item) for item in page.object_list],
        }
    )


def review(
    request: Request, id: int, accounts: QuerySet[Any], row: Any, model: type[Model]
) -> Response:
    # PATCH {"status": "validated" | "refused" | "pending"}: any status can replace
    # any other, so a choice can be reversed. Answers the updated row
    if not isAdmin(request.user):
        return Response({"error": "Forbidden"}, status=403)
    try:
        change = StatusChange.model_validate(request.data)
    except ValidationError:
        return Response({"error": "Invalid payload"}, status=400)
    # The update runs on the plain table: the counts of `accounts` are for the row
    if not model.objects.filter(pk=id).update(status=STATUSES[change.status]):
        return Response({"error": f"{model.__name__} not found"}, status=404)
    return Response(row(accounts.get(pk=id)))


@api_view(["GET"])
def company_list(request: Request) -> Response:
    return listing(
        request, companies(), ("name", "siret", "city"), COMPANY_SORTS, companyRow
    )


@api_view(["GET"])
def school_list(request: Request) -> Response:
    return listing(request, schools(), ("name",), SCHOOL_SORTS, schoolRow)


@api_view(["PATCH"])
def company_status(request: Request, id: int) -> Response:
    return review(request, id, companies(), companyRow, Company)


@api_view(["PATCH"])
def school_status(request: Request, id: int) -> Response:
    return review(request, id, schools(), schoolRow, School)
