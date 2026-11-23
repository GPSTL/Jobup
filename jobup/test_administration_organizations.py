from rest_framework.test import APITestCase

from .models import (
    Company,
    Recruiter,
    ReviewStatus,
    Role,
    School,
    SchoolManager,
    Student,
    User,
)

COMPANIES = "/api/administration/companies"
SCHOOLS = "/api/administration/schools"
PAGES = ("/administration/companies", "/administration/schools")


def account(email: str, role: Role) -> User:
    return User.objects.create(
        email=email, first_name="Alice", last_name="Martin", role=role
    )


def company(name: str, siret: str, **fields) -> Company:
    return Company.objects.create(name=name, siret=siret, **fields)


class OrganizationTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            "admin@example.fr", "Password123", first_name="Jean", last_name="Taire"
        )
        self.client.force_login(self.admin)

    def names(self, url: str, **params) -> list[str]:
        response = self.client.get(url, params)
        self.assertEqual(response.status_code, 200, response.content)
        return [row["name"] for row in response.json()["results"]]


class CompanyListTests(OrganizationTests):
    def test_new_organizations_are_pending(self):
        self.assertEqual(company("Acme", "12345678901234").status, ReviewStatus.PENDING)
        self.assertEqual(
            School.objects.create(name="Lyon").status, ReviewStatus.PENDING
        )

    def test_row(self):
        acme = company(
            "Acme",
            "12345678901234",
            city="Paris",
            website="https://acme.example",
        )
        for i in range(2):
            Recruiter.objects.create(
                user=account(f"r{i}@example.fr", Role.RECRUITER), company=acme
            )
        data = self.client.get(COMPANIES).json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["total_pages"], 1)
        self.assertEqual(data["page_size"], 10)
        self.assertEqual(
            data["results"],
            [
                {
                    "id": acme.pk,
                    "name": "Acme",
                    "siret": "12345678901234",
                    "city": "Paris",
                    "website": "https://acme.example",
                    "status": "pending",
                    "recruiters": 2,
                }
            ],
        )

    def test_search_status_and_sort(self):
        acme = company("Acme", "11111111111111", city="Paris")
        beta = company("beta", "22222222222222", city="Lyon")
        zed = company("Zed", "33333333333333")
        Company.objects.filter(pk=beta.pk).update(status=ReviewStatus.VALIDATED)
        Company.objects.filter(pk=zed.pk).update(status=ReviewStatus.REFUSED)
        Recruiter.objects.create(
            user=account("r@example.fr", Role.RECRUITER), company=zed
        )
        self.assertEqual(self.names(COMPANIES), ["Acme", "beta", "Zed"])
        self.assertEqual(self.names(COMPANIES, sort="-name"), ["Zed", "beta", "Acme"])
        # Case ignored; the companies without a city come first
        self.assertEqual(self.names(COMPANIES, sort="city"), ["Zed", "beta", "Acme"])
        self.assertEqual(self.names(COMPANIES, sort="-recruiters")[0], "Zed")
        self.assertEqual(self.names(COMPANIES, sort="status"), ["Acme", "beta", "Zed"])
        self.assertEqual(self.names(COMPANIES, status="validated"), ["beta"])
        self.assertEqual(self.names(COMPANIES, status="refused"), ["Zed"])
        self.assertEqual(self.names(COMPANIES, status="pending"), ["Acme"])
        # Name, SIRET or city, every word
        self.assertEqual(self.names(COMPANIES, q="ACM"), ["Acme"])
        self.assertEqual(self.names(COMPANIES, q="2222"), ["beta"])
        self.assertEqual(self.names(COMPANIES, q="lyon"), ["beta"])
        self.assertEqual(self.names(COMPANIES, q="acme lyon"), [])
        self.assertEqual(self.names(COMPANIES, q="%"), [])
        # An empty criterion is not applied
        self.assertEqual(len(self.names(COMPANIES, q="", status="")), 3)
        self.assertEqual(acme.pk, Company.objects.get(name="Acme").pk)

    def test_pagination(self):
        for i in range(12):
            company(f"Company {i:02}", f"{i:014}")
        first = self.client.get(COMPANIES).json()
        second = self.client.get(COMPANIES, {"page": 2}).json()
        self.assertEqual((first["count"], first["total_pages"]), (12, 2))
        self.assertEqual(len(first["results"]), 10)
        self.assertEqual(len(second["results"]), 2)
        self.assertEqual(len(self.names(COMPANIES, page_size=25)), 12)

    def test_invalid_filters(self):
        for params in (
            {"page": "0"},
            {"page": "abc"},
            {"page_size": "11"},
            {"status": "deleted"},
            {"sort": "siret"},
            {"sort": "password"},
            {"q": "x" * 101},
        ):
            with self.subTest(params=params):
                self.assertEqual(self.client.get(COMPANIES, params).status_code, 400)
        self.assertEqual(self.client.get(COMPANIES, {"page": 2}).status_code, 404)

    def test_empty_list(self):
        data = self.client.get(COMPANIES).json()
        self.assertEqual(
            (data["count"], data["total_pages"], data["results"]), (0, 1, [])
        )


