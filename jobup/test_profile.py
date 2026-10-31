import io
import tempfile
from typing import Any

from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient, APITestCase

from .models import JobCategory, Role, Student, StudyDegree, User

PASSWORD = "pw12345!"


def createStudent(email: str, **profile: str) -> User:
    user = User.objects.create_user(
        email, PASSWORD, name="Martin", first_name="Camille", role=Role.STUDENT
    )
    Student.objects.create(
        user=user,
        category=JobCategory.OTHER,
        study_degree=StudyDegree.MASTER2,
        **profile,
    )
    return user


def imageBytes(kind: str, **options: Any) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8)).save(buffer, kind, **options)
    return buffer.getvalue()


class ProfileTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alice = createStudent(
            "alice@mail.fr",
            photo="photos/alice.png",
            description="Étudiante en M2 informatique.",
            desired_position="Développeuse web",
        )
        cls.bob = createStudent("bob@mail.fr")
        cls.admin = User.objects.create_superuser(
            "admin@jobup.io", PASSWORD, name="Taire", first_name="Jean"
        )


class ProfileReadTests(ProfileTestCase):
    def test_student_reads_own_profile(self):
        self.client.force_login(self.alice)
        response = self.client.get(f"/api/student/{self.alice.pk}")
        self.assertEqual(response.status_code, 200)
        profile = response.json()
        self.assertEqual(profile["photo_url"], "/media/photos/alice.png")
        self.assertEqual(profile["description"], "Étudiante en M2 informatique.")
        self.assertEqual(profile["desired_position"], "Développeuse web")

    def test_empty_profile(self):
        self.client.force_login(self.bob)
        response = self.client.get(f"/api/student/{self.bob.pk}")
        self.assertEqual(response.status_code, 200)
        profile = response.json()
        self.assertIsNone(profile["photo_url"])
        self.assertEqual(profile["description"], "")
        self.assertEqual(profile["desired_position"], "")

    def test_anonymous_forbidden(self):
        response = self.client.get(f"/api/student/{self.alice.pk}")
        self.assertEqual(response.status_code, 403)

    def test_other_profile_forbidden(self):
        self.client.force_login(self.bob)
        # Refused before looking up the student: an unknown id gets the same answer
        for uid in (self.alice.pk, 9999):
            response = self.client.get(f"/api/student/{uid}")
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.json(), {"error": "Forbidden"})

    def test_admin_reads_profile(self):
        self.client.force_login(self.admin)
        response = self.client.get(f"/api/student/{self.alice.pk}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["desired_position"], "Développeuse web")

    def test_no_student_profile(self):
        self.client.force_login(self.admin)
        response = self.client.get(f"/api/student/{self.admin.pk}")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "Student not found"})


