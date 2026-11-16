import io
import tempfile
import zipfile
from datetime import UTC, datetime
from unittest import mock

from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage, default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import DatabaseError
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Student, User
from .test_profile import PASSWORD, createStudent

FORMAT_ERROR = {"errors": {"resume": "Le CV doit être au format PDF, DOCX ou DOC."}}
PREVIOUS_DATE = datetime(2026, 3, 12, 10, 0, tzinfo=UTC)

# Only the start of the content is checked
PDF = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n"
DOC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\0" * 504


def zipBytes(*names: str) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name in names:
            archive.writestr(name, "<xml/>")
    return buffer.getvalue()


DOCX = zipBytes("[Content_Types].xml", "word/document.xml")
# An Excel file is also a ZIP archive, without word/document.xml
XLSX = zipBytes("[Content_Types].xml", "xl/workbook.xml")


class ResumeTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alice = createStudent("alice@mail.fr")
        cls.bob = createStudent("bob@mail.fr")
        cls.admin = User.objects.create_superuser(
            "admin@jobup.io", PASSWORD, last_name="Taire", first_name="Jean"
        )

    def setUp(self):
        # Uploaded CVs go to a temporary folder, deleted after each test
        media = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(self.settings(MEDIA_ROOT=media))
        # Alice already has a CV, Bob has none
        self.previous = default_storage.save(
            f"CVs/{'a' * 32}/CV_Alice.pdf", ContentFile(PDF)
        )
        Student.objects.filter(user=self.alice).update(
            resume=self.previous, resume_updated_at=PREVIOUS_DATE
        )
        self.url = f"/api/student/{self.alice.pk}/resume"
        self.client.force_login(self.alice)

    def upload(self, name: str, content: bytes):
        return self.client.post(self.url, {"resume": SimpleUploadedFile(name, content)})

    def currentResume(self) -> str:
        return Student.objects.get(user=self.alice).resume.name or ""

    def assertPreviousKept(self):
        student = Student.objects.get(user=self.alice)
        self.assertEqual(student.resume.name, self.previous)
        self.assertEqual(student.resume_updated_at, PREVIOUS_DATE)
        self.assertTrue(default_storage.exists(self.previous))


class ResumeReadTests(ResumeTestCase):
    def test_student_reads_own_resume(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"file_name": "CV_Alice.pdf", "updated_at": "2026-03-12T10:00:00Z"},
        )

    def test_no_resume(self):
        self.client.force_login(self.bob)
        response = self.client.get(f"/api/student/{self.bob.pk}/resume")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"file_name": None, "updated_at": None})

    def test_admin_reads_resume(self):
        self.client.force_login(self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["file_name"], "CV_Alice.pdf")

    def test_anonymous_forbidden(self):
        self.client.logout()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 403)

    def test_other_resume_forbidden(self):
        self.client.force_login(self.bob)
        # Refused before looking up the student: an unknown id gets the same answer
        for uid in (self.alice.pk, 9999):
            response = self.client.get(f"/api/student/{uid}/resume")
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.json(), {"error": "Forbidden"})

    def test_no_student_profile(self):
        self.client.force_login(self.admin)
        response = self.client.get(f"/api/student/{self.admin.pk}/resume")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "Student not found"})


