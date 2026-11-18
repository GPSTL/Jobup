import tempfile

from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

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
)
from .notifications import notifyStatusChange
from .test_notifications import LIST, NotificationTestCase
from .test_resume import PDF


# Notifications du recruteur (JOB-046, REC-32), sur le socle de JOB-042. Le cas commun de
# NotificationTestCase : l'étudiante Élodie, Léa (Acme), l'offre de Léa et un brouillon d'Élodie.
class RecruiterNotificationTestCase(NotificationTestCase):
    def setUp(self):
        super().setUp()
        media = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(override_settings(MEDIA_ROOT=media))
        # Un collègue de Léa chez Acme, et une recruteuse d'une autre entreprise
        self.paul = Recruiter.objects.create(
            user=self.makeUser("paul@acme.fr", "Paul", "Petit", Role.RECRUITER),
            company=self.lea.company,
        )
        self.nora = Recruiter.objects.create(
            user=self.makeUser("nora@globex.fr", "Nora", "Haddad", Role.RECRUITER),
            company=Company.objects.create(name="Globex", siret="98765432109876"),
        )
        self.globex_offer = Offer.objects.create(
            recruiter=self.nora,
            title="Data analyst",
            description="Description",
            category=JobCategory.DATA_AI,
        )

    def submit(self, application=None):
        # Comme POST /api/applications/<id>/submit
        application = application or self.application
        with self.captureOnCommitCallbacks(execute=True):
            application.status = ApplicationStatus.SUBMITTED
            application.save()


class NewApplicationTests(RecruiterNotificationTestCase):
    def test_a_submitted_application_notifies_the_author_of_the_offer(self):
        self.student.student.resume.save("cv.pdf", SimpleUploadedFile("cv.pdf", PDF))
        self.login(self.student)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                f"/api/applications/{self.application.pk}/submit"
            )
        self.assertEqual(response.status_code, 200)
        (notification,) = self.notificationsOf(self.lea.user)
        self.assertEqual(notification.kind, NotificationKind.NEW_APPLICATION)
        self.assertEqual(notification.title, "Nouvelle candidature")
        self.assertEqual(
            notification.body,
            "Élodie Durand a postulé à « Chef de projet digital ».",
        )
        self.assertEqual(
            notification.link,
            f"/recruiter/candidates/{self.student.pk}?offer={self.offer.pk}",
        )
        self.assertEqual(
            notification.event, f"application:{self.application.pk}:submitted"
        )
        # L'envoi est l'action de l'étudiante : elle n'est pas notifiée
        self.assertEqual(self.notificationsOf(self.student), [])

    def test_colleagues_and_other_companies_are_not_notified(self):
        self.submit()
        self.assertEqual(len(self.notificationsOf(self.lea.user)), 1)
        self.assertEqual(self.notificationsOf(self.paul.user), [])
        self.assertEqual(self.notificationsOf(self.nora.user), [])

        # Chaque entreprise ne reçoit que les candidatures à ses offres
        self.submit(
            JobApplication.objects.create(
                student=self.other.student, offer=self.globex_offer
            )
        )
        (theirs,) = self.notificationsOf(self.nora.user)
        self.assertEqual(theirs.body, "Marc Blanc a postulé à « Data analyst ».")
        self.assertEqual(len(self.notificationsOf(self.lea.user)), 1)

    def test_a_draft_notifies_nobody(self):
        with self.captureOnCommitCallbacks(execute=True):
            draft = JobApplication.objects.create(
                student=self.other.student, offer=self.offer
            )
            draft.message = "Brouillon modifié"
            draft.save()
        self.assertEqual(Notification.objects.count(), 0)

    def test_an_application_created_already_submitted_is_notified(self):
        # Sans passer par un brouillon (administration, jeu de données)
        with self.captureOnCommitCallbacks(execute=True):
            JobApplication.objects.create(
                student=self.other.student,
                offer=self.offer,
                status=ApplicationStatus.SUBMITTED,
            )
        (notification,) = self.notificationsOf(self.lea.user)
        self.assertEqual(
            notification.body, "Marc Blanc a postulé à « Chef de projet digital »."
        )

    def test_the_same_application_is_never_notified_twice(self):
        self.submit()
        self.assertIsNone(
            notifyStatusChange(self.application.pk, ApplicationStatus.SUBMITTED)
        )
        self.assertEqual(len(self.notificationsOf(self.lea.user)), 1)

    def test_the_decision_notifies_the_student_not_the_recruiter(self):
        self.submit()
        self.setStatus(ApplicationStatus.ACCEPTED)
        self.assertEqual(len(self.notificationsOf(self.lea.user)), 1)
        self.assertEqual(len(self.notificationsOf(self.student)), 1)

    def test_turned_off(self):
        NotificationPreference.objects.create(
            user=self.lea.user, new_applications=False
        )
        self.submit()
        self.assertEqual(Notification.objects.count(), 0)

    def test_an_inactive_account_is_not_notified(self):
        self.lea.user.is_active = False
        self.lea.user.save()
        self.submit()
        self.assertEqual(Notification.objects.count(), 0)


