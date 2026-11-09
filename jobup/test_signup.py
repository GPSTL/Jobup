from rest_framework.test import APIClient, APITestCase

from .models import Recruiter, Role, SchoolManager, Student, User

PAYLOAD = {
    "email": "nouveau@example.fr",
    "password": "Example123",
    "first_name": "Nina",
    "last_name": "Vidal",
}


class SignupProfileTests(APITestCase):
    def signup(self, role, **extra):
        return self.client.post(
            "/api/signup", {**PAYLOAD, "role": role, **extra}, format="json"
        )

    def test_student_signup_creates_a_student(self):
        self.assertEqual(self.signup("Student").status_code, 201)
        user = User.objects.get(email=PAYLOAD["email"])
        self.assertEqual(user.role, Role.STUDENT)
        self.assertTrue(Student.objects.filter(user=user).exists())

    def test_recruiter_signup_creates_a_recruiter(self):
        self.assertEqual(self.signup("Recruiter").status_code, 201)
        self.assertTrue(Recruiter.objects.filter(user__email=PAYLOAD["email"]).exists())

    def test_school_manager_signup_creates_a_school_manager(self):
        self.assertEqual(self.signup("School Manager").status_code, 201)
        self.assertTrue(
            SchoolManager.objects.filter(user__email=PAYLOAD["email"]).exists()
        )

    def test_each_role_creates_only_its_own_profile(self):
        self.signup("Recruiter")
        user = User.objects.get(email=PAYLOAD["email"])
        self.assertFalse(Student.objects.filter(user=user).exists())
        self.assertFalse(SchoolManager.objects.filter(user=user).exists())

    def test_placeholder_organizations_are_shared(self):
        self.signup("Recruiter")
        self.client.post(
            "/api/signup",
            {**PAYLOAD, "email": "autre@example.fr", "role": "Recruiter"},
            format="json",
        )
        self.assertEqual(Recruiter.objects.count(), 2)
        self.assertEqual(Recruiter.objects.values("company").distinct().count(), 1)

    def test_invalid_signup_creates_nothing(self):
        self.assertEqual(self.signup("Student", password="x" * 0).status_code, 400)
        self.assertEqual((User.objects.count(), Student.objects.count()), (0, 0))

    def test_new_student_can_log_in_and_list_conversations(self):
        self.signup("Student")
        self.client.post(
            "/api/login",
            {"email": PAYLOAD["email"], "password": PAYLOAD["password"]},
            format="json",
        )
        response = self.client.get("/api/student/conversations")
        self.assertEqual((response.status_code, response.json()), (200, []))


# Connexion automatique après l'inscription (JOB-005)
class SignupLoginTests(APITestCase):
    def setUp(self):
        # Comme le front : jeton CSRF demandé avant l'inscription
        self.client = APIClient(enforce_csrf_checks=True)
        self.token = self.client.get("/api/csrf").json()["csrfToken"]

    def signup(self, **extra):
        return self.client.post(
            "/api/signup",
            {**PAYLOAD, "role": "Student", **extra},
            format="json",
            HTTP_X_CSRFTOKEN=self.token,
        )

    def test_signup_opens_the_session(self):
        response = self.signup()
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email=PAYLOAD["email"])
        self.assertEqual(response.json()["id"], user.pk)
        self.assertNotIn("password", response.json())
        # Connecté sans passer par /api/login
        me = self.client.get("/api/me")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["id"], user.pk)
        self.assertEqual(me.json()["role"], Role.STUDENT)
        # Le profil étudiant existe : les pages étudiant sont accessibles tout de suite
        conversations = self.client.get("/api/student/conversations")
        self.assertEqual((conversations.status_code, conversations.json()), (200, []))

    def test_refused_signup_does_not_open_a_session(self):
        User.objects.create_user(
            PAYLOAD["email"],
            "Other123",
            first_name="Nina",
            last_name="Existante",
            role=Role.STUDENT,
        )
        for extra in ({}, {"email": "pas-un-mail"}):
            self.assertEqual(self.signup(**extra).status_code, 400)
            self.assertEqual(self.client.get("/api/me").status_code, 403)
