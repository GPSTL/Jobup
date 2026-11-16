# Presence of the users (JOB-039, REC-05): the server writes down when each logged-in
# user last made a request. The recruiter sees a candidate « En ligne » when they were
# seen less than 2 minutes ago; the front end applies that rule
# (front/components/CandidatePresence.tsx). While a page of the student space is visible,
# it makes a request every minute (front/services/presence.ts): a closed tab, or a
# logged-out student, shows « Hors ligne » within 2 minutes.
# Contract with the front end: docs/api/recruiter-conversations.md
from collections.abc import Callable
from datetime import datetime, timedelta

from django.http import HttpRequest, HttpResponse
from django.utils import timezone

from .models import User

# At most one write per user over this delay, rather than one per request
SEEN_REFRESH = timedelta(seconds=30)


def recordActivity(user: User, now: datetime | None = None) -> None:
    now = now or timezone.now()
    if user.last_seen_at is not None and now - user.last_seen_at < SEEN_REFRESH:
        return
    # update() rather than save(): only this column is written
    User.objects.filter(pk=user.pk).update(last_seen_at=now)
    user.last_seen_at = now


def secondsSinceSeen(user: User, now: datetime | None = None) -> int | None:
    # An age rather than a date: the browser does not compare its clock with the
    # server's one, which can differ (e.g. WSL and Windows)
    if user.last_seen_at is None:
        return None
    now = now or timezone.now()
    return max(0, int((now - user.last_seen_at).total_seconds()))


class PresenceMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)
        # After the view: a login has just opened the session, a logout closed it
        user = getattr(request, "user", None)
        if isinstance(user, User) and user.is_authenticated:
            recordActivity(user)
        return response
