import csv
import io

from django.utils import timezone

from .models import (
    ApplicationStatus,
    ContractStage,
    JobApplication,
    JobCategory,
    Offer,
    Role,
    Student,
    User,
)
from .test_login import USERS
from .test_school import SchoolTestCase

STUDENT_EXPORT = "/api/applications/export"
SCHOOL_EXPORT = "/api/school/students/export"
RECRUITER_EXPORT = "/api/recruiter/offers/export"
ADMIN_EXPORT = "/api/administration/users/export"


def table(response) -> list[list[str]]:
    # Header included; the BOM is dropped by the decoding, as Excel does
    return list(
        csv.reader(io.StringIO(response.content.decode("utf-8-sig")), delimiter=";")
    )


class ExportTestCase(SchoolTestCase):
    def setUp(self):
        super().setUp()
        self.admin = self.user(USERS[2])

    def column(self, url: str, query: str, index: int) -> list[str]:
        return [row[index] for row in table(self.client.get(f"{url}{query}"))[1:]]

    def assertCsv(self, response, name: str):
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertTrue(response.content.startswith("﻿".encode()))
        disposition = response["Content-Disposition"]
        self.assertTrue(disposition.startswith(f'attachment; filename="{name}-'))
        self.assertTrue(disposition.endswith('.csv"'))


class StudentExportTests(ExportTestCase):
    def test_only_a_student_exports_their_applications(self):
        for user in (self.manager.user, self.recruiter.user, self.admin):
            self.login(user)
            self.assertEqual(self.client.get(STUDENT_EXPORT).status_code, 403)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(STUDENT_EXPORT).status_code, (401, 403))

    def test_lists_their_applications_with_status_and_contract(self):
        self.contract(self.alice, ContractStage.VALIDATED)
        self.apply(self.alice, ApplicationStatus.IN_REVIEW)
        self.apply(self.bob)  # of another student
        self.login(self.alice.user)
        response = self.client.get(STUDENT_EXPORT)
        self.assertCsv(response, "candidatures")
        rows = table(response)
        self.assertEqual(
            rows[0],
            [
                "Offre",
                "Entreprise",
                "Statut",
                "Envoyée le",
                "Mise à jour le",
                "Contrat",
            ],
        )
        self.assertEqual(len(rows), 3)
        self.assertCountEqual(
            [(row[1], row[2], row[5]) for row in rows[1:]],
            [
                ("Thales", "Acceptée", "Validé par l’école"),
                ("Thales", "En cours d’étude", ""),
            ],
        )

    def test_filters_by_status_group(self):
        self.apply(self.alice, ApplicationStatus.DRAFT)
        self.apply(self.alice, ApplicationStatus.READ)
        self.apply(self.alice, ApplicationStatus.IN_REVIEW)
        self.apply(self.alice, ApplicationStatus.REFUSED)
        self.login(self.alice.user)

        def statuses(query):
            return sorted(self.column(STUDENT_EXPORT, query, 2))

        self.assertEqual(len(statuses("")), 4)
        self.assertEqual(statuses("?status=review"), ["En cours d’étude"] * 2)
        self.assertEqual(statuses("?status=draft,refused"), ["Brouillon", "Refusée"])
        self.assertEqual(len(statuses("?status=")), 4)

    def test_invalid_filters_are_refused(self):
        self.login(self.alice.user)
        for query in ("?status=done", "?status=review,done", "?other=1"):
            self.assertEqual(
                self.client.get(f"{STUDENT_EXPORT}{query}").status_code, 400, query
            )

    def test_text_is_never_read_as_a_formula(self):
        offer = self.newOffer()
        offer.title = '=HYPERLINK("http://x")'
        offer.save()
        JobApplication.objects.create(
            student=self.alice,
            offer=offer,
            status=ApplicationStatus.SUBMITTED,
            submitted_at=timezone.now(),
        )
        self.login(self.alice.user)
        self.assertEqual(
            table(self.client.get(STUDENT_EXPORT))[1][0], '\'=HYPERLINK("http://x")'
        )


