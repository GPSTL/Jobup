from unittest.mock import patch

from django.test import Client, TestCase

from .models import Role, Student, User


class SignupTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.token = self.client.get("/api/csrf").json()["csrfToken"]
        self.payload = {"prenom": " Élodie ", "nom": "D'Angelo", "email": " Test@Example.fr ", "password": "Example123"}

    def signup(self, payload=None):
        return self.client.post("/api/signup", self.payload if payload is None else payload,
                                content_type="application/json", HTTP_X_CSRFTOKEN=self.token)

    def test_creates_student_without_removed_fields_and_can_login(self):
        response = self.signup()
        self.assertEqual(response.status_code, 201)
        user = User.objects.get()
        self.assertEqual(user.email, "test@example.fr")
        self.assertEqual(user.first_name, "Élodie")
        self.assertEqual(user.role, Role.STUDENT)
        self.assertTrue(user.check_password(self.payload["password"]))
        self.assertNotIn("password", response.json())
        self.assertIsNone(user.student.school_id)
        self.assertIsNone(user.student.category)
        self.assertIsNone(user.student.study_degree)
        login = self.client.post("/api/login", {"email": user.email, "password": self.payload["password"]}, content_type="application/json")
        self.assertEqual(login.status_code, 200)
        self.assertEqual(self.client.get("/api/me").json()["id"], user.pk)

    def test_case_insensitive_duplicate_preserves_existing_profile(self):
        user = User.objects.create_user("TEST@example.fr", "Other123", role=Role.STUDENT)
        profile = Student.objects.create(user=user, category=2, study_degree=4, description="À conserver")
        self.assertEqual(self.signup().status_code, 409)
        self.assertEqual(self.signup().json()["errors"]["email"], "Cette adresse e-mail est déjà utilisée.")
        self.assertEqual(User.objects.count(), 1)
        profile.refresh_from_db()
        self.assertEqual((profile.category, profile.study_degree, profile.description), (2, 4, "À conserver"))

    def test_invalid_fields_cannot_bypass_client_validation(self):
        for field, value in (("prenom", ""), ("nom", "123"), ("email", "invalid"), ("password", "short"), ("password", "lowercase123"), ("password", "NoDigitsHere"), ("prenom", "a" * 33), ("email", None)):
            with self.subTest(field=field, value=value):
                response = self.signup({**self.payload, field: value})
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json()["errors"])
        self.assertEqual(User.objects.count(), 0)

    def test_missing_and_malformed_payloads(self):
        self.assertEqual(set(self.signup({}).json()["errors"]), {"prenom", "nom", "email", "password"})
        self.assertEqual(self.signup([]).status_code, 400)

    def test_role_is_assigned_by_server(self):
        response = self.signup({**self.payload, "role": "admin"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(User.objects.get().role, Role.STUDENT)

    def test_profile_failure_rolls_back_user(self):
        with patch("jobup.signup.Student.objects.create", side_effect=RuntimeError("profile unavailable")):
            with self.assertRaises(RuntimeError):
                self.signup()
        self.assertEqual(User.objects.count(), 0)

    def test_csrf_is_required(self):
        response = self.client.post("/api/signup", self.payload, content_type="application/json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(User.objects.count(), 0)
