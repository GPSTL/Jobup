# Candidate cards and profiles for recruiters (JOB-035, REC-01): the list of
# the cards, the full profile with the exchange history, and the CV download.
# The filters of the cards and their lists of values (JOB-036, REC-02).
# Contract with the front end: docs/api/candidates.md
import os
from collections.abc import Iterable
from typing import Any, Literal

from django.db.models import QuerySet
from django.http import FileResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .conversations import normalize
from .models import JobApplication, Role, Student, User

# Levels of the "Expérience" list, in months of Student.experience_level:
# value sent by the front end -> (label, first month, last month or None)
EXPERIENCE_LEVELS: dict[str, tuple[str, int, int | None]] = {
    "beginner": ("Débutant (moins de 6 mois)", 0, 5),
    "junior": ("Junior (6 mois à 2 ans)", 6, 23),
    "confirmed": ("Confirmé (2 ans et plus)", 24, None),
}

# What a recruiter or a student may write for remote work, in the region field
REMOTE = {"remote", "full remote", "teletravail", "a distance", "distanciel"}


def isRecruiter(user: User) -> bool:
    return user.role == Role.RECRUITER


def visibleStudents() -> QuerySet[Student]:
    # Every recruiter sees every active student, with or without a photo, a
    # school or a CV. The filters (JOB-036) and the candidates already kept or
    # dismissed (JOB-037, JOB-038) narrow this list down: see candidate_list().
    return (
        Student.objects.filter(user__is_active=True, user__role=Role.STUDENT)
        .select_related("user", "school")
        .order_by("-user__date_joined", "-pk")
    )


def getCandidate(id: int) -> Student | None:
    return visibleStudents().filter(user_id=id).first()


def candidateCard(student: Student) -> dict[str, Any]:
    user = student.user
    return {
        # Account id, as in /api/student/<id>
        "id": user.pk,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "photo_url": student.photo.url if student.photo else None,
        # Not stored: no screen asks the student for their program yet
        "education": None,
        "school": student.school.name if student.school else None,
        "description": student.description,
        # Never the URL of the file itself: the download checks the rights
        "cv_url": f"/api/recruiter/candidates/{user.pk}/cv" if student.resume else None,
    }


def exchanges(student: Student, recruiter: User) -> list[dict[str, Any]]:
    # Applications sent to the offers of this recruiter, never to those of
    # other recruiters, even in the same company. A draft has no submitted_at:
    # the recruiter never received it.
    # TODO JOB-039: add the messages of their conversation (models of JOB-032).
    applications = (
        JobApplication.objects.filter(
            student=student,
            offer__recruiter__user=recruiter,
            submitted_at__isnull=False,
        )
        .select_related("offer")
        .order_by("submitted_at", "pk")
    )
    return [
        {
            "kind": "application",
            "id": application.pk,
            "date": application.submitted_at,
            "offer_title": application.offer.title,
        }
        for application in applications
    ]


def skillsOf(student: Student) -> list[str]:
    # Stored comma separated
    return [skill.strip() for skill in student.skills.split(",") if skill.strip()]


def candidateProfile(student: Student, recruiter: User) -> dict[str, Any]:
    return {
        **candidateCard(student),
        "region": student.region,
        "study_degree": student.study_degree,
        "available_from": student.available_from,
        "skills": skillsOf(student),
        # Not stored: Student only has experience_level, in months
        "experiences": [],
        "exchanges": exchanges(student, recruiter),
    }


def recruiterDeck(recruiter: User) -> QuerySet[Student]:
    # Les candidats déjà retenus (JOB-037) ou écartés (JOB-038) par ce recruteur quittent la pile
    # de cartes ; seuls les siens comptent. Le profil des retenus reste accessible depuis « Candidats retenus »
    return (
        visibleStudents()
        .exclude(shortlisted_by__recruiter__user=recruiter)
        .exclude(excluded_by__recruiter__user=recruiter)
    )


