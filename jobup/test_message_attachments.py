import os
import tempfile
from pathlib import Path
from unittest import mock

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import DatabaseError
from rest_framework.test import APITestCase

from .attachments import (
    EMPTY_ERROR,
    FORMAT_ERROR,
    SIZE_ERROR,
    STORAGE_ERROR,
    attachmentName,
)
from .models import (
    Company,
    Conversation,
    Message,
    MessageAttachment,
    PrivateStorage,
    Recruiter,
    Role,
    School,
    SchoolManager,
    Student,
    User,
)
from .test_resume import DOC, DOCX, PDF, XLSX

PASSWORD = "Example123"
PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 32


def upload(content=PDF, name="Convocation entretien.pdf"):
    return SimpleUploadedFile(name, content)


class MessageAttachmentsTests(APITestCase):
    def setUp(self):
        # Les pièces jointes vont dans des dossiers temporaires, supprimés après chaque test
        private = self.enterContext(tempfile.TemporaryDirectory())
        media = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(self.settings(PRIVATE_MEDIA_ROOT=private, MEDIA_ROOT=media))
        self.private_root = Path(private)

        self.student = self.makeStudent("eleve@example.fr", "Élodie", "Durand")
        acme = Company.objects.create(name="Acme", siret="12345678901234")
        other_company = Company.objects.create(name="Autre", siret="98765432109876")
        school = School.objects.create(name="Université Paris")
        self.lea = Recruiter.objects.create(
            user=self.makeUser("lea@acme.fr", "Léa", "Martin", Role.RECRUITER),
            company=acme,
        )
        self.paul = Recruiter.objects.create(
            user=self.makeUser("paul@autre.fr", "Paul", "Petit", Role.RECRUITER),
            company=other_company,
        )
        self.manager = SchoolManager.objects.create(
            user=self.makeUser("rel@univ.fr", "Inès", "Roux", Role.MANAGER),
            school=school,
        )
        self.conversation = Conversation.objects.create(
            student=self.student, recruiter=self.lea
        )
        self.with_school = Conversation.objects.create(
            student=self.student, school_manager=self.manager
        )
        self.url = self.urlOf(self.conversation)

    def makeUser(self, email, first_name, last_name, role):
        return User.objects.create_user(
            email, PASSWORD, first_name=first_name, last_name=last_name, role=role
        )

    def makeStudent(self, email, first_name, last_name):
        return Student.objects.create(
            user=self.makeUser(email, first_name, last_name, Role.STUDENT)
        )

    def urlOf(self, conversation):
        return f"/api/conversations/{conversation.pk}/messages"

    def downloadUrl(self, message_id, conversation=None):
        return (
            f"{self.urlOf(conversation or self.conversation)}/{message_id}/attachment"
        )

    def login(self, email="lea@acme.fr"):
        self.client.post(
            "/api/login", {"email": email, "password": PASSWORD}, format="json"
        )

    def attach(self, file=None, body="", url=None):
        data = {"file": file or upload()}
        if body is not None:
            data["body"] = body
        return self.client.post(url or self.url, data, format="multipart")

    def stored(self):
        return [path for path in self.private_root.rglob("*") if path.is_file()]

    # ----- Envoi par le recruteur -----

    def test_recruiter_sends_a_file_with_a_text(self):
        self.login()
        response = self.attach(body="Voici la convocation")
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(
            (body["body"], body["from_me"]), ("Voici la convocation", True)
        )
        self.assertEqual(
            body["attachment"],
            {
                "name": "Convocation_entretien.pdf",
                "size": len(PDF),
                "extension": "pdf",
                "url": self.downloadUrl(body["id"]),
            },
        )
        # Le fichier est lié au message du fil existant, sans second système
        saved = MessageAttachment.objects.get()
        self.assertEqual(saved.message_id, body["id"])
        self.assertEqual(saved.message.conversation, self.conversation)
        self.assertEqual(saved.message.sender, self.lea.user)
        self.assertEqual(Message.objects.count(), 1)

    def test_a_message_can_hold_only_a_file(self):
        self.login()
        for body in ("", None, "   "):
            response = self.attach(upload(name=f"f{body}.pdf"), body=body)  # type: ignore
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["body"], "")
            self.assertIsNotNone(response.json()["attachment"])

    def test_text_message_without_file_is_unchanged(self):
        self.login()
        response = self.client.post(self.url, {"body": "Bonjour"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.json()["attachment"])
        # Ni texte ni fichier : toujours refusé
        for data in ({}, {"body": ""}, {"body": "  "}):
            self.assertEqual(
                self.client.post(self.url, data, format="multipart").status_code, 400
            )
        self.assertEqual(Message.objects.count(), 1)

    def test_all_accepted_formats(self):
        self.login()
        for name, content, expected in (
            ("a.pdf", PDF, "pdf"),
            ("b.docx", DOCX, "docx"),
            ("c.doc", DOC, "doc"),
            # Le format vient du contenu : l'extension est corrigée, pas crue
            ("d.doc", PDF, "pdf"),
            ("e", DOCX, "docx"),
        ):
            attachment = self.attach(upload(content, name)).json()["attachment"]
            self.assertEqual(attachment["extension"], expected, name)
            self.assertTrue(attachment["name"].endswith(f".{expected}"), name)

    def test_the_name_is_kept_cleaned_and_limited(self):
        self.login()
        attachment = self.attach(upload(name="Fiche de poste (v2).pdf")).json()[
            "attachment"
        ]
        self.assertEqual(attachment["name"], "Fiche_de_poste_v2.pdf")
        self.assertEqual(attachmentName("CV.doc", "pdf"), "CV.doc.pdf")
        long = attachmentName("a" * 300 + ".pdf", "pdf")
        self.assertEqual((len(long), long[-4:]), (100, ".pdf"))
        attachment = self.attach(upload(name="b" * 300 + ".pdf")).json()["attachment"]
        self.assertEqual(len(attachment["name"]), 100)
        # Un chemin dans le nom ne sort pas du dossier de la pièce jointe
        escaped = self.attach(upload(name="../../etc/passwd.pdf")).json()
        self.assertEqual(escaped["attachment"]["name"], "passwd.pdf")
        for path in self.stored():
            self.assertTrue(path.is_relative_to(self.private_root))

    # ----- Fichier refusé ou échec -----

    def assertRefused(self, response, message):
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"errors": {"file": message}})
        # Rien n'est enregistré : ni message, ni fichier
        self.assertEqual(
            (Message.objects.count(), MessageAttachment.objects.count()), (0, 0)
        )
        self.assertEqual(self.stored(), [])

    def test_unsupported_formats_are_refused(self):
        self.login()
        for name, content in (
            ("virus.exe", b"MZ\x90\x00" + b"\0" * 64),
            ("faux.pdf", b"#!/bin/sh\nrm -rf /\n"),
            ("page.pdf", b"<html><script>alert(1)</script></html>"),
            ("tableur.docx", XLSX),
            ("archive.zip", b"PK\x03\x04" + b"\0" * 30),
            ("image.pdf", PNG),
        ):
            self.assertRefused(self.attach(upload(content, name)), FORMAT_ERROR)

    def test_empty_file_is_refused(self):
        self.login()
        self.assertRefused(self.attach(upload(b"")), EMPTY_ERROR)

    def test_too_large_file_is_refused(self):
        self.login()
        with mock.patch("jobup.attachments.ATTACHMENT_MAX_SIZE", len(PDF)):
            self.assertEqual(self.attach(upload(PDF)).status_code, 201)
            with self.captureOnCommitCallbacks(execute=True):
                Message.objects.all().delete()
            self.assertRefused(self.attach(upload(PDF + b"0")), SIZE_ERROR)

    def test_the_limit_is_its_own_and_not_the_resume_one(self):
        # 6 Mo : refusé pour un CV (5 Mo), accepté ici (10 Mo)
        self.login()
        self.assertEqual(
            self.attach(upload(PDF + b"0" * (6 * 1024 * 1024))).status_code, 201
        )

    def test_invalid_text_with_a_file_stores_nothing(self):
        self.login()
        response = self.attach(body="a" * 2001)
        self.assertEqual(response.status_code, 400)
        self.assertEqual((Message.objects.count(), self.stored()), (0, []))

    def test_storage_failure_is_reported_and_nothing_is_kept(self):
        self.login()
        with mock.patch.object(PrivateStorage, "_save", side_effect=OSError("disque")):
            response = self.attach(body="Voici")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"errors": {"file": STORAGE_ERROR}})
        self.assertEqual((Message.objects.count(), self.stored()), (0, []))
        # Le recruteur peut réessayer
        self.assertEqual(self.attach(body="Voici").status_code, 201)

    def test_database_failure_removes_the_stored_file(self):
        self.login()
        with (
            mock.patch.object(
                MessageAttachment, "save", side_effect=DatabaseError("base")
            ),
            self.assertRaises(DatabaseError),
        ):
            self.attach()
        self.assertEqual((Message.objects.count(), self.stored()), (0, []))
        # Le dossier propre à l'envoi est supprimé aussi
        self.assertEqual(
            list((self.private_root / "message_attachments").iterdir()), []
        )

    # ----- Qui peut envoyer -----

    def test_only_the_recruiter_of_the_conversation_can_attach(self):
        # L'étudiant, lui, écrit toujours du texte
        self.login("eleve@example.fr")
        self.assertEqual(self.attach().status_code, 403)
        self.assertEqual(
            self.client.post(self.url, {"body": "Merci"}, format="json").status_code,
            201,
        )
        # Un employé d'école n'envoie pas de fichier non plus
        self.login("rel@univ.fr")
        self.assertEqual(self.attach(url=self.urlOf(self.with_school)).status_code, 403)
        # Un autre recruteur ne voit pas la conversation
        self.login("paul@autre.fr")
        self.assertEqual(self.attach().status_code, 404)
        # Ni un administrateur
        self.makeUser("admin@example.fr", "Jean", "Taire", Role.ADMIN)
        self.login("admin@example.fr")
        self.assertEqual(self.attach().status_code, 404)
        self.assertEqual(MessageAttachment.objects.count(), 0)
        self.assertEqual(self.stored(), [])

    def test_anonymous_cannot_send(self):
        self.assertEqual(self.attach().status_code, 403)
        self.assertEqual(Message.objects.count(), 0)

    # ----- Affichage et téléchargement -----

    def send(self, content=PDF, name="Convocation entretien.pdf", body=""):
        self.login()
        return self.attach(upload(content, name), body=body).json()

    def test_student_and_recruiter_both_see_the_file(self):
        sent = self.send(body="Voici")
        self.client.post(self.url, {"body": "Merci"}, format="json")
        for email, from_me in (
            ("lea@acme.fr", [True, True]),
            ("eleve@example.fr", [False, False]),
        ):
            self.login(email)
            messages = self.client.get(self.url).json()["messages"]
            self.assertEqual([m["from_me"] for m in messages], from_me)
            self.assertEqual(messages[0]["attachment"], sent["attachment"])
            self.assertIsNone(messages[1]["attachment"])

    def test_refresh_and_history_include_the_file(self):
        first = self.send()
        second = self.send(name="Offre.pdf")
        self.login("eleve@example.fr")
        news = self.client.get(self.url, {"after": first["id"]}).json()["messages"]
        self.assertEqual(news[0]["attachment"], second["attachment"])
        older = self.client.get(self.url, {"before": second["id"]}).json()["messages"]
        self.assertEqual(older[0]["attachment"], first["attachment"])

    def test_participants_download_the_file(self):
        sent = self.send(DOCX, "Contrat.docx")
        url = sent["attachment"]["url"]
        for email in ("lea@acme.fr", "eleve@example.fr"):
            self.login(email)
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(b"".join(response.streaming_content), DOCX)  # type: ignore
            self.assertEqual(
                response["Content-Disposition"],
                'attachment; filename="Contrat.docx"',
            )
            self.assertEqual(
                response["Content-Type"],
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
            self.assertEqual(response["X-Content-Type-Options"], "nosniff")
            self.assertEqual(response["Cache-Control"], "private, no-store")
            response.close()

    def test_school_participant_downloads_in_its_own_conversation(self):
        # Le fil de l'école est le même socle : ses participants y téléchargent
        message = Message.objects.create(
            conversation=self.with_school, sender=self.student.user, body=""
        )
        MessageAttachment.store(message, upload(), "Pièce.pdf")
        self.login("rel@univ.fr")
        response = self.client.get(self.downloadUrl(message.pk, self.with_school))
        self.assertEqual(response.status_code, 200)
        response.close()

    def test_only_participants_download(self):
        sent = self.send()
        url = sent["attachment"]["url"]
        self.client.logout()
        self.assertEqual(self.client.get(url).status_code, 403)
        other = self.makeStudent("autre@example.fr", "Marc", "Blanc")
        self.assertTrue(other.user.pk)
        self.makeUser("admin@example.fr", "Jean", "Taire", Role.ADMIN)
        for email in (
            "autre@example.fr",
            "paul@autre.fr",
            "rel@univ.fr",
            "admin@example.fr",
        ):
            self.login(email)
            self.assertEqual(self.client.get(url).status_code, 404, email)

    def test_a_message_of_another_conversation_is_not_reachable(self):
        # Le recruteur Paul a sa propre conversation : l'identifiant de message ne suffit pas
        private = Conversation.objects.create(student=self.student, recruiter=self.paul)
        secret = Message.objects.create(
            conversation=private, sender=self.paul.user, body=""
        )
        MessageAttachment.store(secret, upload(), "Secret.pdf")
        self.login("lea@acme.fr")
        for url in (
            self.downloadUrl(secret.pk),  # via sa propre conversation
            self.downloadUrl(secret.pk, private),  # via celle de Paul
        ):
            self.assertEqual(self.client.get(url).status_code, 404)

    def test_missing_attachment_or_file_is_not_found(self):
        self.login()
        plain = self.client.post(self.url, {"body": "Texte"}, format="json").json()
        self.assertEqual(
            self.client.get(self.downloadUrl(plain["id"])).status_code, 404
        )
        self.assertEqual(self.client.get(self.downloadUrl(9999)).status_code, 404)
        self.assertEqual(
            self.client.get(
                "/api/conversations/9999/messages/1/attachment"
            ).status_code,
            404,
        )
        sent = self.attach().json()
        os.remove(self.stored()[0])
        self.assertEqual(self.client.get(sent["attachment"]["url"]).status_code, 404)

    # ----- Stockage protégé -----

    def test_files_are_never_stored_in_a_public_folder(self):
        sent = self.send()
        (path,) = self.stored()
        self.assertTrue(path.is_relative_to(self.private_root))
        self.assertFalse(path.is_relative_to(settings.MEDIA_ROOT))
        # Ni le chemin ni une adresse du stockage ne sont donnés
        self.assertNotIn(path.parent.name, str(sent))
        self.assertEqual(
            sorted(sent["attachment"]), ["extension", "name", "size", "url"]
        )
        attachment = MessageAttachment.objects.get()
        with self.assertRaises(ValueError):
            attachment.file.url  # noqa: B018

    def test_a_deleted_message_takes_its_file_with_it(self):
        self.send()
        self.assertEqual(len(self.stored()), 1)
        with self.captureOnCommitCallbacks(execute=True):
            self.conversation.delete()
        self.assertEqual((MessageAttachment.objects.count(), self.stored()), (0, []))
        # Le dossier de la pièce jointe disparaît aussi, pas message_attachments
        self.assertEqual(
            list((self.private_root / "message_attachments").iterdir()), []
        )

    # ----- Liste des conversations -----

    def test_summary_shows_the_file_of_the_last_message(self):
        self.send()
        self.login("eleve@example.fr")
        last = self.client.get("/api/student/conversations").json()
        by_id = {c["id"]: c["last_message"] for c in last}
        self.assertEqual(
            by_id[self.conversation.pk]["attachment"], "Convocation_entretien.pdf"
        )
        self.assertEqual(by_id[self.conversation.pk]["body"], "")
        self.assertIsNone(by_id[self.with_school.pk])
        # Un message plus récent sans fichier prend la place
        self.client.post(self.url, {"body": "Merci"}, format="json")
        last = self.client.get("/api/student/conversations").json()[0]["last_message"]
        self.assertEqual((last["body"], last["attachment"]), ("Merci", None))
