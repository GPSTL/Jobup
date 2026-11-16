import tempfile
from unittest import mock

from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from .models import (
    ApplicationStatus,
    Company,
    Conversation,
    JobApplication,
    JobCategory,
    Message,
    MessageAttachment,
    Notification,
    NotificationKind,
    NotificationPreference,
    Offer,
    Recruiter,
    Role,
    School,
    SchoolManager,
    Student,
    User,
)
from .notifications import notifyNewMessage, notifyStatusChange
from .test_resume import PDF

PASSWORD = "Example123"
LIST = "/api/notifications"


class NotificationTestCase(APITestCase):
    def setUp(self):
        # Les fichiers joints vont dans un dossier temporaire, supprimé après chaque test
        private = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(self.settings(PRIVATE_MEDIA_ROOT=private))

        self.student = self.makeUser(
            "eleve@example.fr", "Élodie", "Durand", Role.STUDENT
        )
        self.other = self.makeUser("autre@example.fr", "Marc", "Blanc", Role.STUDENT)
        Student.objects.create(user=self.student)
        Student.objects.create(user=self.other)
        acme = Company.objects.create(name="Acme", siret="12345678901234")
        self.lea = Recruiter.objects.create(
            user=self.makeUser("lea@acme.fr", "Léa", "Martin", Role.RECRUITER),
            company=acme,
        )
        self.manager = SchoolManager.objects.create(
            user=self.makeUser("rel@univ.fr", "Inès", "Roux", Role.MANAGER),
            school=School.objects.create(name="Université Paris"),
        )
        self.with_lea = Conversation.objects.create(
            student=self.student.student, recruiter=self.lea
        )
        self.with_school = Conversation.objects.create(
            student=self.student.student, school_manager=self.manager
        )
        self.offer = Offer.objects.create(
            recruiter=self.lea,
            title="Chef de projet digital",
            description="Description",
            category=JobCategory.COMPUTER_SCIENCE,
        )
        self.application = JobApplication.objects.create(
            student=self.student.student, offer=self.offer
        )

    def makeUser(self, email, first_name, last_name, role):
        return User.objects.create_user(
            email, PASSWORD, first_name=first_name, last_name=last_name, role=role
        )

    def login(self, user):
        self.client.post(
            "/api/login", {"email": user.email, "password": PASSWORD}, format="json"
        )

    def send(self, sender, body, conversation=None):
        # Les notifications partent une fois l'enregistrement validé
        with self.captureOnCommitCallbacks(execute=True):
            return Message.objects.create(
                conversation=conversation or self.with_lea, sender=sender, body=body
            )

    def setStatus(self, status, application=None):
        application = application or self.application
        with self.captureOnCommitCallbacks(execute=True):
            application.status = status
            application.save()

    def notificationsOf(self, user):
        return list(Notification.objects.filter(recipient=user).order_by("pk"))


class MessageEventTests(NotificationTestCase):
    def test_recruiter_message_notifies_the_student(self):
        message = self.send(self.lea.user, "Seriez-vous disponible mardi ?")
        (notification,) = self.notificationsOf(self.student)
        self.assertEqual(notification.kind, NotificationKind.MESSAGE)
        self.assertEqual(notification.title, "Nouveau message de Léa Martin – Acme")
        self.assertEqual(notification.body, "« Seriez-vous disponible mardi ? »")
        self.assertEqual(notification.link, f"/messages/{self.with_lea.pk}")
        self.assertEqual(notification.event, f"message:{message.pk}")
        self.assertIsNone(notification.read_at)

    def test_school_message_notifies_the_student(self):
        self.send(self.manager.user, "Votre convention est prête.", self.with_school)
        (notification,) = self.notificationsOf(self.student)
        self.assertEqual(
            notification.title, "Nouveau message de Inès Roux – Université Paris"
        )

    def test_the_student_is_not_notified_of_their_own_message(self):
        self.send(self.student, "Merci !")
        self.assertEqual(Notification.objects.count(), 0)

    def test_long_message_and_file_only_message(self):
        self.send(self.lea.user, "x " * 200)
        long_body = self.notificationsOf(self.student)[0].body
        self.assertLessEqual(len(long_body), 124)
        self.assertTrue(long_body.endswith("… »"))

        with self.captureOnCommitCallbacks(execute=True):
            message = Message.objects.create(
                conversation=self.with_lea, sender=self.lea.user, body=""
            )
            MessageAttachment.store(
                message, SimpleUploadedFile("Convocation.pdf", PDF), "Convocation.pdf"
            )
        self.assertEqual(
            self.notificationsOf(self.student)[1].body, "Pièce jointe : Convocation.pdf"
        )

    def test_a_message_sent_through_the_api_is_notified(self):
        self.login(self.lea.user)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                f"/api/conversations/{self.with_lea.pk}/messages",
                {"body": "Bonjour"},
                format="json",
            )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(self.notificationsOf(self.student)), 1)

    def test_the_same_message_is_never_notified_twice(self):
        message = self.send(self.lea.user, "Bonjour")
        self.assertIsNone(notifyNewMessage(message.pk))
        message.body = "Bonjour, modifié"
        with self.captureOnCommitCallbacks(execute=True):
            message.save()
        self.assertEqual(len(self.notificationsOf(self.student)), 1)

    def test_unknown_message(self):
        self.assertIsNone(notifyNewMessage(9999))


