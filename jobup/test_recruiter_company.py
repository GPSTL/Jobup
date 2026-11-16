import io
import tempfile

from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient, APITestCase

from .models import Company, JobCategory, Offer, Recruiter, Role, User
from .test_profile import PASSWORD, createStudent, imageBytes

URL = "/api/recruiter/company"

ATELIER = {
    "name": "Atelier Studio",
    "sector": JobCategory.COMPUTER_SCIENCE,
    "city": "Paris 9e",
    "description": "Atelier Studio conçoit des applications web et mobiles.",
}


def createRecruiter(email: str, company: Company | None) -> User:
    user = User.objects.create_user(
        email, PASSWORD, last_name="Martin", first_name="Léa", role=Role.RECRUITER
    )
    Recruiter.objects.create(user=user, company=company)
    return user


class RecruiterCompanyTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.atelier = Company.objects.create(
            name="Atelier", siret="12345678901234", sector=JobCategory.DESIGN
        )
        cls.other = Company.objects.create(
            name="Blue Health",
            siret="22345678901234",
            sector=JobCategory.HEALTH,
            city="Lyon",
            description="Présentation de Blue Health",
        )
        cls.lea = createRecruiter("lea@atelier.fr", cls.atelier)
        cls.colleague = createRecruiter("paul@atelier.fr", cls.atelier)
        cls.stranger = createRecruiter("rh@blue.fr", cls.other)
        cls.alone = createRecruiter("seul@mail.fr", None)
        cls.student = createStudent("etudiant@mail.fr")
        recruiter = Recruiter.objects.get(user=cls.lea)
        for title, active in (("Alternance dev", True), ("Offre pourvue", False)):
            Offer.objects.create(
                recruiter=recruiter,
                title=title,
                description="...",
                category=JobCategory.COMPUTER_SCIENCE,
                is_active=active,
            )

    def setUp(self):
        # Les logos envoyés vont dans un dossier temporaire, supprimé après chaque test
        media = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(self.settings(MEDIA_ROOT=media))
        self.client.force_login(self.lea)

    def fresh(self, company: Company) -> Company:
        return Company.objects.get(pk=company.pk)


class ReadTests(RecruiterCompanyTestCase):
    def test_recruiter_reads_own_company(self):
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "id": self.atelier.pk,
                "name": "Atelier",
                "logo_url": None,
                "sector": JobCategory.DESIGN,
                "city": "",
                "employees": None,
                "website": "",
                "description": "",
                "active_offers": 1,
            },
        )

    def test_siret_is_never_exposed(self):
        self.assertNotIn("siret", self.client.get(URL).json())

    def test_only_recruiters(self):
        self.client.logout()
        self.assertEqual(self.client.get(URL).status_code, 403)
        self.client.force_login(self.student)
        self.assertEqual(self.client.get(URL).status_code, 403)
        self.assertEqual(self.client.patch(URL, ATELIER).status_code, 403)
        self.assertEqual(self.fresh(self.atelier).name, "Atelier")

    def test_recruiter_without_company(self):
        self.client.force_login(self.alone)
        self.assertEqual(self.client.get(URL).json(), {"error": "No company"})
        self.assertEqual(self.client.get(URL).status_code, 404)
        self.assertEqual(self.client.patch(URL, ATELIER).status_code, 404)

    def test_methods(self):
        self.assertEqual(self.client.post(URL, ATELIER).status_code, 405)
        self.assertEqual(self.client.delete(URL).status_code, 405)


