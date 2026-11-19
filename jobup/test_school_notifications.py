# Notifications de l'école (JOB-050, ECO-21) : nouvelle demande, message d'un étudiant et
# contrat déposé ; compteur, lecture, préférences et e-mail, sur le socle commun (JOB-042)
import tempfile

from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile

from .models import (
    ApplicationStatus,
    Conversation,
    Notification,
    NotificationKind,
    NotificationPreference,
    SchoolManager,
    SchoolRequest,
    Student,
)
from .test_login import USERS
from .test_resume import PDF
from .test_school import RECRUITER_APPLICATION, SCHOOL, SchoolTestCase


class SchoolNotificationTests(SchoolTestCase):
    def setUp(self):
        super().setUp()
        private = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(self.settings(PRIVATE_MEDIA_ROOT=private))
        # Deuxième employé de la même école : il reçoit aussi demandes et contrats
        self.colleague = SchoolManager.objects.create(
            user=self.user(
                USERS[0], email="marc@ecole.fr", role=self.manager.user.role
            ),
            school=self.school,
        )

    def ask(self, student):
        self.login(student.user)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(
                "/api/student/school-request",
                {"school_id": self.school.pk},
                format="json",
            )

    def deposit(self, application):
        self.login(self.recruiter.user)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(
                f"{RECRUITER_APPLICATION}/{application.pk}/contract",
                {
                    "file": SimpleUploadedFile("contrat.pdf", PDF),
                    "start_date": "2099-09-01",
                    "end_date": "2100-08-31",
                },
                format="multipart",
            )

    def write(self, conversation, sender, body="Bonjour"):
        self.login(sender)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(
                f"/api/conversations/{conversation.pk}/messages",
                {"body": body},
                format="json",
            )

    def kinds(self, user):
        return [notification.kind for notification in self.notificationsOf(user)]

    def test_new_request_notifies_every_manager_of_that_school_only(self):
        self.assertEqual(self.ask(self.bob).status_code, 201)
        for manager in (self.manager, self.colleague):
            (notification,) = self.notificationsOf(manager.user)
            self.assertEqual(notification.kind, NotificationKind.SCHOOL_REQUEST)
            self.assertEqual(notification.title, "Nouvelle demande de rattachement")
            self.assertEqual(notification.link, "/school/students")
        self.assertEqual(self.notificationsOf(self.other_manager.user), [])

    def test_a_new_request_after_a_refusal_notifies_again_without_duplicate(self):
        self.ask(self.bob)
        request = SchoolRequest.objects.get(student=self.bob)
        self.login(self.manager.user)
        self.client.patch(
            f"{SCHOOL}/requests/{request.pk}", {"status": "refused"}, format="json"
        )
        self.ask(self.bob)
        self.assertEqual(
            self.kinds(self.manager.user), [NotificationKind.SCHOOL_REQUEST] * 2
        )

    def test_student_message_notifies_only_the_manager_of_the_conversation(self):
        conversation = Conversation.objects.create(
            student=self.alice, school_manager=self.manager
        )
        self.assertEqual(self.write(conversation, self.alice.user).status_code, 201)
        (notification,) = self.notificationsOf(self.manager.user)
        self.assertEqual(notification.kind, NotificationKind.MESSAGE)
        self.assertEqual(notification.link, f"/school/messages/{conversation.pk}")
        self.assertEqual(self.notificationsOf(self.colleague.user), [])
        # Son propre message ne le notifie pas
        self.write(conversation, self.manager.user)
        self.assertEqual(len(self.notificationsOf(self.manager.user)), 1)

    def test_deposited_and_replaced_contracts_notify_the_school(self):
        application = self.apply(self.alice, ApplicationStatus.ACCEPTED)
        self.deposit(application)
        self.deposit(application)
        titles = [n.title for n in self.notificationsOf(self.manager.user)]
        self.assertEqual(
            titles, ["Nouveau contrat à valider", "Contrat remplacé à valider"]
        )
        self.assertEqual(self.notificationsOf(self.other_manager.user), [])

    def test_no_contract_notification_to_a_school_the_student_left(self):
        application = self.apply(self.alice, ApplicationStatus.ACCEPTED)
        self.deposit(application)
        # Retirée par son école, puis rattachée à une autre
        Student.objects.filter(pk=self.alice.pk).update(school=self.other_school)
        Notification.objects.all().delete()
        # Le recruteur remplace le contrat : l'ancienne école n'y a plus accès (JOB-049),
        # elle n'est pas notifiée
        self.assertEqual(self.deposit(application).status_code, 200)
        self.assertEqual(self.notificationsOf(self.manager.user), [])
        self.assertEqual(self.notificationsOf(self.colleague.user), [])
        (for_student,) = self.notificationsOf(self.alice.user)
        self.assertEqual(for_student.title, "Contrat remplacé")

    def test_preferences_turn_each_kind_off(self):
        NotificationPreference.objects.create(
            user=self.manager.user, school_updates=False, messages=False
        )
        conversation = Conversation.objects.create(
            student=self.alice, school_manager=self.manager
        )
        self.ask(self.bob)
        self.deposit(self.apply(self.alice, ApplicationStatus.ACCEPTED))
        self.write(conversation, self.alice.user)
        self.assertEqual(self.notificationsOf(self.manager.user), [])
        # Son collègue garde les siennes
        self.assertEqual(len(self.notificationsOf(self.colleague.user)), 2)

    def test_email_follows_the_preference_and_is_off_by_default(self):
        self.ask(self.bob)
        self.assertEqual(mail.outbox, [])
        self.login(self.manager.user)
        response = self.client.put(
            "/api/notifications/preferences", {"email": True}, format="json"
        )
        self.assertTrue(response.json()["email"])
        Notification.objects.all().delete()
        SchoolRequest.objects.all().delete()
        self.ask(self.bob)
        (email,) = mail.outbox
        self.assertEqual(email.to, [self.manager.user.email])
        self.assertIn("Nouvelle demande de rattachement", email.subject)
        self.assertIn("/school/students", email.body)

    def test_unread_count_read_and_read_all_for_the_school(self):
        self.ask(self.bob)
        self.deposit(self.apply(self.alice, ApplicationStatus.ACCEPTED))
        self.login(self.manager.user)
        self.assertEqual(
            self.client.get("/api/notifications/unread-count").json(),
            {"unread_count": 2},
        )
        first = self.notificationsOf(self.manager.user)[0]
        response = self.client.post(f"/api/notifications/{first.pk}/read")
        self.assertEqual(response.json()["unread_count"], 1)
        listed = self.client.get("/api/notifications").json()
        self.assertEqual(len(listed["notifications"]), 2)
        self.client.post("/api/notifications/read-all")
        self.assertEqual(
            self.client.get("/api/notifications/unread-count").json()["unread_count"],
            0,
        )
        # Le compteur du collègue ne bouge pas
        self.login(self.colleague.user)
        self.assertEqual(
            self.client.get("/api/notifications/unread-count").json()["unread_count"],
            2,
        )

    def test_a_manager_cannot_read_the_notifications_of_another(self):
        self.ask(self.bob)
        mine = self.notificationsOf(self.manager.user)[0]
        self.login(self.other_manager.user)
        self.assertEqual(
            self.client.post(f"/api/notifications/{mine.pk}/read").status_code, 404
        )
        self.assertEqual(
            self.client.get("/api/notifications").json()["notifications"], []
        )
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/notifications").status_code, 403)
