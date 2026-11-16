from django.utils import timezone

from .models import (
    ApplicationStatus,
    Conversation,
    Exclusion,
    JobApplication,
    Notification,
    NotificationKind,
    Shortlist,
)
from .test_candidates import COLLEAGUE, CandidateTestCase
from .test_login import USERS


class RecruiterDecisionTests(CandidateTestCase):
    def url(self, application):
        return f"/api/recruiter/applications/{application.pk}"

    def notifications(self):
        return list(
            Notification.objects.filter(recipient=self.alice.user).order_by("pk")
        )

    def test_open_submitted_updates_real_application_and_student_tracking(self):
        application = self.sent(self.offers[0], 1)
        USERS[3].login(self)
        with self.captureOnCommitCallbacks(execute=True):
            result = self.client.get(self.url(application))
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["status"], ApplicationStatus.IN_REVIEW)
        self.assertEqual(result.json()["candidate"]["id"], self.alice.user.pk)
        self.assertEqual(result.json()["message"], "")
        application.refresh_from_db()
        self.assertEqual(application.status, ApplicationStatus.IN_REVIEW)
        self.assertEqual(
            self.notifications()[0].kind, NotificationKind.APPLICATION_UPDATE
        )
        with self.captureOnCommitCallbacks(execute=True):
            self.client.get(self.url(application))
        self.assertEqual(len(self.notifications()), 1)
        self.client.force_authenticate(self.alice.user)
        self.assertEqual(
            self.client.get(f"/api/applications/{application.pk}").json()["status"],
            ApplicationStatus.IN_REVIEW,
        )
        self.assertEqual(
            self.client.get("/api/applications").json()["in_progress"][0]["status"],
            ApplicationStatus.IN_REVIEW,
        )

    def test_accept_with_message_and_reuse_conversation_no_double_notification(self):
        application = self.sent(self.offers[0], 1)
        recruiter = self.offers[0].recruiter
        existing = Conversation.objects.create(student=self.alice, recruiter=recruiter)
        USERS[3].login(self)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.get(self.url(application))
            response = self.client.patch(
                self.url(application),
                {
                    "status": ApplicationStatus.ACCEPTED,
                    "message": "Bienvenue à bord !",
                },
                format="json",
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], ApplicationStatus.ACCEPTED)
        self.assertEqual(response.json()["conversation_id"], existing.pk)
        self.assertEqual(response.json()["decision_message"], "Bienvenue à bord !")
        self.assertEqual(Conversation.objects.count(), 1)
        self.assertEqual(Shortlist.objects.count(), 0)
        self.assertEqual(Exclusion.objects.count(), 0)
        self.assertEqual(
            [notification.kind for notification in self.notifications()],
            [
                NotificationKind.APPLICATION_UPDATE,
                NotificationKind.APPLICATION_ACCEPTED,
            ],
        )
        self.assertIn("Bienvenue à bord !", self.notifications()[-1].body)
        with self.captureOnCommitCallbacks(execute=True):
            second = self.client.patch(
                self.url(application),
                {"status": ApplicationStatus.ACCEPTED, "message": "Ne pas renvoyer"},
                format="json",
            )
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()["decision_message"], "Bienvenue à bord !")
        self.assertEqual(len(self.notifications()), 2)
        self.assertEqual(Conversation.objects.count(), 1)
        self.client.force_authenticate(self.alice.user)
        self.assertEqual(
            self.client.get("/api/applications").json()["completed"][0]["status"],
            ApplicationStatus.ACCEPTED,
        )
        self.assertEqual(
            self.client.get(f"/api/applications/{application.pk}").json()[
                "decision_message"
            ],
            "Bienvenue à bord !",
        )
        self.assertEqual(
            self.client.get("/api/student/conversations").json()[0]["id"],
            existing.pk,
        )

    def test_accept_without_message_creates_conversation(self):
        application = self.sent(self.offers[0], 1)
        USERS[3].login(self)
        self.client.get(self.url(application))
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                self.url(application),
                {"status": ApplicationStatus.ACCEPTED},
                format="json",
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["decision_message"], "")
        self.assertEqual(
            response.json()["conversation_id"],
            Conversation.objects.get(
                student=self.alice, recruiter=self.offers[0].recruiter
            ).pk,
        )

    def test_refuse_with_and_without_message_no_conversation(self):
        application = self.sent(self.offers[0], 1)
        USERS[3].login(self)
        self.client.get(self.url(application))
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                self.url(application),
                {"status": ApplicationStatus.REFUSED, "message": "Profil non retenu"},
                format="json",
            )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["conversation_id"])
        self.assertEqual(Conversation.objects.count(), 0)
        self.assertEqual(Shortlist.objects.count(), 0)
        self.assertEqual(Exclusion.objects.count(), 0)
        self.assertIn("Profil non retenu", self.notifications()[-1].body)
        self.assertEqual(
            self.notifications()[-1].kind, NotificationKind.APPLICATION_REFUSED
        )
        self.client.force_authenticate(self.alice.user)
        self.assertEqual(
            self.client.get("/api/applications").json()["completed"][0]["status"],
            ApplicationStatus.REFUSED,
        )
        self.assertEqual(
            self.client.get(f"/api/applications/{application.pk}").json()[
                "decision_message"
            ],
            "Profil non retenu",
        )

        other = self.sent(self.offers[1], 1)
        USERS[3].login(self)
        self.client.get(self.url(other))
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                self.url(other),
                {"status": ApplicationStatus.REFUSED},
                format="json",
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["decision_message"], "")
        self.assertEqual(Conversation.objects.count(), 0)

    def test_foreign_recruiter_and_other_roles_cannot_read_or_decide(self):
        application = self.sent(self.offers[0], 1)
        colleague_application = self.sent(self.colleague_offer, 1)
        for user in (COLLEAGUE, USERS[0], USERS[2]):
            user.login(self)
            expected = 404 if user == COLLEAGUE else 403
            self.assertEqual(
                self.client.get(self.url(application)).status_code, expected
            )
            self.assertEqual(
                self.client.patch(
                    self.url(application),
                    {"status": ApplicationStatus.ACCEPTED},
                    format="json",
                ).status_code,
                expected,
            )
        USERS[3].login(self)
        self.assertEqual(
            self.client.get(self.url(colleague_application)).status_code, 404
        )
        self.assertEqual(
            self.client.get("/api/recruiter/applications/999999").status_code,
            404,
        )
        self.assertEqual(
            self.client.patch(
                self.url(colleague_application),
                {"status": ApplicationStatus.ACCEPTED},
                format="json",
            ).status_code,
            404,
        )
        application.refresh_from_db()
        self.assertEqual(application.status, ApplicationStatus.SUBMITTED)
        self.assertEqual(Notification.objects.count(), 0)
        self.assertEqual(Conversation.objects.count(), 0)

    def test_invalid_transitions_validation_and_drafts(self):
        application = self.sent(self.offers[0], 1)
        draft = JobApplication.objects.create(student=self.bob, offer=self.offers[0])
        # An inconsistent legacy draft with a submitted timestamp stays hidden.
        draft.submitted_at = timezone.now()
        draft.save()
        USERS[3].login(self)
        self.assertEqual(self.client.get(self.url(draft)).status_code, 404)
        self.assertEqual(
            self.client.patch(
                self.url(draft),
                {"status": ApplicationStatus.ACCEPTED},
                format="json",
            ).status_code,
            404,
        )
        url = self.url(application)
        for status, expected in (
            (ApplicationStatus.ACCEPTED, 409),
            (ApplicationStatus.IN_REVIEW, 400),
        ):
            self.assertEqual(
                self.client.patch(url, {"status": status}, format="json").status_code,
                expected,
            )
        self.assertEqual(
            self.client.patch(
                url,
                {"status": ApplicationStatus.REFUSED, "message": "x" * 1025},
                format="json",
            ).status_code,
            400,
        )
        self.client.get(url)
        self.assertEqual(
            self.client.patch(
                url, {"status": ApplicationStatus.ACCEPTED}, format="json"
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.patch(
                url, {"status": ApplicationStatus.REFUSED}, format="json"
            ).status_code,
            409,
        )
        application.refresh_from_db()
        self.assertEqual(application.status, ApplicationStatus.ACCEPTED)

    def test_long_optional_message_is_kept_in_detail_but_notification_is_short(self):
        application = self.sent(self.offers[0], 1)
        USERS[3].login(self)
        self.client.get(self.url(application))
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                self.url(application),
                {"status": ApplicationStatus.REFUSED, "message": "x" * 1024},
                format="json",
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["decision_message"]), 1024)
        self.assertLessEqual(len(self.notifications()[-1].body), 300)

    def test_read_legacy_and_closed_offer_can_still_decide(self):
        application = self.sent(self.offers[0], 1)
        application.status = ApplicationStatus.READ
        application.save()
        self.offers[0].is_active = False
        self.offers[0].save()
        USERS[3].login(self)
        self.assertEqual(
            self.client.get(self.url(application)).json()["status"],
            ApplicationStatus.READ,
        )
        self.assertEqual(
            self.client.patch(
                self.url(application),
                {"status": ApplicationStatus.REFUSED},
                format="json",
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.get(self.url(application)).json()["status"],
            ApplicationStatus.REFUSED,
        )
