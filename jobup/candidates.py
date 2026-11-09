# Candidate cards and profiles for recruiters (JOB-035, REC-01): the list of
# the cards, the full profile with the exchange history, and the CV download.
# Contract with the front end: docs/api/candidates.md
import os
from typing import Any

from django.db.models import QuerySet
from django.http import FileResponse
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .models import JobApplication, Role, Student, User


def isRecruiter(user: User) -> bool:
    return user.role == Role.RECRUITER


def visibleStudents() -> QuerySet[Student]:
    # Every recruiter sees every active student, with or without a photo, a
    # school or a CV. The filters (JOB-036) and the candidates already kept or
    # dismissed (JOB-037, JOB-038) will narrow this list down.
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


def candidateProfile(student: Student, recruiter: User) -> dict[str, Any]:
    return {
        **candidateCard(student),
        "region": student.region,
        "study_degree": student.study_degree,
        "available_from": student.available_from,
        # Stored comma separated
        "skills": [
            skill.strip() for skill in student.skills.split(",") if skill.strip()
        ],
        # Not stored: Student only has experience_level, in months
        "experiences": [],
        "exchanges": exchanges(student, recruiter),
    }


@api_view(["GET"])
def candidate_list(request: Request) -> Response:
    user: User = request.user
    if not isRecruiter(user):
        return Response({"error": "Forbidden"}, status=403)
    return Response([candidateCard(student) for student in visibleStudents()])


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
