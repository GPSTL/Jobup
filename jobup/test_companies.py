from rest_framework.test import APITestCase

from . import companies as api
from .models import Company, JobCategory, Offer, Recruiter, Role, User


class CompaniesTests(APITestCase):
    def setUp(self):
        self.acme = Company.objects.create(
            name="Acme", siret="12345678901234", sector=JobCategory.COMPUTER_SCIENCE, city="Paris",
            employees=120, website="https://acme.example", description="Présentation d'Acme",
        )
        self.blue = Company.objects.create(name="Blue Health", siret="22345678901234", sector=JobCategory.HEALTH, city="Lyon")
        self.cosy = Company.objects.create(name="Cosy Data", siret="32345678901234", sector=JobCategory.DATA_AI, city="Paris")

        user = User.objects.create_user("rh@acme.example", "Example123", last_name="Martin", first_name="Léa", role=Role.RECRUITER)
        recruiter = Recruiter.objects.create(user=user, company=self.acme)
        self.active = Offer.objects.create(recruiter=recruiter, title="Alternance dev", description="...", category=JobCategory.COMPUTER_SCIENCE)
        Offer.objects.create(recruiter=recruiter, title="Offre pourvue", description="...", category=JobCategory.COMPUTER_SCIENCE, is_active=False)

    def names(self, response):
        return [card["name"] for card in response.json()["results"]]

    def test_directory_is_public_sorted_and_counts_active_offers_only(self):
        response = self.client.get("/api/companies")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.names(response), ["Acme", "Blue Health", "Cosy Data"])
        acme = response.json()["results"][0]
        self.assertEqual(acme, {
            "id": self.acme.pk, "name": "Acme", "sector": JobCategory.COMPUTER_SCIENCE,
            "city": "Paris", "employees": 120, "description": "Présentation d'Acme", "active_offers": 1,
        })

    def test_private_fields_are_never_exposed(self):
        card = self.client.get("/api/companies").json()["results"][0]
        detail = self.client.get(f"/api/companies/{self.acme.pk}").json()
        for data in (card, detail):
            self.assertNotIn("siret", data)
            self.assertNotIn("recruiters", data)
        self.assertNotIn("recruiter", detail["offers"][0])

    def test_filters_can_be_combined(self):
        self.assertEqual(self.names(self.client.get("/api/companies", {"q": "  cosy "})), ["Cosy Data"])
        self.assertEqual(self.names(self.client.get("/api/companies", {"city": "paris"})), ["Acme", "Cosy Data"])
        self.assertEqual(self.names(self.client.get("/api/companies", {"sector": JobCategory.HEALTH})), ["Blue Health"])
        both = self.client.get("/api/companies", {"city": "Paris", "sector": JobCategory.DATA_AI})
        self.assertEqual(self.names(both), ["Cosy Data"])

    def test_empty_filters_are_ignored_and_no_result_is_not_an_error(self):
        self.assertEqual(len(self.names(self.client.get("/api/companies", {"q": "", "sector": "", "city": " "}))), 3)
        response = self.client.get("/api/companies", {"q": "introuvable"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"count": 0, "page": 1, "pages": 1, "results": []})

    def test_invalid_filters_are_refused(self):
        for params in ({"sector": "1000"}, {"sector": "abc"}, {"page": "0"}, {"page": "x"}):
            self.assertEqual(self.client.get("/api/companies", params).status_code, 400, params)

    def test_pagination(self):
        # 3 entreprises du setUp + PAGE_SIZE : la 2e page contient les 3 dernières
        for i in range(api.PAGE_SIZE):
            Company.objects.create(name=f"Zeta {i:02}", siret=f"9{i:013}")
        first = self.client.get("/api/companies").json()
        self.assertEqual((first["count"], first["pages"], len(first["results"])), (api.PAGE_SIZE + 3, 2, api.PAGE_SIZE))
        second = self.client.get("/api/companies", {"page": 2}).json()
        last = [f"Zeta {i:02}" for i in range(api.PAGE_SIZE - 3, api.PAGE_SIZE)]
        self.assertEqual([card["name"] for card in second["results"]], last)
        self.assertEqual(self.client.get("/api/companies", {"page": 5}).json()["results"], [])

    def test_cities_are_distinct_sorted_and_skip_empty(self):
        Company.objects.create(name="Sans ville", siret="42345678901234")
        response = self.client.get("/api/companies/cities")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), ["Lyon", "Paris"])

    def test_company_page_shows_presentation_and_active_offers(self):
        response = self.client.get(f"/api/companies/{self.acme.pk}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["website"], "https://acme.example")
        self.assertEqual(data["description"], "Présentation d'Acme")
        self.assertEqual(data["active_offers"], 1)
        self.assertEqual([offer["title"] for offer in data["offers"]], ["Alternance dev"])
        self.assertEqual(data["offers"][0]["id"], self.active.pk)

    def test_company_without_details_or_offers(self):
        data = self.client.get(f"/api/companies/{self.blue.pk}").json()
        self.assertEqual((data["employees"], data["website"], data["description"]), (None, "", ""))
        self.assertEqual((data["active_offers"], data["offers"]), (0, []))

    def test_unknown_company_is_not_found(self):
        self.assertEqual(self.client.get("/api/companies/999999").status_code, 404)

    def test_read_only(self):
        self.assertEqual(self.client.post("/api/companies", {}).status_code, 405)
        self.assertEqual(self.client.patch(f"/api/companies/{self.acme.pk}", {}).status_code, 405)
