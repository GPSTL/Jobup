from rest_framework.test import APITestCase

from .models import (
    MESSAGE_MAX_LENGTH,
    Company,
    Conversation,
    Message,
    Recruiter,
    Role,
    School,
    SchoolManager,
    Student,
    User,
)

PASSWORD = "Example123"


class MessagesTests(APITestCase):
    def setUp(self):
        self.student = self.makeStudent("eleve@example.fr", "Élodie", "Durand")
        acme = Company.objects.create(name="Acme", siret="12345678901234")
        school = School.objects.create(name="Université Paris")
        self.lea = Recruiter.objects.create(
            user=self.makeUser("lea@acme.fr", "Léa", "Martin", Role.RECRUITER),
            company=acme,
        )
        self.manager = SchoolManager.objects.create(
            user=self.makeUser("rel@univ.fr", "Inès", "Roux", Role.MANAGER),
            school=school,
        )
        self.conversation = Conversation.objects.create(
            student=self.student, recruiter=self.lea
        )
        self.with_school = Conversation.objects.create(
            student=self.student, school_manager=self.manager
        )
        self.url = self.urlOf(self.conversation)

        other = self.makeStudent("autre@example.fr", "Marc", "Blanc")
        self.private = Conversation.objects.create(student=other, recruiter=self.lea)

    def makeUser(self, email, first_name, last_name, role):
        return User.objects.create_user(
            email, PASSWORD, first_name=first_name, last_name=last_name, role=role
        )

    def makeStudent(self, email, first_name, last_name):
        return Student.objects.create(
            user=self.makeUser(email, first_name, last_name, Role.STUDENT)
        )

    def urlOf(self, conversation):
        return f"/api/conversations/{conversation.pk}/messages"

    def login(self, email="eleve@example.fr"):
        self.client.post(
            "/api/login", {"email": email, "password": PASSWORD}, format="json"
        )

    def send(self, body="Bonjour", url=None):
        return self.client.post(url or self.url, {"body": body}, format="json")

    def fill(self, count, conversation=None):
        sender = self.student.user
        return [
            Message.objects.create(
                conversation=conversation or self.conversation,
                sender=sender,
                body=f"m{i}",
            ).pk
            for i in range(count)
        ]

    def ids(self, response):
        return [message["id"] for message in response.json()["messages"]]

    def test_anonymous_is_refused(self):
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.assertEqual(
            self.client.post(self.url, {"body": "Bonjour"}, format="json").status_code,
            403,
        )

    def test_only_participants_can_read_or_send(self):
        self.fill(1, self.private)
        self.login()
        self.assertEqual(self.client.get(self.urlOf(self.private)).status_code, 404)
        self.assertEqual(self.send(url=self.urlOf(self.private)).status_code, 404)
        self.assertEqual(
            self.client.get("/api/conversations/9999/messages").status_code, 404
        )
        self.assertEqual(Message.objects.filter(conversation=self.private).count(), 1)

        self.login("lea@acme.fr")
        self.assertEqual(self.client.get(self.urlOf(self.with_school)).status_code, 404)
        self.makeUser("admin@example.fr", "Jean", "Taire", Role.ADMIN)
        self.login("admin@example.fr")
        self.assertEqual(self.client.get(self.url).status_code, 404)

    def test_each_kind_of_participant_has_access(self):
        self.login()
        self.assertEqual(self.client.get(self.url).status_code, 200)
        self.assertEqual(self.client.get(self.urlOf(self.with_school)).status_code, 200)
        self.login("lea@acme.fr")
        self.assertEqual(self.client.get(self.url).status_code, 200)
        self.login("rel@univ.fr")
        self.assertEqual(self.client.get(self.urlOf(self.with_school)).status_code, 200)

    def test_send_keeps_sender_and_server_timestamp(self):
        self.login()
        response = self.send("  Bonjour  ")
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual((body["body"], body["from_me"]), ("Bonjour", True))
        saved = Message.objects.get(pk=body["id"])
        self.assertEqual(
            (saved.sender, saved.conversation), (self.student.user, self.conversation)
        )
        self.assertEqual(
            saved.created_at.isoformat(), body["created_at"].replace("Z", "+00:00")
        )

    def test_sent_message_appears_after_reload(self):
        self.login()
        sent = self.send().json()
        self.assertEqual(self.ids(self.client.get(self.url)), [sent["id"]])

    def test_from_me_depends_on_the_viewer(self):
        self.login()
        self.send("Question")
        self.login("lea@acme.fr")
        self.assertEqual(self.send("Réponse").status_code, 201)
        self.assertEqual(
            [m["from_me"] for m in self.client.get(self.url).json()["messages"]],
            [False, True],
        )
        self.login()
        self.assertEqual(
            [m["from_me"] for m in self.client.get(self.url).json()["messages"]],
            [True, False],
        )

    def test_empty_or_too_long_message_is_refused(self):
        self.login()
        for body in ("", "   \n ", "a" * (MESSAGE_MAX_LENGTH + 1)):
            self.assertEqual(self.send(body).status_code, 400)
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 400)
        self.assertEqual(Message.objects.count(), 0)
        self.assertEqual(self.send("a" * MESSAGE_MAX_LENGTH).status_code, 201)

    def test_latest_messages_are_chronological(self):
        self.login()
        created = self.fill(3)
        response = self.client.get(self.url)
        self.assertEqual(self.ids(response), created)
        self.assertFalse(response.json()["has_more"])
        self.assertEqual(
            self.client.get(self.urlOf(self.with_school)).json(),
            {"messages": [], "has_more": False},
        )

    def test_history_pagination_loses_and_duplicates_nothing(self):
        self.login()
        created = self.fill(5)
        first = self.client.get(self.url, {"limit": 2})
        self.assertEqual(self.ids(first), created[3:])
        self.assertTrue(first.json()["has_more"])
        older = self.client.get(self.url, {"limit": 2, "before": created[3]})
        self.assertEqual(self.ids(older), created[1:3])
        self.assertTrue(older.json()["has_more"])
        oldest = self.client.get(self.url, {"limit": 2, "before": created[1]})
        self.assertEqual(self.ids(oldest), created[:1])
        self.assertFalse(oldest.json()["has_more"])

    def test_refresh_returns_messages_after_the_cursor(self):
        self.login()
        created = self.fill(4)
        news = self.client.get(self.url, {"after": created[0], "limit": 2})
        self.assertEqual(self.ids(news), created[1:3])
        self.assertTrue(news.json()["has_more"])
        rest = self.client.get(self.url, {"after": created[2]})
        self.assertEqual(self.ids(rest), created[3:])
        self.assertFalse(rest.json()["has_more"])
        self.assertEqual(
            self.ids(self.client.get(self.url, {"after": created[-1]})), []
        )

    def test_other_conversations_messages_are_never_mixed_in(self):
        self.login()
        self.fill(2, self.private)
        mine = self.fill(1)
        self.assertEqual(self.ids(self.client.get(self.url)), mine)

    def test_invalid_query_is_refused(self):
        self.login()
        for query in (
            {"limit": 0},
            {"limit": 101},
            {"before": "x"},
            {"after": "x"},
            {"before": 3, "after": 1},
        ):
            self.assertEqual(self.client.get(self.url, query).status_code, 400)

    def test_new_message_updates_the_conversation_summary(self):
        self.login()
        self.send("Merci !")
        first = self.client.get("/api/student/conversations").json()[0]
        self.assertEqual(first["id"], self.conversation.pk)
        self.assertEqual(
            (first["last_message"]["body"], first["last_message"]["from_me"]),
            ("Merci !", True),
        )