class SchoolExportTests(ExportTestCase):
    def test_only_a_school_with_an_account_exports(self):
        for user in (self.alice.user, self.recruiter.user, self.admin):
            self.login(user)
            self.assertEqual(self.client.get(SCHOOL_EXPORT).status_code, 403)

    def test_lists_the_students_of_the_school_with_their_progress(self):
        self.contract(self.alice, ContractStage.SIGNED)
        self.alice.study_degree = 4
        self.alice.save()
        self.login(self.manager.user)
        response = self.client.get(SCHOOL_EXPORT)
        self.assertCsv(response, "etudiants")
        rows = table(response)
        self.assertEqual(rows[0][:3], ["Prénom", "Nom", "E-mail"])
        # Neither the students of another school nor those without one
        self.assertEqual(len(rows), 2)
        # Dernière candidature (JOB-047) : sa date d'envoi, à l'heure de Paris
        sent = JobApplication.objects.get(student=self.alice).submitted_at
        self.assertEqual(
            rows[1],
            [
                "Alice",
                "Plancher",
                "alicep@mail.fr",
                "Bac + 4",
                "Contrat signé",
                "1",
                timezone.localtime(sent).strftime("%d/%m/%Y %H:%M"),
                "Thales",
                "Signé",
            ],
        )

    def test_a_suspended_student_is_not_exported(self):
        self.alice.user.is_active = False
        self.alice.user.save()
        self.login(self.manager.user)
        self.assertEqual(len(table(self.client.get(SCHOOL_EXPORT))), 1)

    def test_filters_by_progress_and_name(self):
        dan = Student.objects.create(
            user=self.user(
                USERS[1], email="dan@mail.fr", first_name="Dan", last_name="Durand"
            ),
            school=self.school,
        )
        self.apply(dan)
        self.login(self.manager.user)

        def names(query):
            return self.column(SCHOOL_EXPORT, query, 0)

        self.assertCountEqual(names(""), ["Alice", "Dan"])
        self.assertEqual(names("?status=applying"), ["Dan"])
        self.assertEqual(names("?status=searching,applying"), ["Dan", "Alice"])
        self.assertEqual(names("?q=durand"), ["Dan"])
        self.assertEqual(names("?q=alice&status=applying"), [])

    def test_invalid_progress_is_refused(self):
        self.login(self.manager.user)
        self.assertEqual(
            self.client.get(f"{SCHOOL_EXPORT}?status=lost").status_code, 400
        )


