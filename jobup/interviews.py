# Entretiens : le recruteur propose un ou plusieurs créneaux pour une candidature en cours
# d'étude, l'étudiant en retient un. Les routes sont dans recruiter_offers.py (proposer,
# annuler) et api.py (choisir un créneau). Contrat : docs/api/interviews.md
#
# Chevauchements :
# - les créneaux d'une même proposition ne se chevauchent pas entre eux ;
# - aucun ne chevauche un entretien déjà confirmé du recruteur, avec un autre candidat ;
# - un créneau proposé à plusieurs candidats revient au premier qui le choisit : chez les
#   autres, il devient « pris » ;
# - l'étudiant ne peut pas retenir un créneau qui chevauche un de ses entretiens confirmés.
# Deux créneaux qui se touchent (fin de l'un = début de l'autre) ne se chevauchent pas.
from datetime import datetime, timedelta
from typing import Any, Literal

from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from .models import (
    ApplicationStatus,
    Interview,
    InterviewSlot,
    JobApplication,
    Recruiter,
    Student,
)

MAX_SLOTS = 10
MIN_DURATION = timedelta(minutes=15)
MAX_DURATION = timedelta(hours=4)
# Plus loin, c'est presque toujours une faute de frappe dans l'année
MAX_AHEAD = timedelta(days=365)
# Un entretien se propose et se choisit pendant l'étude de la candidature, avant la décision
PENDING = (ApplicationStatus.READ, ApplicationStatus.IN_REVIEW)

Period = tuple[datetime, datetime]
# Créneau qu'on ne peut plus choisir : déjà commencé, pris par un autre candidat du même
# recruteur, ou en même temps qu'un autre entretien confirmé de l'étudiant
Unavailable = Literal["passed", "taken", "busy"]


class SlotInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    starts_at: AwareDatetime
    ends_at: AwareDatetime


