import tempfile
from typing import Any

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import (
    FINAL_STATUSES,
    ApplicationStatus,
    Company,
    JobApplication,
    JobCategory,
    Offer,
    Recruiter,
    Student,
    User,
)
from .test_login import USERS


def pdf(name: str, content: bytes) -> SimpleUploadedFile:
    return SimpleUploadedFile(name, content, content_type="application/pdf")


class ApplicationTestCase(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        media = tempfile.TemporaryDirectory()
        cls.addClassCleanup(media.cleanup)
        cls.enterClassContext(override_settings(MEDIA_ROOT=media.name))

    def setUp(self):
        recruiter_user = User.objects.create_user(**USERS[3])
        company = Company.objects.create(name="Thales", siret="12345678901234")
        recruiter = Recruiter.objects.create(user=recruiter_user, company=company)
        self.offers = [
            Offer.objects.create(
                recruiter=recruiter,
                title=f"Offer {i}",
                description="Description",
                category=JobCategory.COMPUTER_SCIENCE,
            )
            for i in range(6)
        ]
        self.alice = Student.objects.create(
            user=User.objects.create_user(**USERS[0]),
            resume=pdf("alice_v1.pdf", b"alice resume v1"),
        )
        self.bob = Student.objects.create(
            user=User.objects.create_user(**USERS[1]),
            resume=pdf("bob.pdf", b"bob resume"),
        )
        User.objects.create_superuser(**USERS[2])

    def create_application(
        self,
        student: Student,
        offer: Offer,
        status: ApplicationStatus = ApplicationStatus.DRAFT,
    ) -> JobApplication:
        application = JobApplication.objects.create(student=student, offer=offer)
        if status != ApplicationStatus.DRAFT:
            application.submit()
            application.status = status
            application.save()
        return application


class ApplicationListTests(ApplicationTestCase):
    def test_anonymous_forbidden(self):
        self.assertEqual(self.client.get("/api/applications").status_code, 403)

    def test_non_student_forbidden(self):
        for user in (USERS[2], USERS[3]):
            self.client.logout()
            user.login(self)
            self.assertEqual(self.client.get("/api/applications").status_code, 403)

    def test_empty_lists(self):
        USERS[0].login(self)
        response = self.client.get("/api/applications")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"in_progress": [], "completed": []})

    def test_only_own_applications(self):
        mine = self.create_application(self.alice, self.offers[0])
        self.create_application(self.bob, self.offers[1])
        USERS[0].login(self)
        body = self.client.get("/api/applications").json()
        self.assertEqual([a["id"] for a in body["in_progress"]], [mine.pk])
        self.assertEqual(body["completed"], [])

    def test_statuses_are_split_in_two_columns(self):
        for offer, status in zip(self.offers, ApplicationStatus):
            self.create_application(self.alice, offer, status)
        USERS[0].login(self)
        body = self.client.get("/api/applications").json()
        in_progress = {a["status"] for a in body["in_progress"]}
        completed = {a["status"] for a in body["completed"]}
        self.assertEqual(completed, {int(s) for s in FINAL_STATUSES})
        self.assertEqual(
            in_progress,
            {
                ApplicationStatus.DRAFT,
                ApplicationStatus.SUBMITTED,
                ApplicationStatus.READ,
                ApplicationStatus.IN_REVIEW,
            },
        )

    def test_item_content(self):
        self.create_application(self.alice, self.offers[0], ApplicationStatus.SUBMITTED)
        USERS[0].login(self)
        item = self.client.get("/api/applications").json()["in_progress"][0]
        self.assertEqual(item["offer"]["title"], "Offer 0")
        self.assertEqual(item["company"], "Thales")
        self.assertEqual(item["status_label"], "Submitted")
        self.assertIsNotNone(item["submitted_at"])


class ApplicationDetailTests(ApplicationTestCase):
    def test_own_detail(self):
        application = self.create_application(
            self.alice, self.offers[0], ApplicationStatus.SUBMITTED
        )
        USERS[0].login(self)
        response = self.client.get(f"/api/applications/{application.pk}")
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertIsNotNone(documents["resume"])
        self.assertIsNone(documents["cover_letter"])

    def test_other_student_gets_not_found(self):
        application = self.create_application(self.bob, self.offers[0])
        USERS[0].login(self)
        self.assertEqual(
            self.client.get(f"/api/applications/{application.pk}").status_code, 404
        )

    def test_unknown_application(self):
        USERS[0].login(self)
        self.assertEqual(self.client.get("/api/applications/9999").status_code, 404)

    def test_anonymous_forbidden(self):
        application = self.create_application(self.alice, self.offers[0])
        self.assertEqual(
            self.client.get(f"/api/applications/{application.pk}").status_code, 403
        )


