# Création et publication d'une offre (JOB-051, repris par JOB-065) : tests de JOB-051 adaptés à la
# route de JOB-040, dont la lecture ne change pas, et à l'entreprise imposée par le serveur.
from django.test import Client
from rest_framework.test import APITestCase

from .models import Company, JobCategory, Offer, Recruiter, Role, User

LIST = "/api/recruiter/offers"


class OfferCreationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name="Atelier", siret="12345678901234")
        cls.other = Company.objects.create(name="Doctolib", siret="22345678901234")
        cls.user = User.objects.create_user(
            "recruiter@example.com",
            "Password123",
            last_name="Nom",
            first_name="Prénom",
            role=Role.RECRUITER,
        )
        cls.recruiter = Recruiter.objects.create(user=cls.user, company=cls.company)
        cls.payload = {
            "title": " Développeur Python ",
            "description": " Construire une application. ",
            "category": JobCategory.COMPUTER_SCIENCE,
            "requirements": "Python, Django",
            "image_url": "https://example.com/image.webp",
            "contract_type": "alternance",
            "duration": "12 mois",
            "start_date": "2027-01-01",
            "location": "Paris",
        }

    def setUp(self):
        self.client.force_login(self.user)

    def create(self, payload=None):
        return self.client.post(
            LIST, self.payload if payload is None else payload, format="json"
        )

    def makeUser(self, email: str, role: Role) -> User:
        return User.objects.create_user(
            email, "Password123", last_name="Nom", first_name="Prénom", role=role
        )

    def test_create_persists_all_fields_and_appears_in_the_list(self):
        response = self.create()
        self.assertEqual(response.status_code, 201, response.data)
        offer = Offer.objects.get()
        self.assertEqual(offer.recruiter_id, self.recruiter.pk)
        self.assertTrue(offer.is_active)
        self.assertEqual(offer.title, "Développeur Python")
        self.assertEqual(offer.description, "Construire une application.")
        self.assertEqual(offer.category, self.payload["category"])
        for field in [
            "requirements",
            "image_url",
            "contract_type",
            "duration",
            "location",
        ]:
            self.assertEqual(getattr(offer, field), self.payload[field])
        self.assertEqual(offer.start_date.isoformat(), "2027-01-01")
        body = response.json()
        self.assertEqual(body["company"], {"id": self.company.pk, "name": "Atelier"})
        self.assertEqual(body["start_date"], "2027-01-01")
        # « Vos offres » (JOB-040) : même format qu'avant, avec l'image en plus
        listed = self.client.get(LIST).json()
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["id"], offer.pk)
        self.assertEqual(listed[0]["image_url"], self.payload["image_url"])
        self.assertEqual(listed[0]["applicant_count"], 0)
        self.assertTrue(listed[0]["is_active"])

    def test_minimal_offer(self):
        response = self.create(
            {key: self.payload[key] for key in ["title", "description", "category"]}
        )
        self.assertEqual(response.status_code, 201, response.data)
        body = response.json()
        self.assertIsNone(body["start_date"])
        self.assertEqual((body["image_url"], body["contract_type"]), ("", ""))

    def test_missing_whitespace_and_invalid_fields_create_nothing(self):
        response = self.create({})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.data), {"title", "description", "category"})
        self.assertEqual(response.data["title"], ["Ce champ est obligatoire."])
        self.assertEqual(response.data["category"], ["Choisissez un secteur."])
        invalid = [
            ("title", " "),
            ("description", "\n\t"),
            ("title", "x" * 129),
            ("description", "x" * 2049),
            ("requirements", "x" * 257),
            ("category", 0),
            ("category", 999),
            ("category", "invalid"),
            ("category", None),
            ("contract_type", "invalid"),
            ("start_date", "2027-02-30"),
            ("image_url", "javascript:alert(1)"),
            ("image_url", "ftp://example.com/a.png"),
            ("image_url", "https://example.com/" + "x" * 200),
            ("location", "x" * 129),
            ("duration", "x" * 65),
        ]
        for field, value in invalid:
            with self.subTest(field=field, value=value):
                response = self.create({**self.payload, field: value})
                self.assertEqual(response.status_code, 400, response.data)
                self.assertEqual(list(response.data), [field])
        self.assertFalse(Offer.objects.exists())

    def test_company_cannot_be_chosen(self):
        # Ni le nom affiché, ni une autre entreprise, ni un autre recruteur
        for key, value in [
            ("company", "Doctolib"),
            ("company_id", self.other.pk),
            ("company_display_name", "Doctolib"),
            ("recruiter", self.recruiter.pk),
            ("recruiter_id", 999),
            ("is_active", False),
            ("id", 42),
            ("created_at", "2020-01-01"),
        ]:
            with self.subTest(key=key):
                response = self.create({**self.payload, key: value})
                self.assertEqual(response.status_code, 400)
                self.assertEqual(
                    response.data, {key: ["Ce champ ne peut pas être défini."]}
                )
        for payload in [[], "invalid", None]:
            response = self.client.post(LIST, payload, content_type="application/json")
            self.assertEqual(response.status_code, 400)
        self.assertFalse(Offer.objects.exists())

    def test_only_a_recruiter_with_a_company_can_publish(self):
        self.client.logout()
        self.assertEqual(self.create().status_code, 403)
        for role in [Role.STUDENT, Role.MANAGER, Role.ADMIN]:
            self.client.force_login(self.makeUser(f"{role}@example.com", role))
            self.assertEqual(self.create().status_code, 403)
        # Recruteur sans profil, puis sans entreprise
        alone = self.makeUser("seul@example.com", Role.RECRUITER)
        self.client.force_login(alone)
        self.assertEqual(self.create().json(), {"error": "No company"})
        Recruiter.objects.create(user=alone)
        self.assertEqual(self.create().status_code, 404)
        self.assertFalse(Offer.objects.exists())

    def test_published_for_the_recruiter_company_only(self):
        # Un recruteur de Doctolib publie au nom de Doctolib, jamais d'Atelier
        stranger = self.makeUser("rh@doctolib.fr", Role.RECRUITER)
        Recruiter.objects.create(user=stranger, company=self.other)
        self.client.force_login(stranger)
        body = self.create().json()
        self.assertEqual(body["company"]["name"], "Doctolib")
        self.assertEqual(Offer.objects.get().recruiter.company, self.other)

    def test_colleagues_cannot_see_new_offer_and_newest_is_first(self):
        first = self.create().json()
        second = self.create().json()
        self.assertEqual(
            [item["id"] for item in self.client.get(LIST).json()],
            [second["id"], first["id"]],
        )
        colleague = self.makeUser("colleague@example.com", Role.RECRUITER)
        Recruiter.objects.create(user=colleague, company=self.company)
        self.client.force_login(colleague)
        self.assertEqual(self.client.get(LIST).json(), [])

    def test_session_writes_require_csrf(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.user)
        self.assertEqual(
            client.post(
                LIST, self.payload, content_type="application/json"
            ).status_code,
            403,
        )
        token = client.get("/api/csrf").json()["csrfToken"]
        response = client.post(
            LIST,
            self.payload,
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, 201)
