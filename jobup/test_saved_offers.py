from rest_framework.test import APITestCase

from .models import (
    Company,
    JobCategory,
    Offer,
    Recruiter,
    Role,
    SavedOffer,
    Student,
    User,
)


LIST = "/api/student/saved-offers"


class SavedOfferTests(APITestCase):
    def setUp(self):
        self.student = Student.objects.create(
            user=User.objects.create_user(
                "student@saved.test",
                "Example123",
                first_name="Student",
                last_name="One",
                role=Role.STUDENT,
            )
        )
        self.other = Student.objects.create(
            user=User.objects.create_user(
                "other@saved.test",
                "Example123",
                first_name="Student",
                last_name="Two",
                role=Role.STUDENT,
            )
        )
        self.recruiter = Recruiter.objects.create(
            user=User.objects.create_user(
                "recruiter@saved.test",
                "Example123",
                first_name="Recruiter",
                last_name="One",
                role=Role.RECRUITER,
            ),
            company=Company.objects.create(
                name="Studio", siret="12345678901234", city="Paris"
            ),
        )
        self.active = self.createOffer("Active")
        self.inactive = self.createOffer("Inactive", is_active=False)

    def createOffer(self, title, **changes):
        return Offer.objects.create(
            recruiter=self.recruiter,
            title=title,
            description="Une offre de test",
            requirements="",
            category=JobCategory.COMPUTER_SCIENCE,
            **changes,
        )

    def url(self, offer):
        return f"{LIST}/{offer.pk}"

    def test_login_and_student_role_are_required(self):
        self.assertEqual(self.client.get(LIST).status_code, 403)
        self.client.force_authenticate(self.recruiter.user)
        self.assertEqual(self.client.get(LIST).status_code, 403)

    def test_save_is_idempotent_and_listing_is_private(self):
        self.client.force_authenticate(self.student.user)
        first = self.client.post(self.url(self.active))
        second = self.client.post(self.url(self.active))
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(SavedOffer.objects.count(), 1)
        item = self.client.get(LIST).json()[0]
        self.assertEqual(item["id"], self.active.pk)
        self.assertIn("saved_at", item)

        self.client.force_authenticate(self.other.user)
        self.assertEqual(self.client.get(LIST).json(), [])
        self.assertEqual(self.client.delete(self.url(self.active)).status_code, 204)
        self.assertEqual(SavedOffer.objects.count(), 1)

    def test_only_active_offers_can_be_saved_and_only_active_entries_are_listed(self):
        self.client.force_authenticate(self.student.user)
        self.assertEqual(self.client.post(self.url(self.inactive)).status_code, 404)
        entry = SavedOffer.objects.create(student=self.student, offer=self.active)
        self.active.is_active = False
        self.active.save(update_fields=["is_active"])
        self.assertEqual(self.client.get(LIST).json(), [])
        self.assertTrue(SavedOffer.objects.filter(pk=entry.pk).exists())

    def test_remove_is_idempotent_and_unknown_save_is_not_found(self):
        self.client.force_authenticate(self.student.user)
        self.assertEqual(self.client.delete(self.url(self.active)).status_code, 204)
        self.assertEqual(self.client.post(f"{LIST}/999999").status_code, 404)

    def test_csrf_is_required_for_writes(self):
        from rest_framework.test import APIClient

        client = APIClient(enforce_csrf_checks=True)
        token = client.get("/api/csrf").json()["csrfToken"]
        client.post(
            "/api/login",
            {"email": self.student.user.email, "password": "Example123"},
            format="json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(client.post(self.url(self.active)).status_code, 403)
        token = client.get("/api/csrf").json()["csrfToken"]
        self.assertEqual(
            client.post(self.url(self.active), HTTP_X_CSRFTOKEN=token).status_code, 201
        )