class RecruiterExportTests(ExportTestCase):
    def setUp(self):
        super().setUp()
        self.alice.experience_level = 18
        self.alice.skills = "Java, SQL"
        self.alice.study_degree = 5
        self.alice.save()
        self.apply(self.alice, ApplicationStatus.ACCEPTED)
        self.apply(self.bob, ApplicationStatus.SUBMITTED)
        self.apply(self.carol, ApplicationStatus.DRAFT)
        self.second = Offer.objects.create(
            recruiter=self.recruiter,
            title="Data analyst",
            description="Description",
            category=JobCategory.DATA_AI,
            is_active=False,
        )

    def get(self, query=""):
        self.login(self.recruiter.user)
        return self.client.get(f"{RECRUITER_EXPORT}{query}")

    def test_only_a_recruiter_exports(self):
        for user in (self.alice.user, self.manager.user, self.admin):
            self.login(user)
            self.assertEqual(self.client.get(RECRUITER_EXPORT).status_code, 403)

    def test_offers_with_their_applications_counts(self):
        response = self.get()
        self.assertCsv(response, "offres")
        rows = {row[0]: row for row in table(response)[1:]}
        self.assertEqual(
            table(response)[0][5:],
            ["Candidatures", "Postulées", "En cours d’étude", "Acceptées", "Refusées"],
        )
        # The draft of Carol is not an application received
        self.assertEqual(rows["Développeur Java"][1], "Publiée")
        self.assertEqual(rows["Développeur Java"][5:], ["2", "1", "0", "1", "0"])
        self.assertEqual(rows["Data analyst"][1], "Clôturée")
        self.assertEqual(rows["Data analyst"][5:], ["0"] * 5)

    def test_filters_the_offers(self):
        def titles(query):
            return [row[0] for row in table(self.get(query))[1:]]

        self.assertEqual(titles("?offer_status=closed"), ["Data analyst"])
        self.assertEqual(titles("?offer_status=active"), ["Développeur Java"])
        self.assertEqual(titles(f"?offer={self.second.pk}"), ["Data analyst"])
        # The offer of another recruiter is not exported
        other = Offer.objects.create(
            recruiter=self.other_recruiter(),
            title="Autre",
            description="Description",
            category=JobCategory.DATA_AI,
        )
        self.assertEqual(titles(f"?offer={other.pk}"), [])
        self.assertNotIn("Autre", titles(""))

    def test_the_status_filter_narrows_the_total(self):
        rows = table(self.get("?status=accepted"))[1:]
        self.assertEqual(
            [row[5] for row in rows if row[0] == "Développeur Java"], ["1"]
        )

    def test_candidates_with_their_experience(self):
        response = self.get("?content=candidates")
        self.assertCsv(response, "candidats")
        rows = table(response)
        self.assertEqual(rows[0][:3], ["Offre", "Prénom", "Nom"])
        self.assertEqual(len(rows), 3)
        alice = next(row for row in rows if row[1] == "Alice")
        self.assertEqual(
            alice[3:9],
            [
                "Université Paris Nanterre",
                "Bac + 5",
                "18",
                "Java, SQL",
                "Île-de-France",
                "Acceptée",
            ],
        )
        # No e-mail: the recruiter does not see it elsewhere either
        self.assertNotIn("E-mail", rows[0])
        self.assertNotIn("Carol", [row[1] for row in rows])

    def test_candidates_filtered_by_status_and_offer(self):
        def names(query):
            return [row[1] for row in table(self.get(query))[1:]]

        self.assertEqual(names("?content=candidates&status=submitted"), ["Bob"])
        self.assertEqual(names("?content=candidates&status=refused"), [])
        self.assertEqual(names(f"?content=candidates&offer={self.second.pk}"), [])

    def test_invalid_filters_are_refused(self):
        for query in (
            "?content=all",
            "?status=draft",
            "?offer=a",
            "?offer_status=none",
        ):
            self.assertEqual(self.get(query).status_code, 400, query)

    def other_recruiter(self):
        from .models import Company, Recruiter

        company = Company.objects.create(name="Autre", siret="98765432109876")
        return Recruiter.objects.create(
            user=self.user(USERS[1], email="autre@thales.org", role=Role.RECRUITER),
            company=company,
        )


