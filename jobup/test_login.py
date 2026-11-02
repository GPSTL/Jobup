import copy
from collections.abc import Iterable
from typing import Any, Self

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from rest_framework.test import APITestCase

from .models import Role, Student, User, getUser


class UserFactory:
    def __init__(
        self, email: str, password: str, name: str, first_name: str, role: Role
    ):
        self.email = email
        self.password = password
        self.name = name
        self.first_name = first_name
        self.role = role

    def keys(self) -> Iterable[str]:
        return vars(self).keys()

    def __getitem__(self, key: str) -> Any:
        return vars(self)[key]

    def fork(self, **attribs) -> Self:
        new = copy.copy(self)
        for name, value in attribs.items():
            if not hasattr(new, name):
                raise AttributeError(f"{type(self).__name__} has no attribute {name!r}")
            setattr(new, name, value)
        return new

    def login(self, tc: APITestCase) -> int:
        return tc.client.post(
            "/api/login",
            {"email": self.email, "password": self.password},
            format="json",
        ).status_code


USERS = [
    UserFactory("alicep@mail.fr", "ALiceDu93.", "Plancher", "Alice", Role.STUDENT),
    UserFactory("boby@mails.com", "pw12345!", "Ni", "Bob", Role.STUDENT),
    UserFactory("admin@jobup.io", "VerySecurePassword", "Jean", "Taire", Role.ADMIN),
    UserFactory("plastique@thales.org", "@Im6)4=jg,?1", "Passe", "Tek", Role.RECRUITER),
]


class UserCreationTests(APITestCase):
    def test_password_is_hashed(self):
        user = User.objects.create_user(**USERS[0])
        self.assertNotEqual(user.password, USERS[0].password)
        self.assertTrue(user.check_password(USERS[0].password))
        self.assertNotIn("password", user.to_dict())

    def test_email_domain_is_normalized(self):
        user = User.objects.create_user(**USERS[0].fork(email="a@MAIL.FR"))
        self.assertEqual(user.email, "a@mail.fr")

    def test_duplicate_email_fails(self):
        User.objects.create_user(**USERS[0])
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create_user(**USERS[0].fork(role=Role.RECRUITER))

    def test_empty_email_fails(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(**USERS[0].fork(email="  "))

    def test_invalid_role_fails(self):
        user = User(**USERS[0].fork(role="hacker"))
        with self.assertRaises(ValidationError) as ctx:
            user.full_clean(exclude=["password"])
            self.assertIn("role", ctx.exception.message_dict)

        user2 = User(**USERS[0].fork(role=99))
        with self.assertRaises(ValidationError) as ctx:
            user2.full_clean(exclude=["password"])
            self.assertIn("role", ctx.exception.message_dict)

    def test_superuser_is_admin(self):
        admin = User.objects.create_superuser(**USERS[2])
        self.assertEqual(admin.role, Role.ADMIN)
        self.assertEqual(admin.is_superuser, True)

    def test_user_without_name(self):
        with self.assertRaises(ValidationError):
            User.objects.create_user(**USERS[0].fork(first_name=""))

    def test_getting_user(self):
        self.assertIsNone(getUser(0))
        User.objects.create_user(**USERS[0])
        self.assertEqual(u.email if (u := getUser(1)) else "", USERS[0].email)


class AuthApiTests(APITestCase):
    def setUp(self):
        User.objects.create_user(**USERS[0])

    def test_login_ok(self):
        response = self.client.post(
            "/api/login",
            {"email": USERS[0].email, "password": USERS[0].password},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["role"], Role.STUDENT)

    def test_login_wrong_password(self):
        self.assertEqual(USERS[0].fork(password="wrong").login(self), 401)

    def test_login_unknown_email(self):
        self.assertEqual(USERS[0].fork(email="nobody@mail.fr").login(self), 401)

    def test_login_invalid_payload(self):
        self.assertEqual(
            self.client.post(
                "/api/login", {"email": USERS[0].email}, format="json"
            ).status_code,
            400,
        )

        self.assertEqual(
            self.client.post(
                "/api/login", {"password": USERS[0].password}, format="json"
            ).status_code,
            400,
        )

        self.assertEqual(
            self.client.post(
                "/api/login", {"email": USERS[0].email, "password": 345}, format="json"
            ).status_code,
            400,
        )

        self.assertEqual(
            self.client.post(
                "/api/login", {"email": USERS[0].email, "password": True}, format="json"
            ).status_code,
            400,
        )

    def test_me_anonymous(self):
        self.assertEqual(self.client.get("/api/me").status_code, 403)

    def test_me_authenticated(self):
        USERS[0].login(self)
        response = self.client.get("/api/me")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], USERS[0].email)

    def test_logout(self):
        USERS[0].login(self)
        self.assertEqual(self.client.post("/api/logout").status_code, 204)
        self.assertEqual(self.client.get("/api/me").status_code, 403)


class StudentApiTests(APITestCase):
    def setUp(self):
        User.objects.create_user(**USERS[3])
        alice = User.objects.create_user(**USERS[0])
        bob = User.objects.create_user(**USERS[1])
        User.objects.create_superuser(**USERS[2])
        Student.objects.create(user=alice, age=22)
        Student.objects.create(user=bob, age=25)
        self.alice_uid = alice.id
        self.bob_uid = bob.id

    def test_anonymous_forbidden(self):
        response = self.client.get(f"/api/student/{self.alice_uid}")
        self.assertEqual(response.status_code, 403)

    def test_student_reads_own_sheet(self):
        USERS[0].login(self)
        response = self.client.get(f"/api/student/{self.alice_uid}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["age"], 22)

    def test_student_cannot_read_other_sheet(self):
        USERS[0].login(self)
        response = self.client.get(f"/api/student/{self.bob_uid}")
        self.assertEqual(response.status_code, 403)

    def test_recruiter_forbidden(self):
        USERS[3].login(self)
        response = self.client.get(f"/api/student/{self.alice_uid}")
        self.assertEqual(response.status_code, 403)

    def test_admin_reads_any_sheet(self):
        USERS[2].login(self)
        self.assertEqual(
            self.client.get(f"/api/student/{self.alice_uid}").status_code, 200
        )
        self.assertEqual(
            self.client.get(f"/api/student/{self.bob_uid}").status_code, 200
        )

    def test_unknown_student(self):
        USERS[2].login(self)
        self.assertEqual(self.client.get("/api/student/9999").status_code, 404)
