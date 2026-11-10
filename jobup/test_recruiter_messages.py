# Recruiter side of the messaging (JOB-039, REC-05): list of the conversations with the
# presence of the candidates, and the presence itself (jobup/presence.py)
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Company, Conversation, Message, Recruiter, Role, Student, User
from .presence import secondsSinceSeen

PASSWORD = "Example123"
LIST = "/api/recruiter/conversations"


class RecruiterMessagingTestCase(APITestCase):
    def setUp(self):
        acme = Company.objects.create(name="Acme", siret="12345678901234")
        self.lea = Recruiter.objects.create(
            user=self.makeUser("lea@acme.fr", "Léa", "Martin", Role.RECRUITER),
            company=acme,
        )
        # Colleague of the same company: her conversations are not Léa's
        self.colleague = Recruiter.objects.create(
            user=self.makeUser("rh@acme.fr", "Rose", "Petit", Role.RECRUITER),
            company=acme,
        )
        self.lucas = self.makeStudent("lucas@example.fr", "Lucas", "Martin")
        self.sarah = self.makeStudent("sarah@example.fr", "Sarah", "Benali")
        self.with_lucas = Conversation.objects.create(
            student=self.lucas, recruiter=self.lea
        )
        self.with_sarah = Conversation.objects.create(
            student=self.sarah, recruiter=self.lea
        )
        self.colleagues = Conversation.objects.create(
            student=self.lucas, recruiter=self.colleague
        )

    def makeUser(self, email, first_name, last_name, role):
        return User.objects.create_user(
            email, PASSWORD, first_name=first_name, last_name=last_name, role=role
        )

    def makeStudent(self, email, first_name, last_name):
        return Student.objects.create(
            user=self.makeUser(email, first_name, last_name, Role.STUDENT)
        )

    def login(self, email="lea@acme.fr"):
        self.client.post(
            "/api/login", {"email": email, "password": PASSWORD}, format="json"
        )

    def seen(self, student: Student, seconds_ago: int):
        User.objects.filter(pk=student.user.pk).update(
            last_seen_at=timezone.now() - timedelta(seconds=seconds_ago)
        )

    def lastSeen(self, student: Student):
        return User.objects.get(pk=student.user.pk).last_seen_at

    def conversations(self):
        return {item["id"]: item for item in self.client.get(LIST).json()}


