from django.core.management import call_command

from .models import Student, User
from .test_candidates import LIST, CandidateTestCase
from .test_login import USERS

FILTERS = f"{LIST}/filters"


class CandidateFilterTestCase(CandidateTestCase):
    def setUp(self):
        super().setUp()
        # alice: back-end developer, 5 months, Java, Spring Boot, SQL, Paris
        # bob: nothing filled in (0 month, Île-de-France by default)
        Student.objects.filter(pk=self.alice.pk).update(
            desired_position="Développeur back-end", experience_level=5
        )
        self.dana = self.student(
            "dana@mail.fr", "Data analyst", 30, "Power BI, SQL, Excel", "Bordeaux"
        )
        self.eve = self.student(
            "eve@mail.fr", "data ANALYST", 6, "Excel", "Télétravail"
        )
        self.frank = self.student(
            "frank@mail.fr", "developpeur BACK END", 23, "postgresql", "Saint-Étienne"
        )

    def student(self, email, position, months, skills, region) -> Student:
        user = User.objects.create_user(**USERS[0].fork(email=email, first_name=email))
        return Student.objects.create(
            user=user,
            desired_position=position,
            experience_level=months,
            skills=skills,
            region=region,
        )

    def found(self, **criteria) -> set[int]:
        response = self.client.get(LIST, criteria)
        self.assertEqual(response.status_code, 200, response.content)
        return {card["id"] for card in response.json()}

    def ids(self, *students: Student) -> set[int]:
        return {student.user.pk for student in students}


class CandidateFilterTests(CandidateFilterTestCase):
    def setUp(self):
        super().setUp()
        USERS[3].login(self)

    def test_without_criteria_every_card(self):
        everyone = self.ids(self.alice, self.bob, self.dana, self.eve, self.frank)
        self.assertEqual(self.found(), everyone)
        # Empty criteria are not applied, and the card position of the page is ignored
        self.assertEqual(self.found(position="", skill=" ", candidate="3"), everyone)

    def test_position_ignores_case_accents_and_hyphens(self):
        self.assertEqual(
            self.found(position="data analyst"), self.ids(self.dana, self.eve)
        )
        self.assertEqual(
            self.found(position="Développeur back-end"),
            self.ids(self.alice, self.frank),
        )
        # The whole position, not a part of it
        self.assertEqual(self.found(position="Développeur"), set())

    def test_experience_levels_and_their_limits(self):
        self.assertEqual(
            self.found(experience="beginner"), self.ids(self.bob, self.alice)
        )
        self.assertEqual(
            self.found(experience="junior"), self.ids(self.eve, self.frank)
        )
        self.assertEqual(self.found(experience="confirmed"), self.ids(self.dana))

    def test_skill_is_a_whole_item_of_the_list(self):
        # "SQL" is not "postgresql"
        self.assertEqual(self.found(skill="sql"), self.ids(self.alice, self.dana))
        self.assertEqual(self.found(skill="EXCEL"), self.ids(self.dana, self.eve))
        self.assertEqual(self.found(skill="Power BI"), self.ids(self.dana))
        self.assertEqual(self.found(skill="Figma"), set())

    def test_region_is_looked_for_in_the_region_of_the_student(self):
        self.assertEqual(self.found(region="paris"), self.ids(self.alice))
        self.assertEqual(self.found(region="saint etienne"), self.ids(self.frank))
        self.assertEqual(self.found(region="Île-de-France"), self.ids(self.bob))
        self.assertEqual(self.found(region="Marseille"), set())

    def test_remote(self):
        # Every way of writing it finds the students who wrote one of them
        for wanted in ("remote", "REMOTE", "télétravail", "à distance"):
            self.assertEqual(self.found(region=wanted), self.ids(self.eve), wanted)
        Student.objects.filter(pk=self.bob.pk).update(region="Full remote")
        self.assertEqual(self.found(region="remote"), self.ids(self.bob, self.eve))

    def test_criteria_are_combined(self):
        dana = {
            "position": "Data analyst",
            "experience": "confirmed",
            "skill": "SQL",
            "region": "Bordeaux",
        }
        self.assertEqual(self.found(**dana), self.ids(self.dana))
        self.assertEqual(self.found(**{**dana, "region": "Paris"}), set())
        self.assertEqual(self.found(**{**dana, "experience": "junior"}), set())
        self.assertEqual(
            self.found(position="data analyst", region="remote"), self.ids(self.eve)
        )

    def test_invalid_criteria(self):
        for criteria in (
            {"experience": "expert"},
            {"region": "x" * 65},
            {"skill": "x" * 65},
            {"position": "x" * 101},
        ):
            response = self.client.get(LIST, criteria)
            self.assertEqual(response.status_code, 400, criteria)
            self.assertEqual(response.json(), {"error": "Invalid filters"})

    def test_recruiter_rules_still_apply(self):
        # Kept (JOB-037) and excluded (JOB-038) candidates stay out of the cards,
        # inactive students are never found
        self.client.post(f"{LIST}/{self.dana.user.pk}/shortlist")
        self.client.post(f"{LIST}/{self.eve.user.pk}/exclusion")
        self.assertEqual(self.found(position="data analyst"), set())
        self.assertEqual(self.found(skill="excel"), set())
        self.carol.skills = "SQL"
        self.carol.save()
        self.assertEqual(self.found(skill="sql"), self.ids(self.alice))


class CandidateFilterListTests(CandidateFilterTestCase):
    def test_only_recruiters(self):
        self.assertOnlyRecruiters(FILTERS)
        self.assertOnlyRecruiters(f"{LIST}?skill=SQL")

    def test_values_of_the_lists(self):
        USERS[3].login(self)
        response = self.client.get(FILTERS)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                # One spelling per value, in alphabetical order whatever the accents
                "positions": ["Data analyst", "Développeur back-end"],
                "experiences": [
                    {"value": "beginner", "label": "Débutant (moins de 6 mois)"},
                    {"value": "junior", "label": "Junior (6 mois à 2 ans)"},
                    {"value": "confirmed", "label": "Confirmé (2 ans et plus)"},
                ],
                "skills": [
                    "Excel",
                    "Java",
                    "postgresql",
                    "Power BI",
                    "Spring Boot",
                    "SQL",
                ],
            },
        )

    def test_every_value_finds_a_card_of_this_recruiter(self):
        USERS[3].login(self)
        self.client.post(f"{LIST}/{self.dana.user.pk}/shortlist")
        self.client.post(f"{LIST}/{self.eve.user.pk}/exclusion")
        lists = self.client.get(FILTERS).json()
        self.assertEqual(lists["positions"], ["Développeur back-end"])
        self.assertEqual(lists["skills"], ["Java", "postgresql", "Spring Boot", "SQL"])
        for skill in lists["skills"]:
            self.assertNotEqual(self.found(skill=skill), set(), skill)

    def test_demo_candidates_have_criteria(self):
        call_command("seed_candidates", USERS[3].email, stdout=None)
        USERS[3].login(self)
        positions = self.client.get(FILTERS).json()["positions"]
        self.assertIn("Développeur back-end", positions)
        self.assertIn("Développeuse front-end", positions)