class RecruiterMessageTests(RecruiterNotificationTestCase):
    def test_a_student_message_notifies_the_recruiter_of_the_conversation(self):
        message = self.send(
            self.student, "Merci pour votre retour, je suis disponible jeudi."
        )
        (notification,) = self.notificationsOf(self.lea.user)
        self.assertEqual(notification.kind, NotificationKind.MESSAGE)
        self.assertEqual(notification.title, "Nouveau message de Élodie Durand")
        self.assertEqual(
            notification.body, "« Merci pour votre retour, je suis disponible jeudi. »"
        )
        self.assertEqual(notification.link, f"/recruiter/messages/{self.with_lea.pk}")
        self.assertEqual(notification.event, f"message:{message.pk}")

    def test_only_the_recruiter_of_the_conversation_is_notified(self):
        self.send(self.student, "Bonjour Léa")
        self.assertEqual(self.notificationsOf(self.paul.user), [])
        self.assertEqual(self.notificationsOf(self.nora.user), [])

        with_nora = Conversation.objects.create(
            student=self.student.student, recruiter=self.nora
        )
        self.send(self.student, "Bonjour Nora", with_nora)
        (theirs,) = self.notificationsOf(self.nora.user)
        self.assertEqual(theirs.link, f"/recruiter/messages/{with_nora.pk}")
        self.assertEqual(len(self.notificationsOf(self.lea.user)), 1)

    def test_the_recruiter_is_not_notified_of_their_own_message(self):
        self.send(self.lea.user, "Seriez-vous disponible mardi ?")
        self.assertEqual(self.notificationsOf(self.lea.user), [])
        self.assertEqual(len(self.notificationsOf(self.student)), 1)

    def test_a_message_to_the_school_notifies_no_recruiter(self):
        self.send(self.student, "Ma convention est signée.", self.with_school)
        # Seul l'employé d'école de la conversation est notifié
        (notification,) = Notification.objects.all()
        self.assertEqual(notification.recipient, self.with_school.school_manager.user)
        self.assertEqual(notification.link, f"/school/messages/{self.with_school.pk}")

    def test_file_only_message(self):
        with self.captureOnCommitCallbacks(execute=True):
            message = Message.objects.create(
                conversation=self.with_lea, sender=self.student, body=""
            )
            MessageAttachment.store(
                message, SimpleUploadedFile("CV.pdf", PDF), "CV.pdf"
            )
        (notification,) = self.notificationsOf(self.lea.user)
        self.assertEqual(notification.body, "Pièce jointe : CV.pdf")

    def test_a_message_sent_through_the_api_is_notified(self):
        self.login(self.student)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                f"/api/conversations/{self.with_lea.pk}/messages",
                {"body": "Bonjour"},
                format="json",
            )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(self.notificationsOf(self.lea.user)), 1)

    def test_turned_off(self):
        NotificationPreference.objects.create(user=self.lea.user, messages=False)
        self.send(self.student, "Bonjour")
        self.assertEqual(Notification.objects.count(), 0)