class ApplicationDocumentTests(ApplicationTestCase):
    def download(self, application: JobApplication, kind: str):
        return self.client.get(f"/api/applications/{application.pk}/documents/{kind}")

    def test_sent_resume_survives_profile_resume_replacement(self):
        application = self.create_application(
            self.alice, self.offers[0], ApplicationStatus.SUBMITTED
        )
        self.alice.resume = pdf("alice_v2.pdf", b"alice resume v2")
        self.alice.save()
        USERS[0].login(self)
        response: Any = self.download(application, "resume")  # type: ignore
        self.assertEqual(response.status_code, 200)
        self.assertEqual(b"".join(response.streaming_content), b"alice resume v1")

    def test_cover_letter_download(self):
        application = self.create_application(self.alice, self.offers[0])
        application.cover_letter = pdf("cover.pdf", b"cover letter")
        application.save()
        USERS[0].login(self)
        response: Any = self.download(application, "cover_letter")  # type: ignore
        self.assertEqual(response.status_code, 200)
        self.assertEqual(b"".join(response.streaming_content), b"cover letter")

    def test_missing_documents(self):
        draft = self.create_application(self.alice, self.offers[0])
        USERS[0].login(self)
        self.assertEqual(self.download(draft, "resume").status_code, 404)
        self.assertEqual(self.download(draft, "cover_letter").status_code, 404)
        self.assertEqual(self.download(draft, "unknown").status_code, 404)

    def test_other_student_cannot_download(self):
        application = self.create_application(
            self.alice, self.offers[0], ApplicationStatus.SUBMITTED
        )
        USERS[1].login(self)
        self.assertEqual(self.download(application, "resume").status_code, 404)

    def test_anonymous_and_recruiter_forbidden(self):
        application = self.create_application(
            self.alice, self.offers[0], ApplicationStatus.SUBMITTED
        )
        self.assertEqual(self.download(application, "resume").status_code, 403)
        USERS[3].login(self)
        self.assertEqual(self.download(application, "resume").status_code, 403)


class ApplicationDraftTests(ApplicationTestCase):
    def save_draft(self, **payload):
        return self.client.put("/api/applications/draft", payload, format="multipart")

    def test_create_draft(self):
        USERS[0].login(self)
        response = self.save_draft(
            offer=self.offers[0].pk, message="Hello", cover_letter=pdf("c.pdf", b"c")
        )
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["status"], ApplicationStatus.DRAFT)
        self.assertEqual(body["message"], "Hello")
        self.assertIsNotNone(body["documents"]["cover_letter"])
        self.assertIsNone(body["documents"]["resume"])
        self.assertIsNone(body["submitted_at"])

    def test_draft_is_not_a_submitted_application(self):
        USERS[0].login(self)
        self.save_draft(offer=self.offers[0].pk, message="Hello")
        application = JobApplication.objects.get()
        self.assertTrue(application.is_draft)
        self.assertFalse(application.sent_resume)
        self.assertIsNone(application.submitted_at)

    def test_resume_draft_keeps_fields(self):
        USERS[0].login(self)
        first = self.save_draft(
            offer=self.offers[0].pk, message="Hello", cover_letter=pdf("c.pdf", b"c")
        ).json()
        second = self.save_draft(offer=self.offers[0].pk, message="Updated")
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()["id"], first["id"])
        self.assertEqual(second.json()["message"], "Updated")
        self.assertIsNotNone(second.json()["documents"]["cover_letter"])
        self.assertEqual(JobApplication.objects.count(), 1)

        detail = self.client.get(f"/api/applications/{first['id']}").json()
        self.assertEqual(detail["message"], "Updated")
        listed = self.client.get("/api/applications").json()["in_progress"]
        self.assertEqual([a["id"] for a in listed], [first["id"]])

    def test_submitted_application_cannot_be_overwritten(self):
        self.create_application(self.alice, self.offers[0], ApplicationStatus.SUBMITTED)
        USERS[0].login(self)
        response = self.save_draft(offer=self.offers[0].pk, message="Again")
        self.assertEqual(response.status_code, 409)

    def test_invalid_offer(self):
        USERS[0].login(self)
        self.assertEqual(self.save_draft(offer=9999).status_code, 400)
        self.assertEqual(self.save_draft(message="No offer").status_code, 400)

    def test_inactive_offer_rejected(self):
        self.offers[0].is_active = False
        self.offers[0].save()
        USERS[0].login(self)
        self.assertEqual(self.save_draft(offer=self.offers[0].pk).status_code, 400)

    def test_non_student_forbidden(self):
        USERS[3].login(self)
        self.assertEqual(self.save_draft(offer=self.offers[0].pk).status_code, 403)


class ApplicationSubmitTests(ApplicationTestCase):
    def submit(self, application: JobApplication):
        return self.client.post(f"/api/applications/{application.pk}/submit")

    def test_submit_draft(self):
        application = self.create_application(self.alice, self.offers[0])
        USERS[0].login(self)
        response = self.submit(application)
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], ApplicationStatus.SUBMITTED)
        self.assertIsNotNone(body["submitted_at"])
        self.assertIsNotNone(body["documents"]["resume"])

    def test_submit_twice_conflicts(self):
        application = self.create_application(self.alice, self.offers[0])
        USERS[0].login(self)
        self.assertEqual(self.submit(application).status_code, 200)
        self.assertEqual(self.submit(application).status_code, 409)

    def test_submit_requires_resume(self):
        self.alice.resume = ""
        self.alice.save()
        application = self.create_application(self.alice, self.offers[0])
        USERS[0].login(self)
        self.assertEqual(self.submit(application).status_code, 400)
        application.refresh_from_db()
        self.assertTrue(application.is_draft)

    def test_submit_other_student_draft(self):
        application = self.create_application(self.bob, self.offers[0])
        USERS[0].login(self)
        self.assertEqual(self.submit(application).status_code, 404)

    def test_submit_inactive_offer(self):
        application = self.create_application(self.alice, self.offers[0])
        self.offers[0].is_active = False
        self.offers[0].save()
        USERS[0].login(self)
        self.assertEqual(self.submit(application).status_code, 400)