class SchoolListTests(OrganizationTests):
    def test_row_and_counts(self):
        lyon = School.objects.create(name="Lyon 2")
        for i in range(3):
            Student.objects.create(
                user=account(f"s{i}@example.fr", Role.STUDENT), school=lyon
            )
        SchoolManager.objects.create(
            user=account("m@example.fr", Role.MANAGER), school=lyon
        )
        School.objects.create(name="Vide")
        data = self.client.get(SCHOOLS).json()
        self.assertEqual(
            data["results"][0],
            {
                "id": lyon.pk,
                "name": "Lyon 2",
                "status": "pending",
                "students": 3,
                "managers": 1,
            },
        )
        self.assertEqual(data["results"][1]["students"], 0)
        self.assertEqual(self.names(SCHOOLS, sort="-students"), ["Lyon 2", "Vide"])
        self.assertEqual(self.names(SCHOOLS, sort="managers"), ["Vide", "Lyon 2"])

    def test_search_status_and_sort(self):
        paris = School.objects.create(name="Université Paris")
        lyon = School.objects.create(name="lyon 2")
        School.objects.filter(pk=lyon.pk).update(status=ReviewStatus.VALIDATED)
        self.assertEqual(self.names(SCHOOLS), ["lyon 2", "Université Paris"])
        self.assertEqual(
            self.names(SCHOOLS, sort="-name"), ["Université Paris", "lyon 2"]
        )
        self.assertEqual(
            self.names(SCHOOLS, sort="-status"), ["lyon 2", "Université Paris"]
        )
        self.assertEqual(self.names(SCHOOLS, q="PARIS"), ["Université Paris"])
        self.assertEqual(self.names(SCHOOLS, status="validated"), ["lyon 2"])
        self.assertEqual(self.names(SCHOOLS, status="refused"), [])
        self.assertEqual(paris.status, ReviewStatus.PENDING)

    def test_invalid_filters(self):
        for params in ({"sort": "siret"}, {"sort": "recruiters"}, {"status": "x"}):
            with self.subTest(params=params):
                self.assertEqual(self.client.get(SCHOOLS, params).status_code, 400)