class RecruiterPreferenceTests(RecruiterNotificationTestCase):
    def test_defaults_of_the_mockup(self):
        # « Mon espace recruteur – Compte et abonnement » : tout est activé, e-mail compris
        self.login(self.lea.user)
        self.assertEqual(
            self.client.get(f"{LIST}/preferences").json(),
            {
                "messages": True,
                "application_status": True,
                "new_applications": True,
                "school_updates": True,
                "email": True,
            },
        )

    def test_email_by_default(self):
        self.submit()
        self.send(self.student, "Bonjour")
        application, message = mail.outbox
        self.assertEqual(application.to, [self.lea.user.email])
        self.assertEqual(application.subject, "JobUp — Nouvelle candidature")
        self.assertIn(
            "Élodie Durand a postulé à « Chef de projet digital ».", application.body
        )
        self.assertIn(
            f"/recruiter/candidates/{self.student.pk}?offer={self.offer.pk}",
            application.body,
        )
        self.assertEqual(message.subject, "JobUp — Nouveau message de Élodie Durand")
        self.assertIn(f"/recruiter/messages/{self.with_lea.pk}", message.body)

    def test_email_turned_off_from_mon_espace(self):
        self.login(self.lea.user)
        response = self.client.put(
            f"{LIST}/preferences", {"email": False}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["email"])
        # Conservé après rechargement
        self.assertFalse(self.client.get(f"{LIST}/preferences").json()["email"])

        self.submit()
        # Plus d'e-mail, la notification reste dans l'application
        self.assertEqual(mail.outbox, [])
        self.assertEqual(len(self.notificationsOf(self.lea.user)), 1)

    def test_new_applications_preference(self):
        self.login(self.lea.user)
        response = self.client.put(
            f"{LIST}/preferences", {"new_applications": False}, format="json"
        )
        self.assertFalse(response.json()["new_applications"])
        self.assertTrue(response.json()["messages"])
        response = self.client.put(
            f"{LIST}/preferences", {"new_applications": "non"}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("new_applications", response.json()["errors"])

    def test_preferences_are_per_recruiter(self):
        self.login(self.paul.user)
        self.client.put(f"{LIST}/preferences", {"email": False}, format="json")
        self.submit()
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.lea.user.email])


class RecruiterApiTests(RecruiterNotificationTestCase):
    def setUp(self):
        super().setUp()
        self.submit()
        self.send(self.student, "Bonjour Léa")
        self.submit(
            JobApplication.objects.create(
                student=self.other.student, offer=self.globex_offer
            )
        )
        self.login(self.lea.user)

    def test_list_and_unread_count_of_the_recruiter(self):
        body = self.client.get(LIST).json()
        self.assertEqual(
            [(n["kind"], n["title"]) for n in body["notifications"]],
            [
                ("message", "Nouveau message de Élodie Durand"),
                ("new_application", "Nouvelle candidature"),
            ],
        )
        self.assertEqual(body["unread_count"], 2)
        self.assertEqual(
            self.client.get(f"{LIST}/unread-count").json(), {"unread_count": 2}
        )

    def test_read_state_survives_a_reload(self):
        notification = Notification.objects.get(
            recipient=self.lea.user, kind=NotificationKind.NEW_APPLICATION
        )
        response = self.client.post(f"{LIST}/{notification.pk}/read")
        self.assertEqual(response.json()["unread_count"], 1)
        self.assertEqual(
            self.client.get(f"{LIST}/unread-count").json(), {"unread_count": 1}
        )
        self.assertEqual(
            [n["read"] for n in self.client.get(LIST).json()["notifications"]],
            [False, True],
        )

    def test_isolation_between_companies(self):
        theirs = Notification.objects.get(recipient=self.nora.user)
        self.assertEqual(self.client.post(f"{LIST}/{theirs.pk}/read").status_code, 404)
        self.client.post(f"{LIST}/read-all")
        self.assertIsNone(Notification.objects.get(pk=theirs.pk).read_at)

    def test_empty_list_of_a_colleague(self):
        self.login(self.paul.user)
        self.assertEqual(
            self.client.get(LIST).json(),
            {"notifications": [], "has_more": False, "unread_count": 0},
        )