class Proposal(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    slots: list[SlotInput] = Field(min_length=1, max_length=MAX_SLOTS)
    location: str = Field(default="", max_length=200)
    message: str = Field(default="", max_length=1024)


class Choice(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slot: int = Field(ge=1)


def notifyAfterCommit(
    application: JobApplication,
    interview_id: int,
    event: Literal["proposed", "confirmed", "cancelled"],
) -> None:
    # Import local : notifications.py importe api.py (par conversations.py), qui importe ce module
    from .notifications import notifyInterview

    application_id = application.pk
    transaction.on_commit(
        lambda: notifyInterview(application_id, interview_id, event), robust=True
    )


def overlaps(a: Period, b: Period) -> bool:
    return a[0] < b[1] and b[0] < a[1]


def periodOf(slot: InterviewSlot) -> Period:
    return slot.starts_at, slot.ends_at


def confirmedSlots() -> QuerySet[InterviewSlot]:
    # Créneaux retenus par un étudiant ; une candidature refusée libère le sien
    return InterviewSlot.objects.filter(chosen_at__isnull=False).exclude(
        interview__application__status=ApplicationStatus.REFUSED
    )


def recruiterAgenda(recruiter_id: int, interview: Interview | None) -> list[Period]:
    # Entretiens confirmés du recruteur, sauf celui en cours de modification
    slots = confirmedSlots().filter(
        interview__application__offer__recruiter_id=recruiter_id
    )
    if interview is not None:
        slots = slots.exclude(interview=interview)
    return [periodOf(slot) for slot in slots]


def studentAgenda(student_id: int, interview: Interview) -> list[Period]:
    slots = confirmedSlots().filter(interview__application__student_id=student_id)
    return [periodOf(slot) for slot in slots.exclude(interview=interview)]


def unavailable(
    slot: InterviewSlot, now: datetime, taken: list[Period], busy: list[Period]
) -> Unavailable | None:
    period = periodOf(slot)
    if slot.starts_at <= now:
        return "passed"
    if any(overlaps(period, other) for other in taken):
        return "taken"
    if any(overlaps(period, other) for other in busy):
        return "busy"
    return None


def slotDict(slot: InterviewSlot, state: Unavailable | None = None) -> dict[str, Any]:
    return {
        "id": slot.pk,
        "starts_at": slot.starts_at,
        "ends_at": slot.ends_at,
        "chosen": slot.chosen_at is not None,
        "unavailable": state,
    }


def interviewOf(application: JobApplication) -> Interview | None:
    return (
        Interview.objects.filter(application=application)
        .prefetch_related("slots")
        .first()
    )


def interviewDict(
    interview: Interview, recruiter_id: int, busy: list[Period] | None
) -> dict[str, Any]:
    # busy : entretiens confirmés de l'étudiant, pour sa vue seulement ; le recruteur ne
    # voit jamais les entretiens de l'étudiant avec d'autres entreprises
    slots = list(interview.slots.all())
    chosen = next((slot for slot in slots if slot.chosen_at is not None), None)
    states: dict[int, Unavailable | None] = {}
    if chosen is None:
        now = timezone.now()
        taken = recruiterAgenda(recruiter_id, interview)
        states = {slot.pk: unavailable(slot, now, taken, busy or []) for slot in slots}
    return {
        "id": interview.pk,
        "status": "proposed" if chosen is None else "confirmed",
        "location": interview.location,
        "message": interview.message,
        "created_at": interview.created_at,
        "slots": [slotDict(slot, states.get(slot.pk)) for slot in slots],
        "confirmed_slot": slotDict(chosen) if chosen else None,
        # Créneaux que l'étudiant peut encore choisir ; 0 une fois l'entretien confirmé
        "available_count": sum(1 for state in states.values() if state is None),
    }


def studentInterview(application: JobApplication) -> dict[str, Any] | None:
    interview = interviewOf(application)
    if interview is None:
        return None
    busy = studentAgenda(application.student_id, interview)
    return interviewDict(interview, application.offer.recruiter_id, busy)


def recruiterInterview(application: JobApplication) -> dict[str, Any] | None:
    interview = interviewOf(application)
    if interview is None:
        return None
    return interviewDict(interview, application.offer.recruiter_id, None)


def interviewStates(applications: list[JobApplication]) -> dict[int, dict[str, Any]]:
    # État de l'entretien de chaque candidature d'une liste, en une requête : proposé, ou
    # confirmé avec son créneau. Sans le détail des créneaux.
    states = {}
    for interview in Interview.objects.filter(
        application__in=applications
    ).prefetch_related("slots"):
        slots = list(interview.slots.all())
        chosen = next((slot for slot in slots if slot.chosen_at is not None), None)
        states[interview.application_id] = {
            "status": "proposed" if chosen is None else "confirmed",
            "slot_count": len(slots),
            "confirmed_slot": slotDict(chosen) if chosen else None,
        }
    return states


def upcomingInterviews(recruiter_id: int, application: JobApplication) -> list[dict]:
    # Prochains entretiens confirmés du recruteur avec d'autres candidats : le formulaire
    # signale tout de suite un créneau qui les chevauche
    slots = (
        confirmedSlots()
        .filter(
            interview__application__offer__recruiter_id=recruiter_id,
            ends_at__gt=timezone.now(),
        )
        .exclude(interview__application=application)
        .select_related(
            "interview__application__student__user", "interview__application__offer"
        )
    )
    return [
        {
            "starts_at": slot.starts_at,
            "ends_at": slot.ends_at,
            "candidate": f"{slot.interview.application.student.user.first_name} "
            f"{slot.interview.application.student.user.last_name}",
            "offer": slot.interview.application.offer.title,
            "application_id": slot.interview.application_id,
        }
        for slot in slots
    ]


def proposalError(
    slots: list[SlotInput], busy: list[Period], now: datetime
) -> tuple[str, int] | None:
    # Première règle enfreinte, avec l'indice du créneau en cause
    periods: list[Period] = [(slot.starts_at, slot.ends_at) for slot in slots]
    for index, (start, end) in enumerate(periods):
        if not MIN_DURATION <= end - start <= MAX_DURATION:
            return "Invalid duration", index
        if start <= now:
            return "Slot in the past", index
        if start > now + MAX_AHEAD:
            return "Slot too far", index
        if any(overlaps((start, end), other) for other in periods[:index]):
            return "Slots overlap", index
        if any(overlaps((start, end), other) for other in busy):
            return "Recruiter busy", index
    return None


def propose(application: JobApplication, proposal: Proposal) -> tuple[str, int] | None:
    # À appeler dans une transaction, la candidature verrouillée. Remplace un entretien
    # encore en attente ; l'étudiant est notifié de la nouvelle proposition.
    recruiter_id = application.offer.recruiter_id
    Recruiter.objects.select_for_update().filter(pk=recruiter_id).first()
    current = interviewOf(application)
    error = proposalError(
        proposal.slots, recruiterAgenda(recruiter_id, current), timezone.now()
    )
    if error is not None:
        return error
    if current is not None:
        current.delete()
    interview = Interview.objects.create(
        application=application, location=proposal.location, message=proposal.message
    )
    InterviewSlot.objects.bulk_create(
        InterviewSlot(
            interview=interview, starts_at=slot.starts_at, ends_at=slot.ends_at
        )
        for slot in sorted(proposal.slots, key=lambda slot: slot.starts_at)
    )
    notifyAfterCommit(application, interview.pk, "proposed")
    return None


def cancel(application: JobApplication) -> bool:
    # Annulation par le recruteur, avant ou après le choix de l'étudiant, qui est prévenu
    interview = interviewOf(application)
    if interview is None:
        return False
    interview_id = interview.pk
    interview.delete()
    notifyAfterCommit(application, interview_id, "cancelled")
    return True


def choose(application: JobApplication, slot_id: int) -> str | None:
    # Choix de l'étudiant, dans une transaction. Les verrous sur le recruteur et l'étudiant
    # font passer l'un après l'autre deux choix qui se disputeraient le même horaire.
    interview = interviewOf(application)
    if interview is None:
        return "Interview not found"
    recruiter_id, student_id = application.offer.recruiter_id, application.student_id
    Recruiter.objects.select_for_update().filter(pk=recruiter_id).first()
    Student.objects.select_for_update().filter(pk=student_id).first()
    slots = list(interview.slots.all())
    slot = next((slot for slot in slots if slot.pk == slot_id), None)
    if slot is None:
        return "Slot not found"
    chosen = next((slot for slot in slots if slot.chosen_at is not None), None)
    if chosen is not None:
        # Le même choix renvoyé ne change rien
        return None if chosen.pk == slot.pk else "Interview already confirmed"
    state = unavailable(
        slot,
        timezone.now(),
        recruiterAgenda(recruiter_id, interview),
        studentAgenda(student_id, interview),
    )
    if state is not None:
        return {"passed": "Slot passed", "taken": "Slot taken", "busy": "Student busy"}[
            state
        ]
    slot.chosen_at = timezone.now()
    slot.save(update_fields=["chosen_at"])
    notifyAfterCommit(application, interview.pk, "confirmed")
    return None