class ReviewTests(OrganizationTests):
    def setUp(self):
        super().setUp()
        self.company = company("Acme", "12345678901234")
        self.school = School.objects.create(name="Lyon 2")
        Recruiter.objects.create(
            user=account("r@example.fr", Role.RECRUITER), company=self.company
        )

    def patch(self, url: str, status: str):
        return self.client.patch(url, {"status": status}, format="json")

    def test_validate_refuse_and_change_your_mind(self):
        for url, row, model in (
            (f"{COMPANIES}/{self.company.pk}/status", self.company, Company),
            (f"{SCHOOLS}/{self.school.pk}/status", self.school, School),
        ):
            # Every status can replace every other, in both directions
            for status, stored in (
                ("validated", ReviewStatus.VALIDATED),
                ("refused", ReviewStatus.REFUSED),
                ("validated", ReviewStatus.VALIDATED),
                ("pending", ReviewStatus.PENDING),
                ("refused", ReviewStatus.REFUSED),
                ("refused", ReviewStatus.REFUSED),
            ):
                with self.subTest(url=url, status=status):
                    response = self.patch(url, status)
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json()["status"], status)
                    self.assertEqual(response.json()["id"], row.pk)
                    self.assertEqual(model.objects.get(pk=row.pk).status, stored)

    def test_answers_the_row_with_its_counts(self):
        data = self.patch(f"{COMPANIES}/{self.company.pk}/status", "validated").json()
        self.assertEqual(data["recruiters"], 1)
        self.assertEqual(data["name"], "Acme")
        # The new status is the one listed
        self.assertEqual(self.names(COMPANIES, status="validated"), ["Acme"])

    def test_invalid_payload_and_unknown_organization(self):
        for url in (
            f"{COMPANIES}/{self.company.pk}/status",
            f"{SCHOOLS}/{self.school.pk}/status",
        ):
            for payload in (
                {},
                {"status": "deleted"},
                {"status": 1},
                {"status": "validated", "name": "x"},
            ):
                with self.subTest(url=url, payload=payload):
                    response = self.client.patch(url, payload, format="json")
                    self.assertEqual(response.status_code, 400)
        self.assertEqual(Company.objects.get().status, ReviewStatus.PENDING)
        self.assertEqual(
            self.patch(f"{COMPANIES}/999999/status", "validated").status_code, 404
        )
        self.assertEqual(
            self.patch(f"{SCHOOLS}/999999/status", "validated").status_code, 404
        )

    def test_methods(self):
        for url in (
            f"{COMPANIES}/{self.company.pk}/status",
            f"{SCHOOLS}/{self.school.pk}/status",
        ):
            self.assertEqual(self.client.get(url).status_code, 405)
            self.assertEqual(
                self.client.post(url, {"status": "validated"}).status_code, 405
            )
        for url in (COMPANIES, SCHOOLS):
            self.assertEqual(self.client.post(url, {}).status_code, 405)


class AccessTests(OrganizationTests):
    def test_only_administrators(self):
        company_ = company("Acme", "12345678901234")
        school = School.objects.create(name="Lyon 2")
        urls = [
            (COMPANIES, None),
            (SCHOOLS, None),
            (f"{COMPANIES}/{company_.pk}/status", {"status": "validated"}),
            (f"{SCHOOLS}/{school.pk}/status", {"status": "validated"}),
        ]
        users: list[User | None] = [None]
        for role in (Role.STUDENT, Role.RECRUITER, Role.MANAGER):
            # A superuser of another role is not an administrator of JobUp
            users.append(
                User.objects.create_user(
                    f"u{role}@example.fr",
                    "Password123",
                    first_name="Alice",
                    last_name="Martin",
                    role=role,
                    is_superuser=True,
                )
            )
        for user in users:
            self.client.logout()
            if user:
                self.client.force_login(user)
            for url, payload in urls:
                with self.subTest(user=user and user.role, url=url):
                    if payload:
                        self.assertEqual(
                            self.client.patch(url, payload, format="json").status_code,
                            403,
                        )
                    else:
                        self.assertEqual(self.client.get(url).status_code, 403)
        self.assertEqual(Company.objects.get().status, ReviewStatus.PENDING)
        self.assertEqual(School.objects.get().status, ReviewStatus.PENDING)

    def test_administration_pages(self):
        for path in PAGES + (
            "/administration/account",
            "/administration/reports",
            "/administration/claims",
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                response.close()
        self.client.logout()
        for path in PAGES:
            self.assertRedirects(
                self.client.get(path),
                f"/administration?next={path}",
                fetch_redirect_response=False,
            )
