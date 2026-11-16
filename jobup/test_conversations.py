from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import (
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

URL = "/api/student/conversations"
PASSWORD = "Example123"


class ConversationsTests(APITestCase):
    def setUp(self):
        self.student = self.makeStudent("eleve@example.fr", "Élodie", "Durand")
        acme = Company.objects.create(name="Acme", siret="12345678901234")
        blue = Company.objects.create(name="Blue Health", siret="22345678901234")
        school = School.objects.create(name="Université Paris")

        self.lea = Recruiter.objects.create(
            user=self.makeUser("lea@acme.fr", "Léa", "Martin", Role.RECRUITER),
            company=acme,
        )
        self.tom = Recruiter.objects.create(
            user=self.makeUser("tom@blue.fr", "Tom", "Petit", Role.RECRUITER),
            company=blue,
        )
        self.manager = SchoolManager.objects.create(
            user=self.makeUser("rel@univ.fr", "Inès", "Roux", Role.MANAGER),
            school=school,
        )

        now = timezone.now()
        self.with_lea = Conversation.objects.create(
            student=self.student, recruiter=self.lea
        )
        self.with_tom = Conversation.objects.create(
            student=self.student, recruiter=self.tom
        )
        self.with_school = Conversation.objects.create(
            student=self.student, school_manager=self.manager
        )
        # Dates fixées pour vérifier le tri : Tom (il y a 1 h), Léa (il y a 2 jours), école sans message (créée il y a 3 jours)
        self.message(
            self.with_lea, self.lea.user, "Bonjour Élodie", now - timedelta(days=3)
        )
        self.message(
            self.with_lea,
            self.student.user,
            "Merci pour votre retour !",
            now - timedelta(days=2),
        )
        self.message(
            self.with_tom, self.tom.user, "Disponible jeudi ?", now - timedelta(hours=1)
        )
        Conversation.objects.filter(pk=self.with_school.pk).update(
            created_at=now - timedelta(days=3, hours=1)
        )

        # Conversation d'un autre étudiant, jamais visible
        other = self.makeStudent("autre@example.fr", "Marc", "Blanc")
        self.message(
            Conversation.objects.create(student=other, recruiter=self.lea),
            self.lea.user,
            "Privé",
            now,
        )

    def makeUser(self, email, first_name, last_name, role):
        return User.objects.create_user(
            email, PASSWORD, first_name=first_name, last_name=last_name, role=role
        )

    def makeStudent(self, email, first_name, last_name):
        return Student.objects.create(
            user=self.makeUser(email, first_name, last_name, Role.STUDENT)
        )

    def message(self, conversation, sender, body, at):
        message = Message.objects.create(
            conversation=conversation, sender=sender, body=body
        )
        Message.objects.filter(pk=message.pk).update(created_at=at)

    def login(self, email="eleve@example.fr"):
        self.client.post(
            "/api/login", {"email": email, "password": PASSWORD}, format="json"
        )

    def ids(self, response):
        return [conversation["id"] for conversation in response.json()]

    def test_most_recent_activity_first_including_conversations_without_message(self):
        self.login()
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self.ids(response),
            [self.with_tom.pk, self.with_lea.pk, self.with_school.pk],
        )

    def test_summary_shows_interlocutor_and_last_message(self):
        self.login()
        tom, lea, school = self.client.get(URL).json()
        self.assertEqual(
            tom["interlocutor"],
            {
                "kind": "recruiter",
                "first_name": "Tom",
                "last_name": "Petit",
                "organization": "Blue Health",
            },
        )
        self.assertEqual(
            (tom["last_message"]["body"], tom["last_message"]["from_me"]),
            ("Disponible jeudi ?", False),
        )
        self.assertEqual(
            (lea["last_message"]["body"], lea["last_message"]["from_me"]),
            ("Merci pour votre retour !", True),
        )
        self.assertEqual(
            school["interlocutor"],
            {
                "kind": "school",
                "first_name": "Inès",
                "last_name": "Roux",
                "organization": "Université Paris",
            },
        )
        self.assertIsNone(school["last_message"])

    def test_summary_follows_a_new_message(self):
        self.login()
        self.message(
            self.with_school,
            self.manager.user,
            "Votre convention est prête",
            timezone.now(),
        )
        first = self.client.get(URL).json()[0]
        self.assertEqual(first["id"], self.with_school.pk)
        self.assertEqual(first["last_message"]["body"], "Votre convention est prête")

    def test_search_by_name_company_or_school(self):
        self.login()
        self.assertEqual(
            self.ids(self.client.get(URL, {"q": "martin"})), [self.with_lea.pk]
        )
        self.assertEqual(
            self.ids(self.client.get(URL, {"q": "  léa   ACME "})), [self.with_lea.pk]
        )
        self.assertEqual(
            self.ids(self.client.get(URL, {"q": "blue"})), [self.with_tom.pk]
        )
        self.assertEqual(
            self.ids(self.client.get(URL, {"q": "Inès"})), [self.with_school.pk]
        )
        self.assertEqual(
            self.ids(self.client.get(URL, {"q": "université"})), [self.with_school.pk]
        )

    def test_search_ignores_case_and_accents(self):
        self.login()
        for query in ("lea", "LÉA", "léa", "LEA ACME"):
            self.assertEqual(
                self.ids(self.client.get(URL, {"q": query})), [self.with_lea.pk], query
            )
        self.assertEqual(
            self.ids(self.client.get(URL, {"q": "ines"})), [self.with_school.pk]
        )
        self.assertEqual(
            self.ids(self.client.get(URL, {"q": "UNIVERSITE"})), [self.with_school.pk]
        )

    def test_search_without_result_and_empty_search(self):
        self.login()
        self.assertEqual(self.client.get(URL, {"q": "introuvable"}).json(), [])
        self.assertEqual(len(self.client.get(URL, {"q": "   "}).json()), 3)

    def test_other_students_conversations_are_never_listed(self):
        self.login("autre@example.fr")
        conversations = self.client.get(URL).json()
        self.assertEqual(len(conversations), 1)
        self.assertEqual(conversations[0]["last_message"]["body"], "Privé")
        self.login()
        self.assertNotIn(
            "Privé",
            [
                c["last_message"]["body"]
                for c in self.client.get(URL).json()
                if c["last_message"]
            ],
        )

    def test_student_without_conversation(self):
        self.makeStudent("nouveau@example.fr", "Nina", "Vidal")
        self.login("nouveau@example.fr")
        self.assertEqual(self.client.get(URL).json(), [])

    def test_anonymous_and_other_roles_are_refused(self):
        self.assertEqual(self.client.get(URL).status_code, 403)
        self.login("lea@acme.fr")
        self.assertEqual(self.client.get(URL).status_code, 403)

    def test_a_conversation_has_exactly_one_interlocutor(self):
        for fields in ({}, {"recruiter": self.lea, "school_manager": self.manager}):
            with self.assertRaises(IntegrityError), transaction.atomic():
                Conversation.objects.create(student=self.student, **fields)

    def test_one_conversation_per_student_and_interlocutor(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Conversation.objects.create(student=self.student, recruiter=self.lea)
