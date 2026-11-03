from django.test import TestCase
from rest_framework.test import APIClient

from .models import Company, JobApplication, Offer, Recruiter, Role, Student, User


class OfferTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name="Atelier", siret="12345678901234")
        cls.owner = User.objects.create_user("owner@example.com", "Password1", name="Nom", first_name="Prénom", role=Role.RECRUITER)
        cls.recruiter = Recruiter.objects.create(user=cls.owner, company=cls.company)
        cls.other = User.objects.create_user("other@example.com", "Password1", name="Nom", first_name="Prénom", role=Role.RECRUITER)
        Recruiter.objects.create(user=cls.other, company=cls.company)
        cls.student = User.objects.create_user("student@example.com", "Password1", name="Nom", first_name="Prénom", role=Role.STUDENT)
        student = Student.objects.create(user=cls.student)
        cls.offer = Offer.objects.create(recruiter=cls.recruiter, title="Développeur", description="Description initiale", category=1)
        cls.application = JobApplication.objects.create(student=student, offer=cls.offer, message="Candidature")
        cls.url = f"/api/recruiter/offers/{cls.offer.pk}"
        cls.public_url = f"/api/offers/{cls.offer.pk}"

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def test_prefill_and_update_are_visible_in_list_and_detail(self):
        before = self.client.get(self.url).json()
        self.assertEqual(before["title"], "Développeur")
        changes = {"title": "Data analyst", "description": "Nouvelle description", "requirements": "SQL, Python",
                   "image_url": "https://example.com/image.webp", "contract_type": "alternance", "duration": "12 mois",
                   "start_date": "2027-01-01", "location": "Paris", "company": "Nouveau nom"}
        response = self.client.patch(self.url, changes, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        for key, value in changes.items():
            self.assertEqual(response.json()[key], value)
            self.assertEqual(self.client.get(self.url).json()[key], value)
            self.assertEqual(self.client.get("/api/recruiter/offers").json()["results"][0][key], value)
            self.assertEqual(self.client.get(self.public_url).json()[key], value)
        self.offer.refresh_from_db()
        self.recruiter.refresh_from_db()
        self.company.refresh_from_db()
        self.assertEqual(self.offer.recruiter_id, self.recruiter.pk)
        self.assertEqual(self.recruiter.company_id, self.company.pk)
        self.assertEqual(self.company.name, "Atelier")

    def test_delete_withdraws_everywhere_and_preserves_applications(self):
        self.assertEqual(self.client.delete(self.url).status_code, 204)
        self.offer.refresh_from_db()
        self.assertFalse(self.offer.is_active)
        self.assertTrue(JobApplication.objects.filter(pk=self.application.pk).exists())
        for url in [self.url, self.public_url]:
            self.assertEqual(self.client.get(url).status_code, 404)
        for url in ["/api/recruiter/offers", "/api/offers"]:
            self.assertEqual(self.client.get(url).json()["count"], 0)
        self.assertEqual(self.client.patch(self.url, {"title": "Restore"}, format="json").status_code, 404)
        self.assertEqual(self.client.delete(self.url).status_code, 404)

    def test_other_recruiter_even_same_company_cannot_access(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get("/api/recruiter/offers").json()["count"], 0)
        for method in ["get", "patch", "delete"]:
            self.assertEqual(getattr(self.client, method)(self.url).status_code, 404)
        self.offer.refresh_from_db()
        self.assertTrue(self.offer.is_active)

    def test_roles_and_anonymous_cannot_modify(self):
        for user in [None, self.student]:
            self.client.force_authenticate(user)
            for method in ["get", "patch", "delete"]:
                self.assertEqual(getattr(self.client, method)(self.url).status_code, 403)
        self.assertEqual(self.client.get(self.public_url).status_code, 200)

    def test_unknown_or_inactive_offer_is_not_mutable(self):
        for method in ["get", "patch", "delete"]:
            self.assertEqual(getattr(self.client, method)("/api/recruiter/offers/999999").status_code, 404)

    def test_invalid_payload_is_atomic_and_can_be_retried(self):
        cases = [{"title": ""}, {"title": "  "}, {"title": "x" * 129}, {"description": "x" * 2049},
                 {"requirements": "x" * 257}, {"location": "x" * 129}, {"duration": "x" * 65},
                 {"contract_type": "invalid"}, {"start_date": "2027-02-30"}, {"image_url": "not a URL"},
                 {"image_url": "ftp://example.com/image"}, {"image_url": "javascript:alert(1)"},
                 {"company": "x" * 129}, {"title": None}, ["invalid"], {"title": "New", "description": ""}]
        for changes in cases:
            with self.subTest(changes=changes):
                response = self.client.patch(self.url, changes, format="json")
                self.assertEqual(response.status_code, 400, response.data)
                self.offer.refresh_from_db()
                self.assertEqual(self.offer.title, "Développeur")
        self.assertEqual(self.client.patch(self.url, {"title": "Retry"}, format="json").status_code, 200)

    def test_ownership_and_publication_fields_cannot_be_changed(self):
        for field in ["recruiter", "recruiter_id", "company_id", "is_active", "category", "id"]:
            response = self.client.patch(self.url, {"title": "New", field: 2}, format="json")
            self.assertEqual(response.status_code, 400)
            self.offer.refresh_from_db()
            self.assertEqual(self.offer.title, "Développeur")

    def test_optional_fields_can_be_cleared(self):
        changes = {"image_url": "", "contract_type": "", "requirements": "", "duration": "", "start_date": None, "company": "", "location": ""}
        response = self.client.patch(self.url, changes, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["company"], self.company.name)

    def test_csrf_required_for_session_writes(self):
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.owner)
        self.assertEqual(client.patch(self.url, {"title": "New"}, format="json").status_code, 403)
        self.assertEqual(client.delete(self.url).status_code, 403)
        token = client.get("/api/csrf").json()["csrfToken"]
        self.assertEqual(client.patch(self.url, {"title": "New"}, format="json", HTTP_X_CSRFTOKEN=token).status_code, 200)
        self.assertEqual(client.delete(self.url, HTTP_X_CSRFTOKEN=token).status_code, 204)

    def test_pagination_only_includes_active_offers(self):
        for i in range(7):
            Offer.objects.create(recruiter=self.recruiter, title=f"Offre {i}", description="Description", category=1)
        response = self.client.get("/api/recruiter/offers")
        self.assertEqual(response.json()["count"], 8)
        self.assertEqual(len(response.json()["results"]), 6)
        self.assertEqual(len(self.client.get("/api/recruiter/offers?page=2").json()["results"]), 2)

    def test_public_search_uses_updated_values(self):
        self.client.patch(self.url, {"title": "Data analyst", "requirements": "SQL", "location": "Paris"}, format="json")
        for query in ["q=SQL", "q=Data", "location=Paris", "category=1"]:
            self.assertEqual(self.client.get(f"/api/offers?{query}").json()["count"], 1)
        for query in ["q=Unknown", "location=Lyon", "category=2"]:
            self.assertEqual(self.client.get(f"/api/offers?{query}").json()["count"], 0)
        self.assertEqual(self.client.get("/api/offers?category=invalid").status_code, 400)
