from datetime import date

from rest_framework.test import APITestCase

from .models import JobCategory, Recruiter, Role, Student, StudyDegree, User
from .test_profile import PASSWORD, createStudent


# Profil complet de l'étudiant (JOB-071) : les champs que les recruteurs voient et filtrent
class ProfileDetailsTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alice = createStudent("alice@mail.fr")
        cls.url = f"/api/student/{cls.alice.pk}"

    def setUp(self):
        self.client.force_login(self.alice)

    def patch(self, data):
        return self.client.patch(self.url, data, format="json")

    def student(self) -> Student:
        return Student.objects.get(user=self.alice)

    def assertRefused(self, data, field, message):
        before = Student.objects.filter(user=self.alice).values().first()
        response = self.patch(data)
        self.assertEqual(response.status_code, 400, data)
        self.assertEqual(response.json()["errors"], {field: message}, data)
        # Rien n'est enregistré quand une valeur est refusée
        self.assertEqual(
            Student.objects.filter(user=self.alice).values().first(), before
        )

    def test_every_field_of_the_profile(self):
        response = self.patch(
            {
                "education": "  Master MIAGE  ",
                "study_degree": StudyDegree.MASTER1,
                "category": JobCategory.DATA_AI,
                "experience_level": 14,
                "skills": ["Python", " SQL ", "Power BI"],
                "region": "Lyon",
                "available_from": "2026-09-01",
            }
        )
        self.assertEqual(response.status_code, 200)
        profile = response.json()
        self.assertEqual(profile["education"], "Master MIAGE")
        self.assertEqual(profile["study_degree"], 4)
        self.assertEqual(profile["category"], 2)
        self.assertEqual(profile["experience_level"], 14)
        self.assertEqual(profile["skills"], ["Python", "SQL", "Power BI"])
        self.assertEqual(profile["region"], "Lyon")
        self.assertEqual(profile["available_from"], "2026-09-01")
        # Conservé, et stocké comme le lisent les filtres des recruteurs
        student = self.student()
        self.assertEqual(student.skills, "Python, SQL, Power BI")
        self.assertEqual(student.available_from, date(2026, 9, 1))
        self.assertEqual(self.client.get(self.url).json(), profile)

    def test_only_the_fields_sent_change(self):
        self.patch({"education": "BUT Informatique", "skills": ["Java"]})
        self.patch({"skills": ["Java", "Docker"]})
        student = self.student()
        self.assertEqual(student.education, "BUT Informatique")
        self.assertEqual(student.skills, "Java, Docker")
        self.assertEqual(student.study_degree, StudyDegree.MASTER2)

    def test_lists_and_dates_are_cleared(self):
        self.patch({"skills": ["Java"], "available_from": "2026-09-01"})
        response = self.patch(
            {
                "skills": [],
                "available_from": None,
                "study_degree": None,
                "category": None,
            }
        )
        self.assertEqual(response.status_code, 200)
        profile = response.json()
        self.assertEqual(profile["skills"], [])
        self.assertIsNone(profile["available_from"])
        self.assertIsNone(profile["study_degree"])
        self.assertIsNone(profile["category"])

    def test_skills_once_each_whatever_the_case(self):
        response = self.patch({"skills": ["Python", "python", "PYTHON ", "SQL"]})
        self.assertEqual(response.json()["skills"], ["Python", "SQL"])

    def test_refused_skills(self):
        message = "Indiquez au plus 20 compétences, de 40 caractères au plus chacune et sans virgule."
        for skills in (
            ["Java, SQL"],
            ["x" * 41],
            [""],
            [f"Compétence {n}" for n in range(21)],
            # 256 caractères au plus une fois séparées par des virgules
            [f"{'x' * 30}{n}" for n in range(9)],
            "Java",
            [3],
        ):
            self.assertRefused({"skills": skills}, "skills", message)

    def test_refused_choices_and_numbers(self):
        for value in (6, 0, True, "5"):
            self.assertRefused(
                {"study_degree": value},
                "study_degree",
                "Choisissez un niveau d’études de la liste.",
            )
        for value in (50, True):
            self.assertRefused(
                {"category": value}, "category", "Choisissez un domaine de la liste."
            )
        for value in (-1, 601, True, "12", 1.5):
            self.assertRefused(
                {"experience_level": value},
                "experience_level",
                "L’expérience est un nombre de mois, de 0 à 600.",
            )
        self.assertEqual(
            self.patch({"experience_level": 600}).json()["experience_level"], 600
        )

    def test_refused_dates_and_texts(self):
        for value in ("2026-13-01", "demain", 0):
            self.assertRefused(
                {"available_from": value}, "available_from", "Indiquez une date valide."
            )
        self.assertRefused(
            {"education": "x" * 101},
            "education",
            "La formation ne doit pas dépasser 100 caractères.",
        )
        self.assertRefused(
            {"region": "x" * 65},
            "region",
            "La région ne doit pas dépasser 64 caractères.",
        )
        self.assertRefused({"region": 75}, "region", "Ce champ doit être un texte.")

    def test_only_the_student_updates_their_profile(self):
        bob = createStudent("bob@mail.fr")
        self.client.force_login(bob)
        response = self.patch({"skills": ["Piratage"]})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.student().skills, "")

    def test_the_recruiter_card_shows_the_program(self):
        recruiter = User.objects.create_user(
            "lea@acme.fr",
            PASSWORD,
            first_name="Léa",
            last_name="Martin",
            role=Role.RECRUITER,
        )
        Recruiter.objects.create(user=recruiter)
        self.patch(
            {"education": "Master MIAGE", "skills": ["Python"], "region": "Lyon"}
        )
        self.client.force_login(recruiter)
        card = self.client.get(f"/api/recruiter/candidates/{self.alice.pk}").json()
        self.assertEqual(card["education"], "Master MIAGE")
        self.assertEqual(card["skills"], ["Python"])
        self.assertEqual(card["region"], "Lyon")
        # Et les filtres des recruteurs le trouvent
        found = self.client.get(
            "/api/recruiter/candidates", {"skill": "python", "region": "lyon"}
        ).json()
        self.assertEqual([candidate["id"] for candidate in found], [self.alice.pk])
