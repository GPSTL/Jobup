from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from rest_framework.test import APITestCase

from .models import Role, Student, User

PASSWORD = "pw12345!"


class UserCreationTests(APITestCase):
    def test_password_is_hashed(self):
        user = User.objects.create_user(
            "a@mail.fr", PASSWORD, name="A", role=Role.STUDENT
        )
        self.assertNotEqual(user.password, PASSWORD)
        self.assertTrue(user.check_password(PASSWORD))

    def test_email_domain_is_normalized(self):
        user = User.objects.create_user(
            "a@MAIL.FR", PASSWORD, name="A", role=Role.STUDENT
        )
        self.assertEqual(user.email, "a@mail.fr")

    def test_duplicate_email_fails(self):
        User.objects.create_user("a@mail.fr", PASSWORD, name="A", role=Role.STUDENT)
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create_user(
                "a@mail.fr", PASSWORD, name="B", role=Role.RECRUITER
            )

    def test_empty_email_fails(self):
        with self.assertRaises(ValueError):
            User.objects.create_user("  ", PASSWORD, name="A", role=Role.STUDENT)

    def test_invalid_role_fails(self):
        user = User(email="a@mail.fr", name="A", role="hacker")
        with self.assertRaises(ValidationError) as ctx:
            user.full_clean(exclude=["password"])
        self.assertIn("role", ctx.exception.message_dict)

    def test_superuser_is_admin(self):
        admin = User.objects.create_superuser("admin@mail.fr", PASSWORD, name="Admin")
        self.assertEqual(admin.role, Role.ADMIN)
        self.assertTrue(admin.is_staff)


class AuthApiTests(APITestCase):
    def setUp(self):
        User.objects.create_user(
            "alice@mail.fr", PASSWORD, name="Alice", role=Role.STUDENT
        )

    def login(self, email: str, password: str = PASSWORD) -> int:
        return self.client.post(
            "/api/login", {"email": email, "password": password}, format="json"
        ).status_code

    def test_login_ok(self):
        response = self.client.post(
            "/api/login",
            {"email": "alice@mail.fr", "password": PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["role"], Role.STUDENT)

    def test_login_wrong_password(self):
        self.assertEqual(self.login("alice@mail.fr", "wrong"), 401)

    def test_login_unknown_email(self):
        self.assertEqual(self.login("nobody@mail.fr"), 401)

    def test_login_inactive_user(self):
        User.objects.create_user(
            "off@mail.fr", PASSWORD, name="Off", role=Role.STUDENT, is_active=False
        )
        self.assertEqual(self.login("off@mail.fr"), 401)

    def test_login_invalid_payload(self):
        response = self.client.post(
            "/api/login", {"email": "alice@mail.fr"}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_me_anonymous(self):
        self.assertEqual(self.client.get("/api/me").status_code, 403)

    def test_me_authenticated(self):
        self.login("alice@mail.fr")
        response = self.client.get("/api/me")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], "alice@mail.fr")

    def test_logout(self):
        self.login("alice@mail.fr")
        self.assertEqual(self.client.post("/api/logout").status_code, 204)
        self.assertEqual(self.client.get("/api/me").status_code, 403)


class StudentApiTests(APITestCase):
    def setUp(self):
        User.objects.create_user(
            "rec@mail.fr", PASSWORD, name="Rec", role=Role.RECRUITER
        )
        alice = User.objects.create_user(
            "alice@mail.fr", PASSWORD, name="Alice", role=Role.STUDENT
        )
        bob = User.objects.create_user(
            "bob@mail.fr", PASSWORD, name="Bob", role=Role.STUDENT
        )
        User.objects.create_superuser("admin@mail.fr", PASSWORD, name="Admin")
        self.alice_uid = Student.objects.create(
            user=alice, age=22, has_job=False
        ).user_id
        self.bob_uid = Student.objects.create(user=bob, age=25, has_job=True).user_id

    def login(self, email: str):
        response = self.client.post(
            "/api/login", {"email": email, "password": PASSWORD}, format="json"
        )
        self.assertEqual(response.status_code, 200)

    def test_anonymous_forbidden(self):
        response = self.client.get(f"/api/student/{self.alice_uid}")
        self.assertEqual(response.status_code, 403)

    def test_student_reads_own_sheet(self):
        self.login("alice@mail.fr")
        response = self.client.get(f"/api/student/{self.alice_uid}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "Alice")

    def test_student_cannot_read_other_sheet(self):
        self.login("alice@mail.fr")
        response = self.client.get(f"/api/student/{self.bob_uid}")
        self.assertEqual(response.status_code, 403)

    def test_recruiter_forbidden(self):
        self.login("rec@mail.fr")
        response = self.client.get(f"/api/student/{self.alice_uid}")
        self.assertEqual(response.status_code, 403)

    def test_admin_reads_any_sheet(self):
        self.login("admin@mail.fr")
        self.assertEqual(
            self.client.get(f"/api/student/{self.alice_uid}").status_code, 200
        )
        self.assertEqual(
            self.client.get(f"/api/student/{self.bob_uid}").status_code, 200
        )

    def test_unknown_student(self):
        self.login("admin@mail.fr")
        self.assertEqual(self.client.get("/api/student/9999").status_code, 404)
