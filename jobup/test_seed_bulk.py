import io
import tempfile

from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework.test import APITestCase

from .models import (
    ApplicationStatus,
    Company,
    JobApplication,
    Offer,
    Recruiter,
    ReviewStatus,
    Role,
    School,
    SchoolManager,
    SchoolRequest,
    SchoolRequestStatus,
    Student,
    User,
)

PASSWORD = "Demo1234"


def seed(*args: str) -> str:
    out = io.StringIO()
    call_command("seed_bulk", *args, stdout=out)
    return out.getvalue()


class SeedBulkTests(APITestCase):
    def setUp(self):
        media = tempfile.TemporaryDirectory()
        self.addCleanup(media.cleanup)
        self.enterContext(
            self.settings(MEDIA_ROOT=media.name, PRIVATE_MEDIA_ROOT=media.name)
        )

    def login(self, email: str, path: str = "/api/login"):
        self.client.logout()
        return self.client.post(
            path, {"email": email, "password": PASSWORD}, format="json"
        )

    def test_many_accounts_covering_every_case(self):
        seed("--students", "60")
        roles = {role: User.objects.filter(role=role).count() for role in Role.values}
        self.assertEqual(roles[Role.ADMIN], 2)
        self.assertEqual(roles[Role.STUDENT], 63)
        self.assertGreater(roles[Role.RECRUITER], 40)
        self.assertGreater(roles[Role.MANAGER], 10)
        # Companies and schools: every status of the administration
        for model in (Company, School):
            self.assertEqual(
                {row.status for row in model.objects.all()}, set(ReviewStatus.values)
            )
        # Students: with and without school, with and without CV, every request status
        self.assertTrue(Student.objects.filter(school__isnull=True).exists())
        self.assertTrue(Student.objects.filter(school__isnull=False).exists())
        self.assertTrue(Student.objects.filter(resume="").exists())
        self.assertTrue(Student.objects.exclude(resume="").exists())
        self.assertTrue(Student.objects.filter(desired_position="").exists())
        self.assertEqual(
            set(SchoolRequest.objects.values_list("status", flat=True)),
            set(SchoolRequestStatus.values),
        )
        # Recruiters with and without offers or company; offers with and without candidates
        self.assertTrue(Recruiter.objects.filter(offers__isnull=True).exists())
        self.assertTrue(Recruiter.objects.filter(offers__isnull=False).exists())
        self.assertTrue(Recruiter.objects.filter(company__isnull=True).exists())
        self.assertTrue(Offer.objects.filter(applications__isnull=True).exists())
        self.assertTrue(Offer.objects.filter(applications__isnull=False).exists())
        self.assertEqual(
            set(JobApplication.objects.values_list("status", flat=True)),
            set(ApplicationStatus.values),
        )
        # Managers with and without school, and a suspended account somewhere
        self.assertTrue(SchoolManager.objects.filter(school__isnull=True).exists())
        self.assertTrue(User.objects.filter(is_active=False).exists())

    def test_demo_accounts_log_in(self):
        seed("--students", "60")
        for email, role in [
            ("etudiant@demo.fr", Role.STUDENT),
            ("etudiant2@demo.fr", Role.STUDENT),
            ("etudiant3@demo.fr", Role.STUDENT),
            ("recruteur@demo.fr", Role.RECRUITER),
            ("recruteur2@demo.fr", Role.RECRUITER),
            ("recruteur3@demo.fr", Role.RECRUITER),
            ("manager@demo.fr", Role.MANAGER),
            ("manager2@demo.fr", Role.MANAGER),
            ("manager3@demo.fr", Role.MANAGER),
        ]:
            with self.subTest(email=email):
                response = self.login(email)
                self.assertEqual(response.status_code, 200, response.content)
                self.assertEqual(response.json()["role"], role)
        for email in ("admin@demo.fr", "admin2@demo.fr"):
            response = self.login(email, "/api/administration/login")
            self.assertEqual(response.status_code, 200, response.content)

    def test_demo_accounts_differ(self):
        seed("--students", "60")
        main = Recruiter.objects.get(user__email="recruteur@demo.fr")
        self.assertEqual(main.company.status, ReviewStatus.VALIDATED)
        self.assertGreaterEqual(main.offers.count(), 6)
        self.assertTrue(main.offers.filter(is_active=False).exists())
        self.assertGreater(
            JobApplication.objects.filter(offer__recruiter=main).count(), 20
        )
        pending = Recruiter.objects.get(user__email="recruteur2@demo.fr")
        self.assertEqual(pending.company.status, ReviewStatus.PENDING)
        self.assertEqual(pending.offers.count(), 0)
        studio = Recruiter.objects.get(user__email="recruteur3@demo.fr")
        self.assertEqual(studio.offers.count(), 2)
        self.assertFalse(
            JobApplication.objects.filter(offer__recruiter=studio).exists()
        )
        statuses = [
            SchoolManager.objects.get(user__email=f"manager{n}@demo.fr").school.status
            for n in ("", "2", "3")
        ]
        self.assertEqual(
            statuses,
            [ReviewStatus.VALIDATED, ReviewStatus.PENDING, ReviewStatus.REFUSED],
        )
        lea = Student.objects.get(user__email="etudiant@demo.fr")
        self.assertIsNotNone(lea.school)
        self.assertTrue(lea.resume)
        self.assertGreaterEqual(lea.applications.count(), 5)
        inactive = Student.objects.get(user__email="etudiant2@demo.fr")
        self.assertIsNone(inactive.school)
        self.assertFalse(inactive.resume)

    def test_second_run_creates_nothing(self):
        seed("--students", "50")
        counts = [
            model.objects.count()
            for model in (User, Student, Company, School, Offer, JobApplication)
        ]
        self.assertIn("Demo1234", seed("--students", "50"))
        self.assertEqual(
            counts,
            [
                model.objects.count()
                for model in (User, Student, Company, School, Offer, JobApplication)
            ],
        )

    def test_runs_without_debug_and_refuses_too_few_students(self):
        # A demo site in production: DEBUG is off
        with self.settings(DEBUG=False):
            seed("--students", "50")
        self.assertTrue(User.objects.filter(email="admin@demo.fr").exists())
        with self.assertRaises(CommandError):
            seed("--students", "10")

    def test_with_demo_runs_seed_demo_too(self):
        # seed_demo keeps its own refusal without DEBUG
        with self.settings(DEBUG=True):
            seed("--students", "50", "--with-demo")
        self.assertTrue(User.objects.filter(email="recruteur@demo.jobup.fr").exists())
        self.assertTrue(User.objects.filter(email="recruteur@demo.fr").exists())