class ResumeUploadTests(ResumeTestCase):
    def test_first_upload(self):
        self.client.force_login(self.bob)
        url = f"/api/student/{self.bob.pk}/resume"
        before = timezone.now()
        resume = SimpleUploadedFile("CV_Bob.pdf", PDF)
        response = self.client.post(url, {"resume": resume})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["file_name"], "CV_Bob.pdf")

        student = Student.objects.get(user=self.bob)
        name = student.resume.name or ""
        self.assertRegex(name, r"^CVs/[0-9a-f]{32}/CV_Bob\.pdf$")
        with default_storage.open(name) as file:
            self.assertEqual(file.read(), PDF)
        # Date of the import, sent as saved
        self.assertGreaterEqual(student.resume_updated_at, before)
        updated_at = datetime.fromisoformat(body["updated_at"])
        self.assertEqual(updated_at, student.resume_updated_at)
        # The front end can replace its copy of the CV with the response
        self.assertEqual(self.client.get(url).json(), body)

    def test_upload_replaces_resume(self):
        # Same name as the current CV: kept as is, in a new folder
        response = self.upload("CV_Alice.pdf", PDF)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["file_name"], "CV_Alice.pdf")
        first = self.currentResume()
        self.assertNotEqual(first, self.previous)
        self.assertGreater(
            Student.objects.get(user=self.alice).resume_updated_at, PREVIOUS_DATE
        )
        # The previous CV is deleted with its folder
        self.assertEqual(default_storage.listdir("CVs"), ([first.split("/")[1]], []))

        response = self.upload("CV_2026.docx", DOCX)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["file_name"], "CV_2026.docx")
        second = self.currentResume()
        self.assertTrue(default_storage.exists(second))
        self.assertEqual(default_storage.listdir("CVs"), ([second.split("/")[1]], []))

    def test_accepted_formats(self):
        for name, content in (("CV.pdf", PDF), ("CV.docx", DOCX), ("CV.doc", DOC)):
            with self.subTest(name):
                response = self.upload(name, content)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["file_name"], name)

    def test_format_read_from_content(self):
        # The extension of the format is added when the name does not end with it
        for name, content, saved in (
            ("CV.doc", PDF, "CV.doc.pdf"),
            ("CV", DOCX, "CV.docx"),
            ("CV.PDF", PDF, "CV.PDF"),
        ):
            with self.subTest(name):
                response = self.upload(name, content)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["file_name"], saved)

    def test_other_formats_refused(self):
        for name, content in (
            ("CV.pdf", b"Camille Martin, M2 informatique"),
            ("CV.pdf", b""),
            ("CV.docx", XLSX),
            ("CV.docx", b"PK\x03\x04 damaged archive"),
        ):
            with self.subTest(name=name, content=content[:16]):
                response = self.upload(name, content)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json(), FORMAT_ERROR)
        self.assertPreviousKept()

    def test_size_limit(self):
        # Bytes after the start keep the file a PDF: only the size changes
        largest = PDF + b"\0" * (5 * 1024 * 1024 - len(PDF))
        response = self.upload("CV.pdf", largest + b"\0")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(), {"errors": {"resume": "Le CV ne doit pas dépasser 5 Mo."}}
        )
        self.assertPreviousKept()
        self.assertEqual(self.upload("CV.pdf", largest).status_code, 200)

    def test_name_cleaned_up(self):
        response = self.upload("Mon CV (2026).pdf", PDF)
        self.assertEqual(response.json()["file_name"], "Mon_CV_2026.pdf")
        # Shortened to 60 characters, extension included
        response = self.upload("a" * 100 + ".pdf", PDF)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["file_name"], "a" * 56 + ".pdf")

    def test_no_file(self):
        # Neither a file in another field
        photo = SimpleUploadedFile("CV.pdf", PDF)
        for data in ({}, {"photo": photo}):
            response = self.client.post(self.url, data)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"errors": {"resume": "Aucun CV reçu."}})
        self.assertPreviousKept()

    def test_anonymous_forbidden(self):
        self.client.logout()
        response = self.upload("CV.pdf", PDF)
        self.assertEqual(response.status_code, 403)
        self.assertPreviousKept()

    def test_only_the_student_can_upload(self):
        # Neither another student nor an administrator
        for user in (self.bob, self.admin):
            self.client.force_login(user)
            response = self.upload("CV.pdf", PDF)
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.json(), {"error": "Forbidden"})
        self.assertPreviousKept()

    def test_no_student_profile(self):
        self.client.force_login(self.admin)
        resume = SimpleUploadedFile("CV.pdf", PDF)
        response = self.client.post(
            f"/api/student/{self.admin.pk}/resume", {"resume": resume}
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "Student not found"})

    def test_storage_failure_keeps_previous(self):
        # The file cannot be written, the disk is full for instance
        error = OSError("No space left on device")
        with (
            mock.patch.object(FileSystemStorage, "_save", side_effect=error),
            self.assertRaises(OSError),
        ):
            self.upload("CV.pdf", PDF)
        self.assertPreviousKept()

    def test_database_failure_deletes_new_file(self):
        # The file is written, but the profile cannot be saved
        error = DatabaseError("database is locked")
        with (
            mock.patch.object(Student, "save", side_effect=error),
            self.assertRaises(DatabaseError),
        ):
            self.upload("CV.pdf", PDF)
        self.assertPreviousKept()
        # The new file is deleted with its folder
        self.assertEqual(default_storage.listdir("CVs"), (["a" * 32], []))
