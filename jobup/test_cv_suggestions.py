import io
import tempfile
import zipfile
from html import escape

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework.test import APITestCase

from .cv_suggestions import (
    KNOWN_SKILLS,
    MAX_DOCX_XML,
    degreeOf,
    docxText,
    education,
    position,
    regionIn,
    skillsIn,
    suggestionsFrom,
)
from .models import Recruiter, Role, Student, User
from .test_profile import PASSWORD, createStudent
from .test_resume import DOC


def pdfBytes(lines: list[str]) -> bytes:
    # PDF d'une page dont le texte se lit, comme un CV exporté par un traitement de texte
    def literal(text: str) -> bytes:
        raw = text.encode("cp1252")
        raw = raw.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")
        return b"(" + raw + b")"

    content = (
        b"BT /F1 11 Tf 50 800 Td 14 TL "
        + b" ".join(literal(line) + b" '" for line in lines)
        + b" ET"
    )
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]"
        b" /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, 1):
        offsets.append(out.tell())
        out.write(b"%d 0 obj\n" % number + body + b"\nendobj\n")
    xref = out.tell()
    out.write(b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1))
    for offset in offsets:
        out.write(b"%010d 00000 n \n" % offset)
    out.write(
        b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n"
        % (len(objects) + 1, xref)
    )
    return out.getvalue()


def docxBytes(paragraphs: list[str], xml: str | None = None) -> bytes:
    body = "".join(
        f'<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>'
        for text in paragraphs
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr(
            "word/document.xml",
            xml
            or f'<?xml version="1.0"?><w:document xmlns:w="w"><w:body>{body}</w:body></w:document>',
        )
    return buffer.getvalue()


CV = [
    "Lucas MARTIN",
    "Développeur Full Stack en alternance",
    "12 rue de la Paix, 75002 Paris • lucas.martin@example.fr",
    "PROFIL",
    "Étudiant en Master 2 MIAGE, je recherche une alternance de 12 mois en tant que "
    "développeur web à partir de septembre 2026.",
    "FORMATION",
    "Sept. 2025 – aujourd’hui Master 2 MIAGE — Université Paris Nanterre",
    "2022 - 2025 Licence Informatique, Université de Lyon",
    "COMPÉTENCES",
    "Java, Spring Boot, JavaScript, React, SQL, Git, Docker",
]
EXPECTED = {
    "desired_position": "Développeur web",
    "education": "Master 2 MIAGE — Université Paris Nanterre",
    "study_degree": 5,
    "skills": ["Java", "Spring Boot", "JavaScript", "React", "SQL", "Git", "Docker"],
    "region": "Île-de-France",
}


class SuggestionApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alice = createStudent("alice@mail.fr")
        cls.url = f"/api/student/{cls.alice.pk}/resume/suggestions"

    def setUp(self):
        media = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(self.settings(MEDIA_ROOT=media))
        self.client.force_login(self.alice)

    def withResume(self, name: str, content: bytes):
        path = default_storage.save(f"CVs/{'a' * 32}/{name}", ContentFile(content))
        Student.objects.filter(user=self.alice).update(resume=path)

    def test_suggestions_from_a_pdf(self):
        self.withResume("CV.pdf", pdfBytes(CV))
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"readable": True, "suggestions": EXPECTED})

    def test_suggestions_from_a_word_document(self):
        self.withResume("CV.docx", docxBytes(CV))
        self.assertEqual(
            self.client.get(self.url).json(),
            {"readable": True, "suggestions": EXPECTED},
        )

    def test_nothing_is_saved(self):
        self.withResume("CV.docx", docxBytes(CV))
        before = Student.objects.filter(user=self.alice).values().first()
        self.client.get(self.url)
        self.assertEqual(
            Student.objects.filter(user=self.alice).values().first(), before
        )

    def test_unreadable_resumes(self):
        # Ancien format Word, PDF abîmé, PDF scanné (sans texte), archive sans document
        broken_zip = io.BytesIO()
        with zipfile.ZipFile(broken_zip, "w") as archive:
            archive.writestr("word/other.xml", "<x/>")
        for name, content in (
            ("CV.doc", DOC),
            ("CV.pdf", b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\nnot a pdf"),
            ("CV.pdf", pdfBytes([])),
            ("CV.docx", broken_zip.getvalue()),
        ):
            self.withResume(name, content)
            response = self.client.get(self.url)
            self.assertEqual(response.status_code, 200, name)
            self.assertEqual(
                response.json(), {"readable": False, "suggestions": {}}, name
            )

    def test_readable_but_nothing_found(self):
        self.withResume("CV.docx", docxBytes(["Bonjour", "Rien d’utile ici."]))
        self.assertEqual(
            self.client.get(self.url).json(), {"readable": True, "suggestions": {}}
        )

    def test_without_resume(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "Resume not found"})

    def test_only_the_student_reads_their_suggestions(self):
        self.withResume("CV.docx", docxBytes(CV))
        bob = createStudent("bob@mail.fr")
        recruiter = User.objects.create_user(
            "lea@acme.fr",
            PASSWORD,
            first_name="Léa",
            last_name="Martin",
            role=Role.RECRUITER,
        )
        Recruiter.objects.create(user=recruiter)
        for user in (bob, recruiter):
            self.client.force_login(user)
            self.assertEqual(self.client.get(self.url).status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get(self.url).status_code, 403)
        # Son propre identifiant, sans profil étudiant
        self.client.force_login(recruiter)
        response = self.client.get(f"/api/student/{recruiter.pk}/resume/suggestions")
        self.assertEqual(response.status_code, 404)

    def test_spelling_of_the_skills_already_entered(self):
        # L'orthographe des autres étudiants, celle des filtres des recruteurs, l'emporte
        createStudent("bob@mail.fr", skills="Spring boot, Figma")
        self.withResume("CV.docx", docxBytes(["Compétences : spring boot, java"]))
        suggestions = self.client.get(self.url).json()["suggestions"]
        self.assertEqual(suggestions["skills"], ["Spring boot", "Java"])


