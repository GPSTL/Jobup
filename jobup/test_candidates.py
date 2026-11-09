import io
import os
import tempfile
from datetime import datetime, timedelta

from django.core.management import call_command
from django.core.management.base import CommandError
from django.http import FileResponse
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import (
    Company,
    JobApplication,
    JobCategory,
    Offer,
    Recruiter,
    School,
    Student,
    StudyDegree,
    User,
)
from .test_applications import pdf
from .test_login import USERS

# Recruiter of the same company as USERS[3]
COLLEAGUE = USERS[3].fork(email="rh@thales.org", first_name="Rose")
LIST = "/api/recruiter/candidates"


def detail(student: Student) -> str:
    return f"{LIST}/{student.user.pk}"


def downloaded(response: object) -> bytes:
    # The test client returns the FileResponse of the view, which streams the file
    assert isinstance(response, FileResponse)
    return response.getvalue()


class CandidateTestCase(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        media = tempfile.TemporaryDirectory()
        cls.addClassCleanup(media.cleanup)
        cls.enterClassContext(override_settings(MEDIA_ROOT=media.name))

    def setUp(self):
        company = Company.objects.create(name="Thales", siret="12345678901234")
        recruiter = Recruiter.objects.create(
            user=User.objects.create_user(**USERS[3]), company=company
        )
        colleague = Recruiter.objects.create(
            user=User.objects.create_user(**COLLEAGUE), company=company
        )
        self.offers = [
            Offer.objects.create(
                recruiter=recruiter,
                title=f"Développeur Java {i}",
                description="Description",
                category=JobCategory.COMPUTER_SCIENCE,
            )
            for i in range(3)
        ]
        self.colleague_offer = Offer.objects.create(
            recruiter=colleague,
            title="Data analyst",
            description="Description",
            category=JobCategory.DATA_AI,
        )
        self.alice = Student.objects.create(
            user=User.objects.create_user(**USERS[0]),
            resume=pdf("CV_Alice.pdf", b"alice resume"),
            school=School.objects.create(name="Université Paris Nanterre"),
            description="Étudiante en Master MIAGE",
            skills="Java, Spring Boot, ,SQL",
            study_degree=StudyDegree.MASTER1,
            region="Paris",
        )
        # Without school, CV nor skills
        self.bob = Student.objects.create(user=User.objects.create_user(**USERS[1]))
        inactive = USERS[0].fork(email="carol@mail.fr", first_name="Carol")
        self.carol = Student.objects.create(
            user=User.objects.create_user(**inactive, is_active=False),
            resume=pdf("CV_Carol.pdf", b"carol resume"),
        )
        User.objects.create_superuser(**USERS[2])

    def assertOnlyRecruiters(self, url: str):
        self.assertEqual(self.client.get(url).status_code, 403)
        # Student (even the candidate themselves) and administrator
        for user in (USERS[0], USERS[2]):
            self.client.logout()
            user.login(self)
            self.assertEqual(self.client.get(url).status_code, 403)

    def sent(self, offer: Offer, days_ago: int) -> JobApplication:
        application = JobApplication.objects.create(student=self.alice, offer=offer)
        application.submit()
        application.submitted_at = timezone.now() - timedelta(days=days_ago)
        application.save()
        return application


class CandidateListTests(CandidateTestCase):
    def test_only_recruiters(self):
        self.assertOnlyRecruiters(LIST)

    def test_active_students_newest_first(self):
        USERS[3].login(self)
        response = self.client.get(LIST)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [card["id"] for card in response.json()],
            [self.bob.user.pk, self.alice.user.pk],
        )

    def test_card_content(self):
        USERS[3].login(self)
        bob, alice = self.client.get(LIST).json()
        self.assertEqual(
            alice,
            {
                "id": self.alice.user.pk,
                "first_name": "Alice",
                "last_name": "Plancher",
                "photo_url": None,
                "education": None,
                "school": "Université Paris Nanterre",
                "description": "Étudiante en Master MIAGE",
                "cv_url": f"{detail(self.alice)}/cv",
            },
        )
        # Missing school and CV: null, never a broken link
        self.assertIsNone(bob["school"])
        self.assertIsNone(bob["cv_url"])
        self.assertEqual(bob["description"], "")


