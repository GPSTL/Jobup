from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Company, JobCategory, Offer, Recruiter, Role, Student, User


class PublicOfferTests(APITestCase):
    def setUp(self):
        company = Company.objects.create(
            name="Atelier Studio", siret="12345678901234", city="Paris"
        )
        self.recruiter = Recruiter.objects.create(
            user=User.objects.create_user(
                "private@atelier.example",
                "Example123",
                first_name="Léa",
                last_name="Martin",
                role=Role.RECRUITER,
            ),
            company=company,
        )
        self.active = self.createOffer()
        self.inactive = self.createOffer(title="Non publiée", is_active=False)
        self.student = Student.objects.create(
            user=User.objects.create_user(
                "student@example.fr",
                "Example123",
                first_name="Lucas",
                last_name="Martin",
                role=Role.STUDENT,
            )
        )

    def createOffer(self, **changes):
        return Offer.objects.create(
            **{
                "recruiter": self.recruiter,
                "title": "Développeur Java",
                "description": "Une alternance dans notre équipe.",
                "requirements": "Java, SQL",
                "category": JobCategory.COMPUTER_SCIENCE,
                **changes,
            }
        )

    def detail(self, offer=None):
        return f"/api/offers/{(offer or self.active).pk}"

    def test_public_list_and_detail_have_same_explicit_safe_contract(self):
        listing = self.client.get("/api/offers")
        detail = self.client.get(self.detail())
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(listing.json(), [detail.json()])
        data = detail.json()
        self.assertEqual(
            set(data),
            {
                "id",
                "title",
                "description",
                "requirements",
                "category",
                "created_at",
                "company",
            },
        )
        self.assertEqual(data["id"], self.active.pk)
        self.assertEqual(data["title"], self.active.title)
        self.assertEqual(data["description"], self.active.description)
        self.assertEqual(data["requirements"], "Java, SQL")
        self.assertEqual(data["category"], JobCategory.COMPUTER_SCIENCE)
        self.assertEqual(
            data["company"],
            {
                "id": self.recruiter.company.pk,
                "name": "Atelier Studio",
                "city": "Paris",
            },
        )
        self.assertNotIn("private@atelier.example", detail.content.decode())

    def test_student_and_visitor_see_identical_offers(self):
        anonymous_list = self.client.get("/api/offers").json()
        anonymous_detail = self.client.get(self.detail()).json()
        self.client.force_authenticate(self.student.user)
        self.assertEqual(self.client.get("/api/offers").json(), anonymous_list)
        self.assertEqual(self.client.get(self.detail()).json(), anonymous_detail)

    def test_direct_browser_navigation_returns_json_without_browsable_api(self):
        accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        for url, status in (
            ("/api/offers", 200),
            (self.detail(), 200),
            (self.detail(self.inactive), 404),
        ):
            response = self.client.get(url, HTTP_ACCEPT=accept)
            self.assertEqual(response.status_code, status)
            self.assertEqual(response["Content-Type"], "application/json")
            self.assertNotIn("private@atelier.example", response.content.decode())
        for url in ("/api/offers", self.detail()):
            response = self.client.get(url, HTTP_ACCEPT="text/html")
            self.assertEqual(response.status_code, 406)
            self.assertEqual(response["Content-Type"], "application/json")

    def test_publication_and_withdrawal_take_effect_on_next_read(self):
        # No draft state exists yet: unpublished/withdrawn offers use is_active=False.
        for active in (False, True, False):
            self.inactive.is_active = active
            self.inactive.save(update_fields=["is_active"])
            ids = [offer["id"] for offer in self.client.get("/api/offers").json()]
            self.assertEqual(self.inactive.pk in ids, active)
            self.assertEqual(
                self.client.get(self.detail(self.inactive)).status_code,
                200 if active else 404,
            )

    def test_missing_and_inactive_details_are_indistinguishable(self):
        for user in (None, self.student.user):
            self.client.force_authenticate(user)
            inactive = self.client.get(self.detail(self.inactive))
            missing = self.client.get("/api/offers/999999")
            self.assertEqual(inactive.status_code, 404)
            self.assertEqual(missing.status_code, 404)
            self.assertEqual(inactive.json(), missing.json())

    def test_newest_first_with_id_tiebreaker_and_complete_results(self):
        newer = self.createOffer(title="Plus récente")
        tied = self.createOffer(title="Même date")
        now = timezone.now()
        Offer.objects.filter(pk=self.active.pk).update(
            created_at=now - timedelta(days=1)
        )
        Offer.objects.filter(pk__in=[newer.pk, tied.pk]).update(created_at=now)
        self.assertEqual(
            [row["id"] for row in self.client.get("/api/offers").json()],
            [tied.pk, newer.pk, self.active.pk],
        )

    def test_missing_company_and_empty_list(self):
        self.recruiter.company = None
        self.recruiter.save(update_fields=["company"])
        self.assertIsNone(self.client.get(self.detail()).json()["company"])
        self.assertIsNone(self.client.get("/api/offers").json()[0]["company"])
        Offer.objects.update(is_active=False)
        self.assertEqual(self.client.get("/api/offers").json(), [])

    def test_list_does_not_query_company_for_each_offer(self):
        for index in range(8):
            self.createOffer(title=f"Offre {index}")
        with self.assertNumQueries(1):
            response = self.client.get("/api/offers")
        self.assertEqual(len(response.json()), 9)

    def test_public_endpoints_do_not_allow_writes(self):
        self.client.force_authenticate(self.student.user)
        for url in ("/api/offers", self.detail()):
            for method in (
                self.client.post,
                self.client.put,
                self.client.patch,
                self.client.delete,
            ):
                self.assertEqual(method(url, {}).status_code, 405)