class ProfileUpdateTests(ProfileTestCase):
    def setUp(self):
        self.url = f"/api/student/{self.alice.pk}"
        self.client.force_login(self.alice)

    def test_partial_update_keeps_other_field(self):
        data = {"desired_position": "Data analyst"}
        response = self.client.patch(self.url, data, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["desired_position"], "Data analyst")
        # Saved, and the description not sent is unchanged
        profile = self.client.get(self.url).json()
        self.assertEqual(profile["desired_position"], "Data analyst")
        self.assertEqual(profile["description"], "Étudiante en M2 informatique.")

    def test_whitespace_stripped_and_empty_string_clears(self):
        data = {"description": "  Bonjour  ", "desired_position": ""}
        response = self.client.patch(self.url, data, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["description"], "Bonjour")
        self.assertEqual(response.json()["desired_position"], "")

    def test_maximum_lengths(self):
        # Surrounding spaces are removed before counting
        data = {"description": " " + "a" * 500 + " ", "desired_position": "b" * 100}
        response = self.client.patch(self.url, data, format="json")
        self.assertEqual(response.status_code, 200)

    def test_too_long(self):
        data = {"description": "a" * 501, "desired_position": "b" * 101}
        response = self.client.patch(self.url, data, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["errors"],
            {
                "description": "La présentation ne doit pas dépasser 500 caractères.",
                "desired_position": "Le poste recherché ne doit pas dépasser 100 caractères.",
            },
        )

    def test_not_a_text(self):
        data = {"description": 42, "desired_position": None}
        response = self.client.patch(self.url, data, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["errors"],
            {
                "description": "Ce champ doit être un texte.",
                "desired_position": "Ce champ doit être un texte.",
            },
        )

    def test_other_fields_refused(self):
        data = {"role": Role.ADMIN, "email": "pirate@mail.fr", "description": "Bonjour"}
        response = self.client.patch(self.url, data, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["errors"],
            {
                "role": "Ce champ ne peut pas être modifié.",
                "email": "Ce champ ne peut pas être modifié.",
            },
        )
        # Nothing is saved, not even the valid field
        self.assertEqual(User.objects.get(pk=self.alice.pk).role, Role.STUDENT)
        self.assertEqual(
            Student.objects.get(user=self.alice).description,
            "Étudiante en M2 informatique.",
        )

    def test_malformed_body(self):
        response = self.client.patch(self.url, ["description"], format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "Invalid payload"})
        response = self.client.patch(self.url, "{", content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("errors", response.json())

    def test_anonymous_forbidden(self):
        self.client.logout()
        response = self.client.patch(self.url, {"description": "Bonjour"}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_only_the_student_can_update(self):
        # Neither another student nor an administrator
        for user in (self.bob, self.admin):
            self.client.force_login(user)
            response = self.client.patch(self.url, {"description": "Bonjour"}, format="json")
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.json(), {"error": "Forbidden"})

    def test_csrf_token_required(self):
        client = APIClient(enforce_csrf_checks=True)
        credentials = {"email": "alice@mail.fr", "password": PASSWORD}
        client.post("/api/login", credentials, format="json")
        data = {"description": "Bonjour"}
        response = client.patch(self.url, data, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertIn("CSRF", response.json()["detail"])
        token = client.cookies["csrftoken"].value
        response = client.patch(
            self.url, data, format="json", headers={"X-CSRFToken": token}
        )
        self.assertEqual(response.status_code, 200)


class PhotoUploadTests(ProfileTestCase):
    def setUp(self):
        # Uploaded photos go to a temporary folder, deleted after each test
        media = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(self.settings(MEDIA_ROOT=media))
        self.url = f"/api/student/{self.alice.pk}/photo"
        self.client.force_login(self.alice)

    def upload(self, name: str, content: bytes):
        return self.client.post(self.url, {"photo": SimpleUploadedFile(name, content)})

    def currentPhoto(self) -> str:
        return Student.objects.get(user=self.alice).photo.name

    def test_upload_replaces_photo(self):
        response = self.upload("photo.jpg", imageBytes("JPEG"))
        self.assertEqual(response.status_code, 200)
        first = self.currentPhoto()
        self.assertRegex(first, r"^photos/[0-9a-f]{32}\.jpg$")
        self.assertEqual(response.json()["photo_url"], f"/media/{first}")
        self.assertTrue(default_storage.exists(first))

        response = self.upload("photo.jpg", imageBytes("JPEG"))
        self.assertEqual(response.status_code, 200)
        second = self.currentPhoto()
        # New file and new URL, and the old file is deleted
        self.assertNotEqual(second, first)
        self.assertEqual(response.json()["photo_url"], f"/media/{second}")
        self.assertTrue(default_storage.exists(second))
        self.assertFalse(default_storage.exists(first))

    def test_format_read_from_content(self):
        # A PNG named .jpg is saved as a PNG
        response = self.upload("photo.jpg", imageBytes("PNG"))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.currentPhoto().endswith(".png"))
        # A text file named .png is refused
        response = self.upload("photo.png", b"not an image")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"errors": {"photo": "La photo doit être au format JPG ou PNG."}},
        )

    def test_other_image_format_refused(self):
        response = self.upload("photo.gif", imageBytes("GIF"))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["errors"],
            {"photo": "La photo doit être au format JPG ou PNG."},
        )
        # The current photo is kept
        self.assertEqual(self.currentPhoto(), "photos/alice.png")

    def test_phone_multi_picture_jpeg(self):
        # MPO: a JPEG holding several images, as some phones save their photos
        second = Image.new("RGB", (8, 8))
        mpo = imageBytes("MPO", save_all=True, append_images=[second])
        response = self.upload("photo.jpg", mpo)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.currentPhoto().endswith(".jpg"))

    def test_size_limit(self):
        jpeg = imageBytes("JPEG")
        # Bytes after the end of the image keep it valid: only the size changes
        largest = jpeg + b"\0" * (2 * 1024 * 1024 - len(jpeg))
        self.assertEqual(self.upload("photo.jpg", largest).status_code, 200)
        response = self.upload("photo.jpg", largest + b"\0")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["errors"], {"photo": "La photo ne doit pas dépasser 2 Mo."}
        )

    def test_no_file(self):
        response = self.client.post(self.url, {})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["errors"], {"photo": "Aucune photo reçue."})

    def test_anonymous_forbidden(self):
        self.client.logout()
        response = self.upload("photo.png", imageBytes("PNG"))
        self.assertEqual(response.status_code, 403)

    def test_only_the_student_can_upload(self):
        # Neither another student nor an administrator
        for user in (self.bob, self.admin):
            self.client.force_login(user)
            response = self.upload("photo.png", imageBytes("PNG"))
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.json(), {"error": "Forbidden"})

    def test_no_student_profile(self):
        self.client.force_login(self.admin)
        photo = SimpleUploadedFile("photo.png", imageBytes("PNG"))
        response = self.client.post(f"/api/student/{self.admin.pk}/photo", {"photo": photo})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "Student not found"})
