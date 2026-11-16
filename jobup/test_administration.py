import os
import tempfile
from datetime import timedelta
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import CommandError, call_command
from django.http import FileResponse
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import JobApplication, Offer, Recruiter, Role, School, Student, User

URL = "/api/administration/users"
FILTERS = f"{URL}/filters"
PAGE = "/administration/users"
LOGIN = "/api/administration/login"


def account(email: str, first_name="Alice", last_name="Martin", **fields) -> User:
    # No password: these accounts never log in, and hashing one is slow
    fields.setdefault("role", Role.STUDENT)
    return User.objects.create(
        email=email, first_name=first_name, last_name=last_name, **fields
    )


def student(
    email: str, first_name="Alice", last_name="Martin", school=None, **fields
) -> User:
    user = account(email, first_name, last_name, **fields)
    Student.objects.create(user=user, school=school)
    return user


class AdminUsersTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            "admin@example.fr", "Password123", first_name="Jean", last_name="Taire"
        )
        self.client.force_login(self.admin)

    def ids(self, **params) -> list[int]:
        response = self.client.get(URL, params)
        self.assertEqual(response.status_code, 200)
        return [row["id"] for row in response.json()["results"]]

    def test_access(self):
        self.client.logout()
        for path in (URL, FILTERS):
            self.assertEqual(self.client.get(path).status_code, 403)
        # The admin login, then back to the page
        self.assertRedirects(
            self.client.get(PAGE),
            "/administration?next=/administration/users",
            fetch_redirect_response=False,
        )
        for role in (Role.STUDENT, Role.RECRUITER, Role.MANAGER):
            user = User.objects.create_user(
                f"user{role}@example.fr",
                "Password123",
                first_name="Alice",
                last_name="Martin",
                role=role,
                is_superuser=True,
            )
            self.client.force_login(user)
            for path in (URL, FILTERS):
                self.assertEqual(self.client.get(path).status_code, 403)
            # ADM-13: an account of another role goes back to the home page
            self.assertRedirects(
                self.client.get(PAGE), "/", fetch_redirect_response=False
            )

    def test_admin_page(self):
        response = self.client.get(PAGE)
        self.assertEqual(response.status_code, 200)
        response.close()

    def test_stable_pagination_students_only_and_inactive(self):
        now = timezone.now()
        for i in range(12):
            account(
                f"user{i}@example.fr",
                is_active=i != 11,
                suspended_at=now if i == 11 else None,
            )
        for role in (Role.MANAGER, Role.RECRUITER):
            account(f"other{role}@example.fr", "Autre", "Compte", role=role)
        # Same date for everyone: the id decides
        User.objects.update(date_joined=now)
        expected = list(
            User.objects.filter(role=Role.STUDENT)
            .order_by("-pk")
            .values_list("pk", flat=True)
        )
        first = self.client.get(URL).json()
        second = self.client.get(URL, {"page": 2}).json()
        self.assertEqual(first["count"], 12)
        self.assertEqual(first["total_pages"], 2)
        self.assertEqual(first["page_size"], 10)
        self.assertEqual(len(first["results"]), 10)
        self.assertEqual(second["page"], 2)
        rows = first["results"] + second["results"]
        self.assertEqual([row["id"] for row in rows], expected)
        self.assertEqual(rows[0]["email"], "user11@example.fr")
        self.assertFalse(rows[0]["is_active"])
        self.assertIsNotNone(rows[0]["suspended_at"])
        self.assertEqual(rows[0]["detail_url"], f"{PAGE}/{rows[0]['id']}")
        # A student account without a profile has no school
        self.assertIsNone(rows[0]["school"])
        self.assertNotIn("password", rows[0])
        self.assertIsNone(rows[-1]["suspended_at"])
        self.assertEqual(self.ids(page_size=25), expected)

    def test_search(self):
        paris = School.objects.create(name="Université Paris")
        alice = student("alice@example.fr", "Alice", "Martin", paris)
        bruno = student("bruno.durand@example.fr", "Bruno", "Durand")
        # Found by its name, although it has no profile
        chloe = account("c.petit@example.fr", "Chloé", "Petit")
        for query, expected in [
            ("alice", [alice]),
            ("DURAND", [bruno]),
            ("c.petit@", [chloe]),
            ("paris", [alice]),
            ("chloé", [chloe]),
            # Every word must be found, in any of the fields
            ("alice paris", [alice]),
            ("alice durand", []),
            ("  bruno  ", [bruno]),
            # No SQL wildcard
            ("%", []),
            ("_", []),
        ]:
            with self.subTest(query=query):
                self.assertEqual(self.ids(q=query), [user.pk for user in expected])

    def test_status_and_school_filters(self):
        paris = School.objects.create(name="Université Paris")
        lyon = School.objects.create(name="Lyon 2")
        active = student("a@example.fr", school=paris)
        suspended = student(
            "s@example.fr", school=paris, is_active=False, suspended_at=timezone.now()
        )
        student("o@example.fr", school=lyon)
        self.assertEqual(self.ids(status="active", school=paris.pk), [active.pk])
        self.assertEqual(self.ids(status="suspended"), [suspended.pk])
        self.assertCountEqual(self.ids(school=paris.pk), [active.pk, suspended.pk])
        self.assertEqual(self.ids(school=lyon.pk, status="suspended"), [])
        self.assertEqual(
            self.ids(q="alice", school=paris.pk, status="active"), [active.pk]
        )
        # An empty criterion is not applied
        self.assertEqual(len(self.ids(q="", status="", school="")), 3)

    def test_sort(self):
        now = timezone.now()
        zoe = student(
            "zoe@example.fr", "Zoé", "Adam", School.objects.create(name="Alpha")
        )
        marc = student(
            "Marc@example.fr", "marc", "durand", School.objects.create(name="beta")
        )
        lea = student("lea@example.fr", "Léa", "Durand")
        for days, user in enumerate((lea, marc, zoe)):
            User.objects.filter(pk=user.pk).update(
                date_joined=now - timedelta(days=days)
            )
        for sort, expected in [
            # Case ignored; the first name separates the two Durand
            ("last_name", [zoe, lea, marc]),
            ("-last_name", [marc, lea, zoe]),
            ("first_name", [lea, marc, zoe]),
            ("-first_name", [zoe, marc, lea]),
            ("email", [lea, marc, zoe]),
            ("-email", [zoe, marc, lea]),
            # Accounts without a school come last, in both directions
            ("school", [zoe, marc, lea]),
            ("-school", [marc, zoe, lea]),
            ("date_joined", [zoe, marc, lea]),
            ("-date_joined", [lea, marc, zoe]),
        ]:
            with self.subTest(sort=sort):
                self.assertEqual(self.ids(sort=sort), [user.pk for user in expected])
        # Newest first by default
        self.assertEqual(self.ids(), [lea.pk, marc.pk, zoe.pk])

    def test_invalid_filters(self):
        for params in (
            {"page": "abc"},
            {"page": "1.5"},
            {"page": "-1"},
            {"page": "0"},
            {"page_size": "11"},
            {"page_size": "all"},
            {"status": "deleted"},
            {"school": "abc"},
            {"school": "0"},
            {"sort": "password"},
            {"sort": "-role"},
            {"q": "x" * 101},
        ):
            with self.subTest(params=params):
                self.assertEqual(self.client.get(URL, params).status_code, 400)
        # A page after the last one
        for page in ("2", "9999999999999999999999"):
            self.assertEqual(self.client.get(URL, {"page": page}).status_code, 404)

    def test_empty_list(self):
        # The administrator is not included in the list of student accounts.
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"], [])
        self.assertEqual(response.json()["count"], 0)
        self.assertEqual(response.json()["total_pages"], 1)

    def test_filter_values(self):
        paris = School.objects.create(name="Université Paris")
        lyon = School.objects.create(name="lyon 2")
        School.objects.create(name="Sans étudiant")
        student("a@example.fr", school=paris)
        student("b@example.fr", school=paris)
        student("c@example.fr", school=lyon)
        response = self.client.get(FILTERS)
        self.assertEqual(response.status_code, 200)
        # Each school once, in alphabetical order whatever the case
        self.assertEqual(
            response.json(),
            {
                "schools": [
                    {"id": lyon.pk, "name": "lyon 2"},
                    {"id": paris.pk, "name": "Université Paris"},
                ]
            },
        )

    def test_read_only(self):
        self.assertEqual(self.client.post(URL, {}).status_code, 405)
        self.assertEqual(self.client.post(FILTERS, {}).status_code, 405)