class StatusEventTests(NotificationTestCase):
    def test_review_acceptance_and_refusal_are_notified(self):
        self.setStatus(ApplicationStatus.READ)
        self.setStatus(ApplicationStatus.ACCEPTED)
        review, accepted = self.notificationsOf(self.student)
        self.assertEqual(review.kind, NotificationKind.APPLICATION_UPDATE)
        self.assertEqual(review.title, "Candidature mise à jour")
        self.assertEqual(
            review.body,
            "« Chef de projet digital » chez Acme est passée en « En cours d’étude ».",
        )
        self.assertEqual(review.link, f"/applications/{self.application.pk}")
        self.assertEqual(accepted.kind, NotificationKind.APPLICATION_ACCEPTED)
        self.assertEqual(accepted.title, "Candidature acceptée !")
        self.assertEqual(
            accepted.body,
            "Acme a accepté votre candidature « Chef de projet digital ».",
        )

        other_offer = Offer.objects.create(
            recruiter=self.lea,
            title="Data analyst",
            description="Description",
            category=JobCategory.DATA_AI,
        )
        refused = JobApplication.objects.create(
            student=self.student.student, offer=other_offer
        )
        self.setStatus(ApplicationStatus.REFUSED, refused)
        notification = self.notificationsOf(self.student)[-1]
        self.assertEqual(notification.kind, NotificationKind.APPLICATION_REFUSED)
        self.assertEqual(
            notification.body, "Acme n’a pas retenu votre candidature « Data analyst »."
        )

    def test_read_then_in_review_is_one_event(self):
        # Les deux statuts s'affichent « En cours d'étude » pour l'étudiant
        self.setStatus(ApplicationStatus.READ)
        self.setStatus(ApplicationStatus.IN_REVIEW)
        self.assertEqual(len(self.notificationsOf(self.student)), 1)

    def test_submitting_is_the_student_own_action(self):
        self.setStatus(ApplicationStatus.SUBMITTED)
        self.assertEqual(Notification.objects.count(), 0)

    def test_saving_without_a_status_change_notifies_nothing(self):
        self.setStatus(ApplicationStatus.READ)
        with self.captureOnCommitCallbacks(execute=True):
            self.application.message = "Texte modifié"
            self.application.save()
            JobApplication.objects.get(pk=self.application.pk).save()
        self.assertEqual(len(self.notificationsOf(self.student)), 1)

    def test_a_new_application_notifies_nothing(self):
        with self.captureOnCommitCallbacks(execute=True):
            JobApplication.objects.create(
                student=self.other.student,
                offer=self.offer,
                status=ApplicationStatus.ACCEPTED,
            )
        self.assertEqual(Notification.objects.count(), 0)

    def test_unknown_application(self):
        self.assertIsNone(notifyStatusChange(9999, ApplicationStatus.ACCEPTED))


class PreferenceTests(NotificationTestCase):
    def test_defaults_of_the_mockup(self):
        self.login(self.student)
        self.assertEqual(
            self.client.get(f"{LIST}/preferences").json(),
            {"messages": True, "application_status": True, "email": False},
        )

    def test_each_kind_can_be_turned_off(self):
        NotificationPreference.objects.create(
            user=self.student, messages=False, application_status=False
        )
        self.send(self.lea.user, "Bonjour")
        self.setStatus(ApplicationStatus.ACCEPTED)
        self.assertEqual(Notification.objects.count(), 0)

    def test_no_email_by_default(self):
        self.send(self.lea.user, "Bonjour")
        self.assertEqual(len(self.notificationsOf(self.student)), 1)
        self.assertEqual(mail.outbox, [])

    def test_email_when_turned_on(self):
        NotificationPreference.objects.create(user=self.student, email=True)
        self.setStatus(ApplicationStatus.ACCEPTED)
        (email,) = mail.outbox
        self.assertEqual(email.to, [self.student.email])
        self.assertEqual(email.subject, "JobUp — Candidature acceptée !")
        self.assertIn("Acme a accepté votre candidature", email.body)
        self.assertIn(f"/applications/{self.application.pk}", email.body)

    def test_email_off_keeps_the_notification_in_the_application(self):
        NotificationPreference.objects.create(user=self.student, email=False)
        self.setStatus(ApplicationStatus.ACCEPTED)
        self.assertEqual(len(self.notificationsOf(self.student)), 1)
        self.assertEqual(mail.outbox, [])

    def test_email_failure_keeps_the_notification(self):
        NotificationPreference.objects.create(user=self.student, email=True)
        with mock.patch(
            "jobup.notifications.send_mail", side_effect=OSError("SMTP down")
        ):
            self.send(self.lea.user, "Bonjour")
        self.assertEqual(len(self.notificationsOf(self.student)), 1)

    def test_update_only_the_fields_sent(self):
        self.login(self.student)
        response = self.client.put(
            f"{LIST}/preferences", {"email": True}, format="json"
        )
        self.assertEqual(
            response.json(),
            {"messages": True, "application_status": True, "email": True},
        )
        # Conservé après rechargement
        self.assertTrue(NotificationPreference.objects.get(user=self.student).email)
        response = self.client.put(
            f"{LIST}/preferences", {"messages": False}, format="json"
        )
        self.assertEqual(
            response.json(),
            {"messages": False, "application_status": True, "email": True},
        )

    def test_invalid_value(self):
        self.login(self.student)
        response = self.client.put(
            f"{LIST}/preferences", {"email": "peut-être"}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.json()["errors"])
        self.assertFalse(NotificationPreference.objects.get(user=self.student).email)

    def test_preferences_are_per_user(self):
        self.login(self.other)
        self.client.put(f"{LIST}/preferences", {"email": True}, format="json")
        self.login(self.student)
        self.assertFalse(self.client.get(f"{LIST}/preferences").json()["email"])


