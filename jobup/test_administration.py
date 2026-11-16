import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import JobApplication, Offer, Recruiter, Role, School, Student, User

URL = "/api/administration/users"
PAGE = "/administration/users"


class AdminUsersTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            "admin@example.fr", "Password123", first_name="Jean", last_name="Taire"
        )
        self.client.force_login(self.admin)

    def test_access(self):
        self.client.logout()
        self.assertEqual(self.client.get(URL).status_code, 403)
        self.assertRedirects(
            self.client.get(PAGE),
            "/login?next=/administration/users",
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
            self.assertEqual(self.client.get(URL).status_code, 403)
            self.assertEqual(self.client.get(PAGE).status_code, 403)

    def test_admin_page(self):
        response = self.client.get(PAGE)
        self.assertEqual(response.status_code, 200)
        response.close()

    def test_stable_pagination_students_only_and_inactive(self):
        now = timezone.now()
        for i in range(10):
            User.objects.create_user(
                f"user{i}@example.fr",
                "Password123",
                first_name="Alice",
                last_name="Martin",
                role=Role.STUDENT,
                is_active=i != 9,
                suspended_at=now if i == 9 else None,
            )
        for role in (Role.MANAGER, Role.RECRUITER):
            User.objects.create_user(
                f"other{role}@example.fr",
                "Password123",
                first_name="Autre",
                last_name="Compte",
                role=role,
            )
        User.objects.update(date_joined=now)
        expected = list(
            User.objects.filter(role=Role.STUDENT)
            .order_by("-pk")
            .values_list("pk", flat=True)
        )
        first = self.client.get(URL).json()
        second = self.client.get(URL, {"page": 2}).json()
        self.assertEqual(first["count"], 10)
        self.assertEqual(first["total_pages"], 2)
        self.assertEqual(len(first["results"]), 8)
        self.assertEqual(second["page"], 2)
        cards = first["results"] + second["results"]
        self.assertEqual([card["id"] for card in cards], expected)
        self.assertEqual(cards[0]["email"], "user9@example.fr")
        self.assertFalse(cards[0]["is_active"])
        self.assertIsNotNone(cards[0]["suspended_at"])
        self.assertEqual(cards[0]["detail_url"], f"{PAGE}/{cards[0]['id']}")
        self.assertNotIn("password", cards[0])
        self.assertIsNone(cards[-1]["suspended_at"])

    def test_invalid_page(self):
        for page in ("abc", "1.5", "-1", "", "9999999999999999999999"):
            self.assertEqual(self.client.get(URL, {"page": page}).status_code, 400)
        for page in ("0", "2"):
            self.assertEqual(self.client.get(URL, {"page": page}).status_code, 404)

    def test_empty_list(self):
        # The administrator is not included in the list of student accounts.
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"], [])
        self.assertEqual(response.json()["count"], 0)

    def test_read_only(self):
        self.assertEqual(self.client.post(URL, {}).status_code, 405)


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
        self.assertEqual(response.getvalue(), b"%PDF-1.4 demo")
        self.assertIn("attachment", response["Content-Disposition"])
        response.close()
        self.student.resume.storage.delete(self.student.resume.name)
        self.assertEqual(self.client.get(f"{self.path}/cv").status_code, 404)
        self.student.resume = ""
        self.student.save()
        self.assertEqual(self.client.get(f"{self.path}/cv").status_code, 404)

    def test_read_only(self):
        self.assertEqual(
            self.client.patch(self.path, {"is_active": False}).status_code, 405
        )
        self.assertEqual(self.client.post(f"{self.path}/cv", {}).status_code, 405)
