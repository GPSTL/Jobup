from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework.test import APITestCase

from .models import Company, JobCategory, Offer, Recruiter, Role, User


class RecruiterOffersTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        company = Company.objects.create(name="Entreprise", siret="12345678901234")
        cls.user = User.objects.create_user(
            email="recruiter@example.com", password="Password123", last_name="Nom",
            first_name="Prénom", role=Role.RECRUITER,
        )
        cls.recruiter = Recruiter.objects.create(user=cls.user, company=company)
        colleague = User.objects.create_user(
            email="colleague@example.com", password="Password123", last_name="Nom",
            first_name="Prénom", role=Role.RECRUITER,
        )
        cls.colleague = Recruiter.objects.create(user=colleague, company=company)
        cls.offers = [Offer.objects.create(
            recruiter=cls.recruiter, title=f"Offre {i}", description=f"Description {i}",
            category=JobCategory.COMPUTER_SCIENCE,
        ) for i in range(14)]
        cls.private = Offer.objects.create(
            recruiter=cls.colleague, title="Autre recruteur", description="Confidentiel",
            category=JobCategory.COMPUTER_SCIENCE,
        )
        cls.inactive = Offer.objects.create(
            recruiter=cls.recruiter, title="Brouillon", description="Non publiée",
            category=JobCategory.COMPUTER_SCIENCE, is_active=False,
        )

    def setUp(self):
        self.client.force_login(self.user)

    def test_complete_list_order_and_serialization(self):
        response = self.client.get("/api/recruiter/offers")
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data["results"], list)
        self.assertEqual(response.data["count"], 14)
        self.assertEqual(
            [item["id"] for item in response.data["results"]],
            [offer.pk for offer in reversed(self.offers)][:6],
        )
        item = response.data["results"][0]
        for key in ["title", "image_url", "description", "requirements", "company", "category", "created_at"]:
            self.assertIn(key, item)
        self.assertEqual(item["image_url"], "")

    def test_detail_and_custom_image(self):
        offer = self.offers[0]
        offer.image_url = "https://example.com/offer.webp"
        offer.save()
        response = self.client.get(f"/api/recruiter/offers/{offer.pk}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["image_url"], offer.image_url)
        self.assertEqual(response.data["description"], offer.description)

    def test_direct_access_never_exposes_other_or_inactive_offers(self):
        for pk in [self.private.pk, self.inactive.pk, 999999]:
            response = self.client.get(f"/api/recruiter/offers/{pk}")
            self.assertEqual(response.status_code, 404)

    def test_requires_recruiter_session(self):
        paths = ["/api/recruiter/offers", f"/api/recruiter/offers/{self.offers[0].pk}"]
        self.client.logout()
        for path in paths:
            self.assertEqual(self.client.get(path).status_code, 403)
        for role in [Role.STUDENT, Role.MANAGER, Role.ADMIN]:
            user = User.objects.create_user(
                email=f"{role}@example.com", password="Password123", last_name="Nom",
                first_name="Prénom", role=role,
            )
            self.client.force_login(user)
            for path in paths:
                self.assertEqual(self.client.get(path).status_code, 403)

    def test_empty_and_missing_profile(self):
        self.client.force_login(self.colleague.user)
        self.private.delete()
        response = self.client.get("/api/recruiter/offers")
        self.assertEqual(response.data["results"], [])
        self.colleague.delete()
        self.assertEqual(self.client.get("/api/recruiter/offers").data["results"], [])

    def test_pagination_and_detail_methods(self):
        response = self.client.get("/api/recruiter/offers?page=2")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 14)
        self.assertEqual(len(response.data["results"]), 6)
        for page in ["0", "-1", "abc", "6", "9999999999999999999999999"]:
            self.assertEqual(self.client.get(f"/api/recruiter/offers?page={page}").status_code, 404)
        self.assertEqual(self.client.post("/api/recruiter/offers", {}, format="json").status_code, 400)
        self.assertEqual(self.client.post(f"/api/recruiter/offers/{self.offers[0].pk}", {}).status_code, 405)

    def test_seed_is_repeatable_and_scoped(self):
        output = StringIO()
        call_command("seed_recruiter_offers", self.user.email, stdout=output)
        call_command("seed_recruiter_offers", self.user.email, stdout=output)
        self.assertEqual(self.recruiter.offers.filter(title__startswith="[Démo JOB-022]").count(), 14)
        self.assertEqual(self.colleague.offers.count(), 1)
        with self.assertRaises(CommandError):
            call_command("seed_recruiter_offers", "missing@example.com", stdout=output)