class NotificationApiTests(NotificationTestCase):
    def setUp(self):
        super().setUp()
        self.first = self.send(self.lea.user, "Premier")
        self.second = self.send(self.lea.user, "Deuxième")
        self.send(
            self.lea.user,
            "Pour Marc",
            Conversation.objects.create(student=self.other.student, recruiter=self.lea),
        )
        self.login(self.student)

    def ids(self, response):
        return [n["title"] for n in response.json()["notifications"]]

    def test_list_of_own_notifications_newest_first(self):
        response = self.client.get(LIST)
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(
            [n["body"] for n in body["notifications"]], ["« Deuxième »", "« Premier »"]
        )
        self.assertEqual(body["unread_count"], 2)
        self.assertFalse(body["has_more"])
        self.assertEqual(
            set(body["notifications"][0]),
            {"id", "kind", "title", "body", "link", "created_at", "read"},
        )

    def test_pagination(self):
        response = self.client.get(LIST, {"limit": 1})
        (newest,) = response.json()["notifications"]
        self.assertTrue(response.json()["has_more"])
        older = self.client.get(LIST, {"limit": 1, "before": newest["id"]}).json()
        self.assertEqual([n["body"] for n in older["notifications"]], ["« Premier »"])
        self.assertFalse(older["has_more"])
        self.assertEqual(self.client.get(LIST, {"limit": 0}).status_code, 400)
        self.assertEqual(self.client.get(LIST, {"limit": 51}).status_code, 400)

    def test_unread_count_and_read_state_survive_a_reload(self):
        self.assertEqual(
            self.client.get(f"{LIST}/unread-count").json(), {"unread_count": 2}
        )
        notification = Notification.objects.get(
            recipient=self.student, event=f"message:{self.first.pk}"
        )
        response = self.client.post(f"{LIST}/{notification.pk}/read")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["notification"]["read"])
        self.assertEqual(response.json()["unread_count"], 1)
        # Lu une seconde fois : sans effet
        read_at = Notification.objects.get(pk=notification.pk).read_at
        self.client.post(f"{LIST}/{notification.pk}/read")
        self.assertEqual(Notification.objects.get(pk=notification.pk).read_at, read_at)
        self.assertEqual(
            self.client.get(f"{LIST}/unread-count").json(), {"unread_count": 1}
        )

    def test_mark_all_read_only_touches_own_notifications(self):
        self.assertEqual(
            self.client.post(f"{LIST}/read-all").json(), {"unread_count": 0}
        )
        self.assertEqual(
            self.client.get(f"{LIST}/unread-count").json(), {"unread_count": 0}
        )
        self.assertEqual(
            Notification.objects.filter(
                recipient=self.other, read_at__isnull=True
            ).count(),
            1,
        )

    def test_notifications_of_someone_else_are_not_found(self):
        theirs = Notification.objects.get(recipient=self.other)
        self.assertEqual(self.client.post(f"{LIST}/{theirs.pk}/read").status_code, 404)
        self.assertIsNone(Notification.objects.get(pk=theirs.pk).read_at)
        self.assertEqual(self.client.post(f"{LIST}/9999/read").status_code, 404)

    def test_anonymous_is_refused(self):
        self.client.logout()
        for method, url in (
            ("get", LIST),
            ("get", f"{LIST}/unread-count"),
            ("post", f"{LIST}/read-all"),
            ("get", f"{LIST}/preferences"),
            ("put", f"{LIST}/preferences"),
            ("post", f"{LIST}/1/read"),
        ):
            self.assertEqual(getattr(self.client, method)(url).status_code, 403, url)

    def test_empty_list(self):
        self.login(self.lea.user)
        self.assertEqual(
            self.client.get(LIST).json(),
            {"notifications": [], "has_more": False, "unread_count": 0},
        )
