from django.test import Client
from rest_framework.test import APITestCase

from .models import Company, JobCategory, Offer, Recruiter, Role, User


class OfferCreationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name="Atelier", siret="12345678901234")
        cls.user = User.objects.create_user("recruiter@example.com", "Password123",
                                           name="Nom", first_name="Prénom", role=Role.RECRUITER)
        cls.recruiter = Recruiter.objects.create(user=cls.user, company=cls.company)
        cls.payload = {"title": " Développeur Python ", "description": " Construire une application. ",
                       "category": JobCategory.COMPUTER_SCIENCE, "requirements": "Python, Django",
                       "image_url": "https://example.com/image.webp", "contract_type": "alternance",
                       "duration": "12 mois", "start_date": "2027-01-01", "company": "Atelier Studio",
                       "location": "Paris"}

    def setUp(self):
        self.client.force_login(self.user)

    def create(self, payload=None):
        return self.client.post("/api/recruiter/offers", self.payload if payload is None else payload, format="json")

    def test_create_persists_all_fields_and_appears_in_list_and_detail(self):
        response = self.create()
        self.assertEqual(response.status_code, 201, response.data)
        offer = Offer.objects.get()
        self.assertEqual(offer.recruiter_id, self.recruiter.pk)
        self.assertTrue(offer.is_active)
        self.assertEqual(offer.title, "Développeur Python")
        self.assertEqual(offer.description, "Construire une application.")
        self.assertEqual(offer.category, self.payload["category"])
        for field in ["requirements", "image_url", "contract_type", "duration", "location"]:
            self.assertEqual(getattr(offer, field), self.payload[field])
        self.assertEqual(offer.start_date.isoformat(), "2027-01-01")
        self.assertEqual(offer.company_display_name, "Atelier Studio")
        self.assertEqual(self.company.name, "Atelier")
        self.assertEqual(self.client.get("/api/recruiter/offers").data, [response.data])
        self.assertEqual(self.client.get(f"/api/recruiter/offers/{offer.pk}").data, response.data)

    def test_minimal_offer_and_company_defaults(self):
        response = self.create({key: self.payload[key] for key in ["title", "description", "category"]})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["company"], "Atelier")
        self.assertIsNone(response.data["start_date"])
        self.assertEqual(response.data["image_url"], "")

    def test_missing_whitespace_and_invalid_fields_create_nothing(self):
        response = self.create({})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.data), {"title", "description", "category"})
        invalid = [("title", " "), ("description", "\n\t"), ("title", "x" * 129),
                   ("description", "x" * 2049), ("requirements", "x" * 257),
                   ("category", 0), ("category", 30), ("category", "invalid"), ("category", None),
                   ("contract_type", "invalid"), ("start_date", "2027-02-30"),
                   ("image_url", "javascript:alert(1)"), ("image_url", "ftp://example.com/a.png"),
                   ("location", "x" * 129), ("duration", "x" * 65), ("company", "x" * 129)]
        for field, value in invalid:
            with self.subTest(field=field, value=value):
                response = self.create({**self.payload, field: value})
                self.assertEqual(response.status_code, 400, response.data)
                self.assertIn(field, response.data)
        self.assertFalse(Offer.objects.exists())

    def test_rejects_forged_fields_and_non_object_payload(self):
        for key, value in [("recruiter", self.recruiter.pk), ("recruiter_id", 999),
                           ("is_active", False), ("id", 42), ("created_at", "2020-01-01"),
                           ("company_display_name", "Forged")]:
            with self.subTest(key=key):
                response = self.create({**self.payload, key: value})
                self.assertEqual(response.status_code, 400)
                self.assertIn(key, response.data)
        for payload in [[], "invalid", None]:
            response = self.client.post("/api/recruiter/offers", payload, content_type="application/json")
            self.assertEqual(response.status_code, 400)
        self.assertFalse(Offer.objects.exists())

    def test_requires_recruiter_and_profile(self):
        self.client.logout()
        self.assertEqual(self.create().status_code, 403)
        self.assertEqual(self.client.get("/api/recruiter/offers/categories").status_code, 403)
        for role in [Role.STUDENT, Role.MANAGER, Role.ADMIN, Role.RECRUITER]:
            user = User.objects.create_user(f"{role}@example.com", "Password123",
                                           name="Nom", first_name="Prénom", role=role)
            self.client.force_login(user)
            self.assertEqual(self.create().status_code, 404 if role == Role.RECRUITER else 403)
        self.assertFalse(Offer.objects.exists())

    def test_colleagues_cannot_see_new_offer_and_newest_is_first(self):
        first = self.create().data
        second = self.create().data
        self.assertEqual([item["id"] for item in self.client.get("/api/recruiter/offers").data],
                         [second["id"], first["id"]])
        colleague = User.objects.create_user("colleague@example.com", "Password123",
                                            name="Nom", first_name="Prénom", role=Role.RECRUITER)
        Recruiter.objects.create(user=colleague, company=self.company)
        self.client.force_login(colleague)
        self.assertEqual(self.client.get("/api/recruiter/offers").data, [])
        self.assertEqual(self.client.get(f'/api/recruiter/offers/{first["id"]}').status_code, 404)
        Offer.objects.filter(pk=first["id"]).update(is_active=False)
        self.client.force_login(self.user)
        self.assertEqual(self.client.get(f'/api/recruiter/offers/{first["id"]}').status_code, 404)

    def test_categories_match_model(self):
        response = self.client.get("/api/recruiter/offers/categories")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [{"value": value, "label": label} for value, label in JobCategory.choices])

    def test_session_writes_require_csrf(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.user)
        self.assertEqual(client.post("/api/recruiter/offers", self.payload,
                                     content_type="application/json").status_code, 403)
        token = client.get("/api/csrf").json()["csrfToken"]
        response = client.post("/api/recruiter/offers", self.payload, content_type="application/json",
                               HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 201)