class RecruiterConversationListTests(RecruiterMessagingTestCase):
    def test_only_recruiters(self):
        self.assertEqual(self.client.get(LIST).status_code, 403)
        self.login("lucas@example.fr")
        self.assertEqual(self.client.get(LIST).status_code, 403)
        self.makeUser("admin@example.fr", "Jean", "Taire", Role.ADMIN)
        self.login("admin@example.fr")
        self.assertEqual(self.client.get(LIST).status_code, 403)

    def test_only_the_conversations_of_the_recruiter(self):
        self.login()
        response = self.client.get(LIST)
        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.json()]
        self.assertCountEqual(ids, [self.with_lucas.pk, self.with_sarah.pk])
        self.login("rh@acme.fr")
        self.assertEqual(list(self.conversations()), [self.colleagues.pk])

    def test_candidate_is_the_account_and_last_message(self):
        # The profile passes the account id in ?candidate=<id>, not the Student one
        self.assertNotEqual(self.lucas.pk, self.lucas.user.pk)
        Message.objects.create(
            conversation=self.with_lucas, sender=self.lucas.user, body="Bonjour !"
        )
        self.login()
        item = self.conversations()[self.with_lucas.pk]
        self.assertEqual(
            item["candidate"],
            {"id": self.lucas.user.pk, "first_name": "Lucas", "last_name": "Martin"},
        )
        self.assertEqual(
            (item["last_message"]["body"], item["last_message"]["from_me"]),
            ("Bonjour !", False),
        )
        # No message yet
        self.assertIsNone(self.conversations()[self.with_sarah.pk]["last_message"])

    def test_most_recently_active_first(self):
        Message.objects.create(
            conversation=self.with_lucas, sender=self.lea.user, body="Bonjour Lucas"
        )
        self.login()
        ids = [item["id"] for item in self.client.get(LIST).json()]
        self.assertEqual(ids, [self.with_lucas.pk, self.with_sarah.pk])
        Message.objects.create(
            conversation=self.with_sarah, sender=self.sarah.user, body="Bonjour"
        )
        ids = [item["id"] for item in self.client.get(LIST).json()]
        self.assertEqual(ids, [self.with_sarah.pk, self.with_lucas.pk])

    def test_send_and_receive_through_the_shared_thread(self):
        thread = f"/api/conversations/{self.with_lucas.pk}/messages"
        self.login()
        sent = self.client.post(thread, {"body": "Bonjour Lucas"}, format="json")
        self.assertEqual(sent.status_code, 201)
        self.assertTrue(
            self.conversations()[self.with_lucas.pk]["last_message"]["from_me"]
        )

        # Lucas receives it in the same thread, and answers
        self.login("lucas@example.fr")
        received = self.client.get(thread).json()["messages"]
        self.assertEqual(
            [(m["body"], m["from_me"]) for m in received], [("Bonjour Lucas", False)]
        )
        self.client.post(thread, {"body": "Bonjour !"}, format="json")

        self.login()
        last = self.conversations()[self.with_lucas.pk]["last_message"]
        self.assertEqual((last["body"], last["from_me"]), ("Bonjour !", False))
        # Messages are only in the shared thread: nothing in the colleague's one
        self.assertFalse(Message.objects.filter(conversation=self.colleagues).exists())


class PresenceTests(RecruiterMessagingTestCase):
    def presenceOf(self, conversation: Conversation):
        return self.conversations()[conversation.pk]["seen_seconds_ago"]

    def test_never_seen(self):
        self.login()
        self.assertIsNone(self.presenceOf(self.with_lucas))

    def test_transitions(self):
        # Lucas logs in: seen just now (« En ligne » for the front end)
        self.login("lucas@example.fr")
        self.login()
        self.assertLess(self.presenceOf(self.with_lucas), 5)

        # Three minutes without a request (« Hors ligne »)
        self.seen(self.lucas, seconds_ago=180)
        self.assertGreaterEqual(self.presenceOf(self.with_lucas), 180)

        # Any request of Lucas, e.g. the heartbeat of his pages, brings him back
        self.login("lucas@example.fr")
        self.seen(self.lucas, seconds_ago=180)
        self.client.get("/api/me")
        self.login()
        self.assertLess(self.presenceOf(self.with_lucas), 5)

    def test_at_most_one_write_per_30_seconds(self):
        self.login("lucas@example.fr")
        self.seen(self.lucas, seconds_ago=10)
        before = self.lastSeen(self.lucas)
        self.client.get("/api/me")
        self.assertEqual(self.lastSeen(self.lucas), before)

        self.seen(self.lucas, seconds_ago=31)
        before = self.lastSeen(self.lucas)
        self.client.get("/api/me")
        after = self.lastSeen(self.lucas)
        assert before is not None and after is not None
        self.assertGreater(after, before)

    def test_anonymous_requests_and_logout_record_nothing(self):
        self.client.get("/api/csrf")
        self.assertFalse(User.objects.filter(last_seen_at__isnull=False).exists())

        self.login("lucas@example.fr")
        self.seen(self.lucas, seconds_ago=60)
        before = self.lastSeen(self.lucas)
        self.client.post("/api/logout")
        self.assertEqual(self.lastSeen(self.lucas), before)

    def test_age_never_negative(self):
        user = self.lucas.user
        now = timezone.now()
        user.last_seen_at = now + timedelta(seconds=5)
        self.assertEqual(secondsSinceSeen(user, now), 0)
        user.last_seen_at = now - timedelta(seconds=90)
        self.assertEqual(secondsSinceSeen(user, now), 90)