class AdminExportTests(ExportTestCase):
    def get(self, query=""):
        self.login(self.admin)
        return self.client.get(f"{ADMIN_EXPORT}{query}")

    def test_only_an_administrator_exports(self):
        for user in (self.alice.user, self.manager.user, self.recruiter.user):
            self.login(user)
            self.assertEqual(self.client.get(ADMIN_EXPORT).status_code, 403)

    def test_every_account_of_every_role_by_default(self):
        response = self.get()
        self.assertCsv(response, "utilisateurs")
        rows = table(response)
        self.assertEqual(rows[0][:5], ["Id", "Prénom", "Nom", "E-mail", "Rôle"])
        self.assertEqual(len(rows) - 1, User.objects.count())
        by_email = {row[3]: row for row in rows[1:]}
        self.assertEqual(
            by_email["alicep@mail.fr"][4:7],
            ["Étudiant", "Université Paris Nanterre", ""],
        )
        self.assertEqual(
            by_email["ines@ecole.fr"][4:7], ["École", "Université Paris Nanterre", ""]
        )
        self.assertEqual(
            by_email[self.recruiter.user.email][4:7], ["Recruteur", "", "Thales"]
        )
        self.assertEqual(by_email[self.admin.email][4], "Administrateur")

    def test_filters_by_role_status_school_and_search(self):
        self.bob.user.is_active = False
        self.bob.user.suspended_at = timezone.now()
        self.bob.user.save()

        def emails(query):
            return [row[3] for row in table(self.get(query))[1:]]

        self.assertEqual(len(emails("?role=student")), 3)
        self.assertEqual(emails("?role=recruiter"), [self.recruiter.user.email])
        # The school filter is about the school of the students, as in the table
        self.assertEqual(emails(f"?role=school&school={self.school.pk}"), [])
        self.assertEqual(emails("?status=suspended"), [self.bob.user.email])
        self.assertNotIn(self.bob.user.email, emails("?status=active"))
        self.assertEqual(emails(f"?school={self.school.pk}"), ["alicep@mail.fr"])
        self.assertEqual(emails("?q=carol"), ["carol@mail.fr"])
        suspended = table(self.get("?status=suspended"))[1]
        self.assertEqual(suspended[8], "Suspendu")
        self.assertNotEqual(suspended[9], "")

    def test_exports_only_the_selected_accounts(self):
        ids = f"{self.alice.user.pk},{self.bob.user.pk}"
        emails = [row[3] for row in table(self.get(f"?ids={ids}"))[1:]]
        self.assertCountEqual(emails, ["alicep@mail.fr", "boby@mails.com"])
        # A selection still obeys the other filters
        self.assertEqual(
            [row[3] for row in table(self.get(f"?ids={ids}&role=recruiter"))[1:]], []
        )

    def test_invalid_filters_are_refused(self):
        too_many = ",".join(str(number) for number in range(1, 502))
        for query in (
            "?role=boss",
            "?status=gone",
            "?ids=a",
            "?school=0",
            f"?ids={too_many}",
        ):
            self.assertEqual(self.get(query).status_code, 400, query)


class OfferExportTests(ExportTestCase):
    def get(self, user: User, offer: Offer | None = None):
        self.login(user)
        return self.client.get(f"/api/offers/{(offer or self.offer).pk}/export")

    def test_a_student_exports_the_public_data_of_an_offer(self):
        self.offer.requirements = "Bac+3 en informatique"
        self.offer.save()
        response = self.get(self.alice.user)
        self.assertCsv(response, "offre")
        rows = table(response)
        self.assertEqual(
            rows[0],
            [
                "Offre",
                "Entreprise",
                "Ville",
                "Secteur",
                "Description",
                "Profil recherché",
                "Publiée le",
            ],
        )
        self.assertEqual(len(rows), 2)
        self.assertEqual(
            rows[1][:6],
            [
                "Développeur Java",
                "Thales",
                "",
                "Informatique",
                "Description",
                "Bac+3 en informatique",
            ],
        )

    def test_nothing_private_to_the_recruiter_is_exported(self):
        self.apply(self.alice)
        header = table(self.get(self.alice.user))[0]
        for private in ("Candidatures", "Prénom", "Nom", "Statut"):
            self.assertNotIn(private, header)

    def test_only_a_student_exports_a_published_offer(self):
        for user in (self.manager.user, self.recruiter.user, self.admin):
            self.assertEqual(self.get(user).status_code, 403)
        self.client.force_authenticate(None)
        self.assertIn(
            self.client.get(f"/api/offers/{self.offer.pk}/export").status_code,
            (401, 403),
        )
        self.offer.is_active = False
        self.offer.save()
        self.assertEqual(self.get(self.alice.user).status_code, 404)
        self.assertEqual(self.client.get("/api/offers/9999/export").status_code, 404)