class TextTests(APITestCase):
    def test_word_text_is_unescaped_without_xml_parsing(self):
        xml = (
            '<?xml version="1.0"?><!DOCTYPE w [<!ENTITY big "AAAA">]>'
            '<w:document xmlns:w="w"><w:body>'
            "<w:p><w:r><w:t>R&amp;D</w:t><w:tab/><w:t>&big;</w:t></w:r></w:p>"
            "</w:body></w:document>"
        )
        # L'entité déclarée n'est pas développée : le texte reste tel quel
        self.assertEqual(docxText(docxBytes([], xml)), "R&D &big;")

    def test_a_huge_word_document_is_not_read(self):
        xml = "<w:p><w:r><w:t>" + "a" * (MAX_DOCX_XML + 1) + "</w:t></w:r></w:p>"
        self.assertEqual(docxText(docxBytes([], xml)), "")


class RuleTests(APITestCase):
    def test_study_degree(self):
        self.assertEqual(degreeOf("Bac+3 Informatique"), 3)
        self.assertEqual(degreeOf("Bac + 5"), 5)
        self.assertEqual(degreeOf("M1 Data Science"), 4)
        self.assertEqual(degreeOf("Master MIAGE"), 5)
        self.assertEqual(degreeOf("BTS SIO"), 2)
        self.assertEqual(degreeOf("BUT Informatique"), 3)
        # « but » en minuscules est un mot du français, le baccalauréat seul n'est pas un niveau
        self.assertIsNone(degreeOf("Dans le but de progresser"))
        self.assertIsNone(degreeOf("Baccalauréat général"))

    def test_education_is_the_highest_degree_without_its_dates(self):
        lines = [
            "2022 - 2025 Licence Informatique, Université de Lyon",
            "Master 1 MIAGE (2025-2026) | Université Paris Nanterre",
            "Étudiant en Master 2, je recherche une alternance en data",
        ]
        self.assertEqual(
            education(lines), ("Master 1 MIAGE | Université Paris Nanterre", 4)
        )
        self.assertIsNone(education(["Stage de 6 mois chez Acme"]))

    def test_position(self):
        self.assertEqual(position(["Poste recherché : Data analyst"]), "Data analyst")
        self.assertEqual(
            position(
                [
                    "Je suis à la recherche d'un contrat d'apprentissage comme chargée de communication pour septembre"
                ]
            ),
            "Chargée de communication",
        )
        # Le titre du CV, à défaut d'une phrase
        self.assertEqual(
            position(["Développeur Full Stack en alternance"]), "Développeur Full Stack"
        )
        self.assertEqual(
            position(
                ["Développeur mobile en alternance", "Objectif : Développeur iOS"]
            ),
            "Développeur iOS",
        )
        self.assertIsNone(position(["Étudiant en Master MIAGE en alternance"]))
        self.assertIsNone(position(["Disponible en alternance dès septembre"]))

    def test_skills(self):
        text = (
            "JavaScript, Spring Boot, React Native et React. "
            "Rédaction d'un tableau de bord, point de vue client. C++ et C#. "
            "Tableau et Word."
        )
        self.assertEqual(
            skillsIn(text, KNOWN_SKILLS),
            [
                "JavaScript",
                "Spring Boot",
                "React Native",
                "React",
                "C++",
                "C#",
                "Tableau",
                "Word",
            ],
        )
        # Au plus 20
        many = ", ".join(KNOWN_SKILLS[:30])
        self.assertEqual(len(skillsIn(many, KNOWN_SKILLS)), 20)

    def test_region_is_the_first_place_cited(self):
        self.assertEqual(
            regionIn("Habite à Lyon, études à Paris"), "Auvergne-Rhône-Alpes"
        )
        self.assertEqual(regionIn("Région : Île-de-France"), "Île-de-France")
        self.assertIsNone(regionIn("Visites de tours guidées"))

    def test_nothing_found(self):
        self.assertEqual(suggestionsFrom("", KNOWN_SKILLS), {})