class CandidateDetailTests(CandidateTestCase):
    def test_only_recruiters(self):
        self.assertOnlyRecruiters(detail(self.alice))

    def test_profile(self):
        USERS[3].login(self)
        response = self.client.get(detail(self.alice))
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["first_name"], "Alice")
        self.assertEqual(body["cv_url"], f"{detail(self.alice)}/cv")
        self.assertEqual(body["region"], "Paris")
        self.assertEqual(body["study_degree"], StudyDegree.MASTER1)
        self.assertEqual(body["available_from"], str(self.alice.available_from))
        self.assertEqual(body["skills"], ["Java", "Spring Boot", "SQL"])
        self.assertEqual(body["experiences"], [])
        self.assertEqual(body["exchanges"], [])

    def test_empty_profile(self):
        USERS[3].login(self)
        body = self.client.get(detail(self.bob)).json()
        self.assertIsNone(body["study_degree"])
        self.assertEqual(body["skills"], [])

    def test_not_a_visible_candidate(self):
        USERS[3].login(self)
        recruiter = User.objects.get(email=USERS[3].email)
        # Unknown account, inactive student, account that is not a student
        for id in (9999, self.carol.user.pk, recruiter.pk):
            response = self.client.get(f"{LIST}/{id}")
            self.assertEqual(response.status_code, 404)
            self.assertEqual(response.json(), {"error": "Candidate not found"})

    def test_exchanges_are_the_applications_sent_to_this_recruiter(self):
        latest = self.sent(self.offers[0], days_ago=1)
        oldest = self.sent(self.offers[1], days_ago=3)
        # Draft: never received by the recruiter
        JobApplication.objects.create(student=self.alice, offer=self.offers[2])
        other = self.sent(self.colleague_offer, days_ago=2)

        USERS[3].login(self)
        exchanges = self.client.get(detail(self.alice)).json()["exchanges"]
        self.assertEqual([e["id"] for e in exchanges], [oldest.pk, latest.pk])
        self.assertEqual(exchanges[0]["kind"], "application")
        self.assertEqual(exchanges[0]["offer_title"], "Développeur Java 1")
        self.assertEqual(
            datetime.fromisoformat(exchanges[0]["date"]), oldest.submitted_at
        )

        # A colleague of the same company only sees the application sent to them
        self.client.logout()
        COLLEAGUE.login(self)
        exchanges = self.client.get(detail(self.alice)).json()["exchanges"]
        self.assertEqual([e["id"] for e in exchanges], [other.pk])


class CandidateCvTests(CandidateTestCase):
    def cv(self, student: Student) -> str:
        return f"{detail(student)}/cv"

    def test_only_recruiters(self):
        self.assertOnlyRecruiters(self.cv(self.alice))

    def test_download(self):
        USERS[3].login(self)
        response = self.client.get(self.cv(self.alice))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(downloaded(response), b"alice resume")
        name = os.path.basename(self.alice.resume.name or "")
        self.assertEqual(
            response["Content-Disposition"], f'attachment; filename="{name}"'
        )

    def test_no_cv(self):
        USERS[3].login(self)
        response = self.client.get(self.cv(self.bob))
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "Resume not found"})

    def test_file_removed_from_storage(self):
        self.alice.resume.storage.delete(self.alice.resume.name or "")
        USERS[3].login(self)
        self.assertEqual(self.client.get(self.cv(self.alice)).status_code, 404)

    def test_not_a_visible_candidate(self):
        USERS[3].login(self)
        for path in (f"{LIST}/9999/cv", self.cv(self.carol)):
            self.assertEqual(self.client.get(path).status_code, 404)


class SeedCandidatesTests(CandidateTestCase):
    def test_demo_candidates_and_history(self):
        call_command("seed_candidates", USERS[3].email.upper(), stdout=io.StringIO())
        # Twice: nothing is created again
        call_command("seed_candidates", USERS[3].email, stdout=io.StringIO())

        USERS[3].login(self)
        cards = self.client.get(LIST).json()
        names = [card["first_name"] for card in cards]
        # In the order of the mockups, before the students of setUp
        self.assertEqual(names[:3], ["Lucas", "Sarah", "Inès"])
        lucas = cards[0]
        self.assertIsNone(cards[2]["cv_url"])
        exchanges = self.client.get(f"{LIST}/{lucas['id']}").json()["exchanges"]
        self.assertEqual([e["kind"] for e in exchanges], ["application"])
        cv = self.client.get(lucas["cv_url"])
        self.assertTrue(downloaded(cv).startswith(b"%PDF-"))
        # Demo accounts cannot log in
        self.assertFalse(User.objects.get(pk=lucas["id"]).has_usable_password())

    def test_recruiter_without_recruiter_row(self):
        # Account created by shell (create_user makes no Recruiter row)
        user = User.objects.create_user(**COLLEAGUE.fork(email="new@corp.fr"))
        call_command("seed_candidates", user.email, stdout=io.StringIO())
        self.assertEqual(
            Recruiter.objects.get(user=user).company.name, "Entreprise de démonstration"
        )

    def test_unknown_recruiter(self):
        with self.assertRaises(CommandError):
            call_command("seed_candidates", USERS[0].email)