class AdminStudentDetailTests(APITestCase):
    def setUp(self):
        media = tempfile.TemporaryDirectory()
        self.addCleanup(media.cleanup)
        self.enterContext(override_settings(MEDIA_ROOT=media.name))
        self.admin = User.objects.create_superuser(
            "admin@example.fr", "Password123", first_name="Jean", last_name="Taire"
        )
        self.user = User.objects.create_user(
            "alice@example.fr",
            "Password123",
            first_name="Alice",
            last_name="Martin",
            role=Role.STUDENT,
        )
        self.student = Student.objects.create(
            user=self.user,
            school=School.objects.create(name="Université Paris"),
            resume=SimpleUploadedFile(
                "Alice.pdf", b"%PDF-1.4 demo", content_type="application/pdf"
            ),
        )
        self.path = f"{URL}/{self.user.pk}"
        self.client.force_login(self.admin)

    def test_profile_and_submitted_count(self):
        recruiter = Recruiter.objects.create(
            user=User.objects.create_user(
                "rh@example.fr",
                "Password123",
                first_name="Rose",
                last_name="Martin",
                role=Role.RECRUITER,
            )
        )
        for index, submitted in enumerate((None, timezone.now())):
            offer = Offer.objects.create(
                recruiter=recruiter,
                title=f"Offre {index}",
                description="Description",
                category=1,
            )
            JobApplication.objects.create(
                student=self.student, offer=offer, submitted_at=submitted
            )
        data = self.client.get(self.path).json()
        self.assertEqual(data["school"], "Université Paris")
        self.assertEqual(data["email"], self.user.email)
        self.assertIsNone(data["phone"])
        self.assertEqual(data["applications_sent"], 1)
        self.assertEqual(data["cv_url"], f"{self.path}/cv")
        self.assertNotIn("password", data)

    def test_access_for_detail_download_and_page(self):
        for user in (None, self.user):
            self.client.logout()
            if user:
                self.client.force_login(user)
            for path in (self.path, f"{self.path}/cv"):
                self.assertEqual(self.client.get(path).status_code, 403)
        for role in (Role.RECRUITER, Role.MANAGER):
            User.objects.filter(pk=self.user.pk).update(role=role)
            self.user.refresh_from_db()
            self.client.force_login(self.user)
            self.assertEqual(self.client.get(self.path).status_code, 403)
            self.assertEqual(self.client.get(f"{self.path}/cv").status_code, 403)
        self.client.force_login(self.admin)
        response = self.client.get(f"{PAGE}/{self.user.pk}")
        self.assertEqual(response.status_code, 200)
        response.close()

    def test_unknown_or_non_student(self):
        for id in (999999, self.admin.pk):
            self.assertEqual(self.client.get(f"{URL}/{id}").status_code, 404)
            self.assertEqual(self.client.get(f"{URL}/{id}/cv").status_code, 404)

    def test_inactive_and_missing_profile(self):
        self.user.is_active = False
        self.user.suspended_at = timezone.now()
        self.user.save()
        self.student.delete()
        data = self.client.get(self.path).json()
        self.assertFalse(data["is_active"])
        self.assertIsNotNone(data["suspended_at"])
        self.assertIsNone(data["school"])
        self.assertIsNone(data["cv_url"])
        self.assertEqual(data["applications_sent"], 0)
        self.assertEqual(self.client.get(f"{self.path}/cv").status_code, 404)

    def test_cv_download_and_missing_file(self):
        response = self.client.get(f"{self.path}/cv")
        self.assertEqual(response.status_code, 200)
        assert isinstance(response, FileResponse)
        self.assertEqual(response.getvalue(), b"%PDF-1.4 demo")
        self.assertIn("attachment", response["Content-Disposition"])
        response.close()
        name = self.student.resume.name
        assert name
        self.student.resume.storage.delete(name)
        self.assertEqual(self.client.get(f"{self.path}/cv").status_code, 404)
        self.student.resume = ""
        self.student.save()
        self.assertEqual(self.client.get(f"{self.path}/cv").status_code, 404)

    def test_read_only(self):
        self.assertEqual(
            self.client.patch(self.path, {"is_active": False}).status_code, 405
        )
        self.assertEqual(self.client.post(f"{self.path}/cv", {}).status_code, 405)


class AdminLoginTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            "admin@example.fr",
            "Password123",
            first_name="Jean",
            last_name="Taire",
            role=Role.ADMIN,
        )

    def log_in(self, email="admin@example.fr", password="Password123"):
        return self.client.post(
            LOGIN, {"email": email, "password": password}, format="json"
        )

    def test_administrator_opens_the_administration(self):
        response = self.log_in()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["role"], Role.ADMIN)
        self.assertNotIn("password", response.json())
        self.assertEqual(self.client.get(URL).status_code, 200)

    def test_other_accounts_get_the_answer_of_a_wrong_password(self):
        User.objects.create_user(
            "alice@example.fr",
            "Password123",
            first_name="Alice",
            last_name="Martin",
            role=Role.STUDENT,
            is_superuser=True,
        )
        for email, password in (
            ("alice@example.fr", "Password123"),
            ("admin@example.fr", "Wrong12345"),
            ("nobody@example.fr", "Password123"),
        ):
            with self.subTest(email=email, password=password):
                response = self.log_in(email, password)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json(), {"error": "Invalid credentials"})
                # No session was opened
                self.assertEqual(self.client.get("/api/me").status_code, 403)

    def test_suspended_administrator_cannot_log_in(self):
        User.objects.filter(pk=self.admin.pk).update(is_active=False)
        self.assertEqual(self.log_in().status_code, 401)

    def test_invalid_payload(self):
        self.assertEqual(self.client.post(LOGIN, {}, format="json").status_code, 400)
        self.assertEqual(self.client.get(LOGIN).status_code, 405)

    def test_login_page_is_open_to_everyone(self):
        student = User.objects.create(
            email="s@example.fr", first_name="S", last_name="T", role=Role.STUDENT
        )
        for user in (None, student, self.admin):
            if user:
                self.client.force_login(user)
            for path in ("/administration", "/administration/"):
                with self.subTest(user=user, path=path):
                    response = self.client.get(path)
                    self.assertEqual(response.status_code, 200)
                    response.close()


