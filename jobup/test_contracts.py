# Dépôt, remplacement et téléchargement du contrat d'alternance (JOB-045, REC-26)
import datetime
import tempfile
from pathlib import Path
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from .attachments import ATTACHMENT_MAX_SIZE
from .models import (
    ApplicationStatus,
    Contract,
    ContractStage,
    Notification,
    Recruiter,
    Student,
)
from .test_login import USERS
from .test_resume import DOCX, PDF
from .test_school import RECRUITER_APPLICATION, SchoolTestCase

TODAY = datetime.date(2026, 11, 19)


def pdf(content=PDF, name="Contrat Alice.pdf"):
    return SimpleUploadedFile(name, content)


class ContractTestCase(SchoolTestCase):
    def setUp(self):
        super().setUp()
        private = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(self.settings(PRIVATE_MEDIA_ROOT=private))
        self.private_root = Path(private)
        # Date du jour fixée : le remplacement dépend de la date de début
        self.enterContext(
            mock.patch("jobup.contracts.timezone.localdate", lambda: TODAY)
        )
        self.application = self.apply(self.alice, ApplicationStatus.ACCEPTED)

    def deposit(self, application=None, **fields):
        application = application or self.application
        data = {"file": pdf(), "start_date": "2027-01-04", "end_date": "2028-01-03"}
        data.update(fields)
        data = {key: value for key, value in data.items() if value is not None}
        return self.client.post(
            f"{RECRUITER_APPLICATION}/{application.pk}/contract",
            data,
            format="multipart",
        )

    def files(self):
        return sorted(
            path.relative_to(self.private_root).as_posix()
            for path in self.private_root.rglob("*")
            if path.is_file()
        )

    def download(self, contract: Contract):
        return self.client.get(f"/api/contracts/{contract.pk}/file")


class DepositTests(ContractTestCase):
    def test_deposit_stores_the_pdf_and_the_dates(self):
        self.login(self.recruiter.user)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.deposit()
        self.assertEqual(response.status_code, 201, response.data)
        contract = Contract.objects.get()
        self.assertEqual(
            (contract.start_date, contract.end_date),
            (datetime.date(2027, 1, 4), datetime.date(2028, 1, 3)),
        )
        (stored,) = self.files()
        self.assertRegex(stored, r"^contracts/[0-9a-f]{32}/Contrat_Alice\.pdf$")
        shown = response.json()["contract"]
        self.assertEqual(shown["file_name"], "Contrat_Alice.pdf")
        self.assertEqual(shown["file_url"], f"/api/contracts/{contract.pk}/file")
        self.assertEqual(shown["start_date"], "2027-01-04")
        self.assertEqual(shown["stage"], ContractStage.DEPOSITED)
        # L'école et l'étudiant en sont informés
        self.assertEqual(len(self.notificationsOf(self.manager.user)), 1)
        self.assertEqual(len(self.notificationsOf(self.alice.user)), 1)

    def test_invalid_files_and_dates_store_nothing(self):
        self.login(self.recruiter.user)
        cases = [
            ({"file": None}, "file", "Ce champ est obligatoire."),
            ({"file": pdf(b"")}, "file", "Le fichier est vide."),
            (
                {"file": pdf(b"%PDF-" + b"0" * ATTACHMENT_MAX_SIZE)},
                "file",
                "Le fichier ne doit pas dépasser 10 Mo.",
            ),
            # Reconnu au contenu : un document Word nommé .pdf est refusé
            ({"file": pdf(DOCX)}, "file", "Le contrat doit être un fichier PDF."),
            ({"start_date": None}, "start_date", "Ce champ est obligatoire."),
            ({"end_date": ""}, "end_date", "Ce champ est obligatoire."),
            ({"start_date": "2027-02-30"}, "start_date", "Saisissez une date valide."),
            ({"end_date": "demain"}, "end_date", "Saisissez une date valide."),
            (
                {"end_date": "2027-01-04"},
                "end_date",
                "La date de fin doit être après la date de début.",
            ),
        ]
        for fields, field, message in cases:
            with self.subTest(field=field, message=message):
                response = self.deposit(**fields)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()["errors"], {field: [message]})
        self.assertFalse(Contract.objects.exists())
        self.assertEqual(self.files(), [])

    def test_only_the_owner_of_an_accepted_application_deposits(self):
        pending = self.apply(self.carol, ApplicationStatus.IN_REVIEW)
        colleague = Recruiter.objects.create(
            user=self.user(USERS[3], email="rh@thales.org"),
            company=self.recruiter.company,
        )
        self.login(self.recruiter.user)
        self.assertEqual(self.deposit(pending).status_code, 409)
        self.login(colleague.user)
        self.assertEqual(self.deposit().status_code, 404)
        for user in (self.alice.user, self.manager.user):
            self.login(user)
            self.assertEqual(self.deposit().status_code, 403)
        self.assertFalse(Contract.objects.exists())
        self.assertEqual(self.files(), [])