class UpdateTests(RecruiterCompanyTestCase):
    def test_update_is_saved_and_shown_on_the_public_page(self):
        response = self.client.patch(URL, ATELIER, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "Atelier Studio")
        self.assertEqual(response.json()["active_offers"], 1)

        # Après rechargement : relu en base, et sur la page publique de JOB-021
        atelier = self.fresh(self.atelier)
        self.assertEqual(atelier.city, "Paris 9e")
        self.assertEqual(atelier.sector, JobCategory.COMPUTER_SCIENCE)
        self.client.logout()
        public = self.client.get(f"/api/companies/{self.atelier.pk}").json()
        for field, value in ATELIER.items():
            self.assertEqual(public[field], value)

    def test_other_fields_are_kept(self):
        Company.objects.filter(pk=self.atelier.pk).update(
            employees=70, website="https://atelier.fr"
        )
        self.client.patch(URL, ATELIER, format="json")
        atelier = self.fresh(self.atelier)
        self.assertEqual(atelier.employees, 70)
        self.assertEqual(atelier.website, "https://atelier.fr")
        self.assertEqual(atelier.siret, "12345678901234")

    def test_whitespace_stripped_and_optional_fields_cleared(self):
        self.client.patch(URL, ATELIER, format="json")
        response = self.client.patch(
            URL,
            {"name": "  Atelier Studio ", "sector": JobCategory.COMPUTER_SCIENCE},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        atelier = self.fresh(self.atelier)
        self.assertEqual(atelier.name, "Atelier Studio")
        self.assertEqual((atelier.city, atelier.description), ("", ""))

    def test_name_and_sector_are_required(self):
        for changes, field in (
            ({"sector": JobCategory.DESIGN}, "name"),
            ({"name": "   ", "sector": JobCategory.DESIGN}, "name"),
            ({"name": "Atelier Studio"}, "sector"),
            ({"name": "Atelier Studio", "sector": 999}, "sector"),
            ({"name": "Atelier Studio", "sector": "design"}, "sector"),
        ):
            response = self.client.patch(URL, changes, format="json")
            self.assertEqual(response.status_code, 400, changes)
            self.assertIn(field, response.json()["errors"])
        self.assertEqual(self.fresh(self.atelier).name, "Atelier")

    def test_maximum_lengths(self):
        longest = {
            "name": "N" * 128,
            "sector": JobCategory.DESIGN,
            "city": "C" * 64,
            "description": "D" * 2048,
        }
        self.assertEqual(
            self.client.patch(URL, longest, format="json").status_code, 200
        )
        for field in ("name", "city", "description"):
            too_long = {**longest, field: longest[field] + "x"}
            response = self.client.patch(URL, too_long, format="json")
            self.assertEqual(response.status_code, 400)
            self.assertEqual(list(response.json()["errors"]), [field])

    def test_name_of_another_company_refused(self):
        response = self.client.patch(
            URL, {**ATELIER, "name": "blue health"}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["errors"],
            {"name": "Une autre entreprise porte déjà ce nom."},
        )

    def test_another_company_cannot_be_targeted(self):
        # Ni l'identifiant ni le SIRET ne sont acceptés : seule l'entreprise du recruteur change
        for field, value in (("id", self.other.pk), ("siret", "22345678901234")):
            response = self.client.patch(URL, {**ATELIER, field: value}, format="json")
            self.assertEqual(response.status_code, 400)
            self.assertEqual(
                response.json()["errors"], {field: "Ce champ ne peut pas être modifié."}
            )
        # Le recruteur d'une autre entreprise ne modifie que la sienne
        self.client.force_login(self.stranger)
        self.client.patch(
            URL, {"name": "Blue Health 2", "sector": JobCategory.HEALTH}, format="json"
        )
        self.assertEqual(self.fresh(self.atelier).name, "Atelier")
        self.assertEqual(self.fresh(self.other).name, "Blue Health 2")
        # La page publique reste en lecture seule
        self.assertEqual(
            self.client.patch(f"/api/companies/{self.atelier.pk}", ATELIER).status_code,
            405,
        )

    def test_colleague_of_the_same_company_can_edit(self):
        self.client.force_login(self.colleague)
        self.assertEqual(
            self.client.patch(URL, ATELIER, format="json").status_code, 200
        )
        self.assertEqual(self.fresh(self.atelier).name, "Atelier Studio")

    def test_malformed_body(self):
        response = self.client.patch(URL, "[]", content_type="application/json")
        self.assertEqual(response.status_code, 400)

    def test_csrf_token_is_required(self):
        client = APIClient(enforce_csrf_checks=True)
        token = client.get("/api/csrf").json()["csrfToken"]
        client.post(
            "/api/login",
            {"email": self.lea.email, "password": PASSWORD},
            format="json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(client.patch(URL, ATELIER, format="json").status_code, 403)
        token = client.get("/api/csrf").json()["csrfToken"]
        response = client.patch(URL, ATELIER, format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200)


class LogoTests(RecruiterCompanyTestCase):
    def send(self, filename: str, content: bytes, **changes):
        data = {**ATELIER, **changes, "logo": SimpleUploadedFile(filename, content)}
        return self.client.patch(URL, data, format="multipart")

    def test_logo_replaced_with_the_fields(self):
        response = self.send("logo.png", imageBytes("PNG"))
        self.assertEqual(response.status_code, 200)
        first = self.fresh(self.atelier).logo.name or ""
        self.assertRegex(first, r"^logos/[0-9a-f]{32}\.png$")
        self.assertEqual(response.json()["logo_url"], f"/media/{first}")
        self.assertEqual(response.json()["name"], "Atelier Studio")

        # Nouveau logo : nouvelle URL, et l'ancien fichier est supprimé
        self.assertEqual(self.send("logo.jpg", imageBytes("JPEG")).status_code, 200)
        second = self.fresh(self.atelier).logo.name or ""
        self.assertTrue(second.endswith(".jpg"))
        self.assertTrue(default_storage.exists(second))
        self.assertFalse(default_storage.exists(first))

        # Visible sur la page publique et dans le répertoire (JOB-021)
        self.client.logout()
        public = self.client.get(f"/api/companies/{self.atelier.pk}").json()
        self.assertEqual(public["logo_url"], f"/media/{second}")
        cards = self.client.get("/api/companies").json()["results"]
        self.assertIn(f"/media/{second}", [card["logo_url"] for card in cards])

    def test_fields_alone_keep_the_logo(self):
        self.send("logo.png", imageBytes("PNG"))
        logo = self.fresh(self.atelier).logo.name
        self.client.patch(URL, {**ATELIER, "city": "Lyon"}, format="multipart")
        self.assertEqual(self.fresh(self.atelier).logo.name, logo)

    def test_other_formats_refused(self):
        for name, content in (
            ("logo.gif", imageBytes("GIF")),
            ("logo.png", b"not an image"),
            ("logo.pdf", b"%PDF-1.4"),
        ):
            response = self.send(name, content)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(
                response.json()["errors"],
                {"logo": "Le logo doit être au format JPG ou PNG."},
            )

    def test_size_limit(self):
        jpeg = imageBytes("JPEG")
        largest = jpeg + b"\0" * (2 * 1024 * 1024 - len(jpeg))
        self.assertEqual(self.send("logo.jpg", largest).status_code, 200)
        response = self.send("logo.jpg", largest + b"\0")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["errors"], {"logo": "Le logo ne doit pas dépasser 2 Mo."}
        )

    def test_failure_keeps_the_previous_page(self):
        self.send("logo.png", imageBytes("PNG"))
        before = self.fresh(self.atelier)
        # Champs valides mais logo refusé : rien n'est enregistré
        response = self.send("logo.gif", imageBytes("GIF"), city="Lyon")
        self.assertEqual(response.status_code, 400)
        after = self.fresh(self.atelier)
        self.assertEqual((after.city, after.logo.name), (before.city, before.logo.name))
        # Logo valide mais nom manquant : le logo n'est pas remplacé
        response = self.send("logo.jpg", imageBytes("JPEG"), name="")
        self.assertEqual(list(response.json()["errors"]), ["name"])
        self.assertEqual(self.fresh(self.atelier).logo.name, before.logo.name)
        self.assertTrue(default_storage.exists(before.logo.name or ""))

    def test_pixel_limit(self):
        # Un bit par pixel : fichier de quelques Ko, refusé avant d'être décodé
        buffer = io.BytesIO()
        Image.new("1", (5000, 5001)).save(buffer, "PNG")
        response = self.send("logo.png", buffer.getvalue())
        self.assertEqual(
            response.json()["errors"],
            {"logo": "Le logo ne doit pas dépasser 25 mégapixels."},
        )