class CreateAdminCommandTests(APITestCase):
    def test_creates_then_updates_the_administrator(self):
        call_command("create_admin", email=" Admin@Example.fr ", password="Secret12345")
        admin = User.objects.get(role=Role.ADMIN)
        self.assertEqual(admin.email, "Admin@example.fr")
        self.assertTrue(admin.check_password("Secret12345"))
        self.assertFalse(admin.is_superuser)
        call_command("create_admin", email="admin@example.fr", password="Other12345")
        admin.refresh_from_db()
        self.assertTrue(admin.check_password("Other12345"))
        self.assertEqual(User.objects.filter(role=Role.ADMIN).count(), 1)

    def test_reads_the_environment(self):
        env = {
            "JOBUP_ADMIN_EMAIL": "env@example.fr",
            "JOBUP_ADMIN_PASSWORD": "Env12345",
        }
        with mock.patch.dict(os.environ, env):
            call_command("create_admin")
        self.assertTrue(
            User.objects.get(email="env@example.fr").check_password("Env12345")
        )

    def test_refuses_missing_credentials_and_other_roles(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(CommandError):
                call_command("create_admin", email="admin@example.fr")
        account("alice@example.fr")
        with self.assertRaises(CommandError):
            call_command(
                "create_admin", email="alice@example.fr", password="Secret12345"
            )
        self.assertEqual(User.objects.get(email="alice@example.fr").role, Role.STUDENT)