class ReplacementTests(ContractTestCase):
    def setUp(self):
        super().setUp()
        self.login(self.recruiter.user)
        self.deposit()
        self.deposited = Contract.objects.get()
        (self.first_file,) = self.files()

    def test_replacement_before_the_start_resets_the_validation(self):
        Contract.objects.filter(pk=self.deposited.pk).update(
            stage=ContractStage.VALIDATED, validated_at=timezone.now()
        )
        with self.captureOnCommitCallbacks(execute=True):
            response = self.deposit(
                file=pdf(name="Contrat v2.pdf"), start_date="2027-02-01"
            )
        self.assertEqual(response.status_code, 200, response.data)
        contract = Contract.objects.get()
        self.assertEqual(contract.version, 2)
        self.assertEqual(contract.stage, ContractStage.DEPOSITED)
        self.assertIsNone(contract.validated_at)
        self.assertEqual(contract.start_date, datetime.date(2027, 2, 1))
        # Seule la nouvelle version est gardée
        (stored,) = self.files()
        self.assertNotEqual(stored, self.first_file)
        self.assertTrue(stored.endswith("/Contrat_v2.pdf"))
        # L'école doit valider de nouveau : une notification pour cette version
        (for_school,) = self.notificationsOf(self.manager.user)
        self.assertEqual(for_school.title, "Contrat remplacé à valider")
        (for_student,) = self.notificationsOf(self.alice.user)
        self.assertEqual(for_student.title, "Contrat remplacé")

    def test_no_replacement_once_started_or_signed(self):
        for change in (
            {"start_date": TODAY},
            {"start_date": TODAY - datetime.timedelta(days=30)},
            {"stage": ContractStage.SIGNED},
        ):
            with self.subTest(change=change):
                Contract.objects.filter(pk=self.deposited.pk).update(
                    start_date=datetime.date(2027, 1, 4),
                    stage=ContractStage.DEPOSITED,
                )
                Contract.objects.filter(pk=self.deposited.pk).update(**change)
                response = self.deposit(file=pdf(name="Autre.pdf"))
                self.assertEqual(response.status_code, 409)
                self.assertIn("file", response.json()["errors"])
                # Le contrat et son fichier restent ceux d'avant
                self.assertEqual(Contract.objects.get().version, 1)
                self.assertEqual(self.files(), [self.first_file])

    def test_a_failed_save_keeps_the_previous_contract(self):
        with mock.patch.object(Contract, "save", side_effect=RuntimeError("panne")):
            with self.assertRaises(RuntimeError):
                self.deposit(file=pdf(name="Autre.pdf"))
        self.assertEqual(Contract.objects.get().version, 1)
        self.assertEqual(self.files(), [self.first_file])

    def test_storage_failure_keeps_the_previous_contract(self):
        storage = type(self.deposited.file.storage)
        with mock.patch.object(storage, "save", side_effect=OSError("disque plein")):
            response = self.deposit(file=pdf(name="Autre.pdf"))
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.files(), [self.first_file])
        self.assertEqual(Notification.objects.filter(event__contains=":v2").count(), 0)


class DownloadTests(ContractTestCase):
    def setUp(self):
        super().setUp()
        self.login(self.recruiter.user)
        self.deposit()
        self.deposited = Contract.objects.get()

    def test_recruiter_student_and_school_download_the_pdf(self):
        for user in (self.recruiter.user, self.alice.user, self.manager.user):
            with self.subTest(user=user.email):
                self.login(user)
                response = self.download(self.deposited)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response["Content-Type"], "application/pdf")
                self.assertIn("attachment;", response["Content-Disposition"])
                self.assertEqual(response["Cache-Control"], "private, no-store")
                self.assertEqual(b"".join(response.streaming_content), PDF)

    def test_everyone_else_gets_a_404(self):
        colleague = Recruiter.objects.create(
            user=self.user(USERS[3], email="rh@thales.org"),
            company=self.recruiter.company,
        )
        for user in (
            colleague.user,
            self.carol.user,
            self.bob.user,
            self.other_manager.user,
        ):
            with self.subTest(user=user.email):
                self.login(user)
                self.assertEqual(self.download(self.deposited).status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.download(self.deposited).status_code, 403)

    def test_school_loses_access_when_the_student_leaves(self):
        Student.objects.filter(pk=self.alice.pk).update(school=None)
        self.login(self.manager.user)
        self.assertEqual(self.download(self.deposited).status_code, 404)
        # L'étudiant et le recruteur le gardent
        self.login(self.alice.user)
        self.assertEqual(self.download(self.deposited).status_code, 200)

    def test_contract_without_file_or_missing_file(self):
        older = self.contract(self.alice)
        self.login(self.alice.user)
        self.assertEqual(self.download(older).status_code, 404)
        self.assertIsNone(older.to_dict()["file_url"])
        for path in self.private_root.rglob("*.pdf"):
            path.unlink()
        self.assertEqual(self.download(self.deposited).status_code, 404)


class StudentContractsTests(ContractTestCase):
    def test_the_student_sees_only_their_contracts(self):
        self.login(self.recruiter.user)
        self.deposit()
        self.contract(self.carol)
        self.login(self.alice.user)
        (shown,) = self.client.get("/api/student/contracts").json()
        self.assertEqual(shown["offer_title"], "Développeur Java")
        self.assertEqual(shown["company"], "Thales")
        self.assertEqual(shown["school"], self.school.name)
        self.assertEqual(shown["application_id"], self.application.pk)
        self.assertEqual(shown["start_date"], "2027-01-04")
        self.assertTrue(shown["file_url"].endswith("/file"))
        for user in (self.recruiter.user, self.manager.user):
            self.login(user)
            self.assertEqual(self.client.get("/api/student/contracts").status_code, 403)