class CandidateFilters(BaseModel):
    # Query of GET /api/recruiter/candidates; an empty criterion is not applied
    model_config = ConfigDict(str_strip_whitespace=True)

    position: str = Field(default="", max_length=100)
    experience: Literal["", "beginner", "junior", "confirmed"] = ""
    skill: str = Field(default="", max_length=64)
    region: str = Field(default="", max_length=64)


def comparable(text: str) -> str:
    # Neither case, accents nor hyphens count: "Île-de-France" is "ile de france"
    return " ".join(normalize(text).replace("-", " ").replace("'", " ").split())


def matchesRegion(region: str, wanted: str) -> bool:
    # "remote" (or "télétravail"…) finds the students who wrote one of these words;
    # anything else is looked for in the region of the student: "paris" finds "Paris 15e"
    if comparable(wanted) in REMOTE:
        return comparable(region) in REMOTE
    return comparable(wanted) in comparable(region)


def matches(student: Student, filters: CandidateFilters) -> bool:
    # Every criterion that is filled in must hold
    if filters.position and comparable(student.desired_position) != comparable(
        filters.position
    ):
        return False
    if filters.experience:
        _, first, last = EXPERIENCE_LEVELS[filters.experience]
        months = student.experience_level
        if months < first or (last is not None and months > last):
            return False
    if filters.skill and comparable(filters.skill) not in {
        comparable(skill) for skill in skillsOf(student)
    }:
        return False
    return not filters.region or matchesRegion(student.region, filters.region)


def distinct(values: Iterable[str]) -> list[str]:
    # One spelling per value, whatever its case or accents, in alphabetical order.
    # min() keeps the same spelling whatever the order of the cards ("Data analyst"
    # rather than "data ANALYST")
    found: dict[str, str] = {}
    for value in values:
        value = value.strip()
        if value:
            key = comparable(value)
            found[key] = min(found.get(key, value), value)
    return [found[key] for key in sorted(found)]


@api_view(["GET"])
def candidate_list(request: Request) -> Response:
    user: User = request.user
    if not isRecruiter(user):
        return Response({"error": "Forbidden"}, status=403)
    try:
        filters = CandidateFilters.model_validate(request.query_params.dict())
    except ValidationError:
        return Response({"error": "Invalid filters"}, status=400)
    return Response(
        [
            candidateCard(student)
            for student in recruiterDeck(user)
            if matches(student, filters)
        ]
    )


@api_view(["GET"])
def candidate_filters(request: Request) -> Response:
    # Values offered by the lists of the form: the positions and the skills come from
    # the cards of this recruiter, so that every value finds at least one candidate
    user: User = request.user
    if not isRecruiter(user):
        return Response({"error": "Forbidden"}, status=403)
    deck = list(recruiterDeck(user))
    return Response(
        {
            "positions": distinct(student.desired_position for student in deck),
            "experiences": [
                {"value": value, "label": label}
                for value, (label, _, _) in EXPERIENCE_LEVELS.items()
            ],
            "skills": distinct(
                skill for student in deck for skill in skillsOf(student)
            ),
        }
    )


@api_view(["GET"])
def candidate_detail(request: Request, id: int) -> Response:
    user: User = request.user
    if not isRecruiter(user):
        return Response({"error": "Forbidden"}, status=403)

    target = getCandidate(id)
    if target is None:
        return Response({"error": "Candidate not found"}, status=404)
    return Response(candidateProfile(target, user))


@api_view(["GET"])
def candidate_cv(request: Request, id: int):
    user: User = request.user
    if not isRecruiter(user):
        return Response({"error": "Forbidden"}, status=403)

    target = getCandidate(id)
    if target is None:
        return Response({"error": "Candidate not found"}, status=404)
    resume = target.resume
    if not resume:
        return Response({"error": "Resume not found"}, status=404)
    try:
        file = resume.open("rb")
    except FileNotFoundError:
        # File removed from the media folder: no download rather than a 500
        return Response({"error": "Resume not found"}, status=404)
    return FileResponse(
        file, as_attachment=True, filename=os.path.basename(resume.name or "")
    )
