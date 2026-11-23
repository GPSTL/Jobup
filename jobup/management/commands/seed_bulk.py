# Large demo data, for a demo site with fake users only (local or deployed): hundreds of accounts covering many cases, to try the lists,
# filters and pages of every role (administration included).
#
#   python manage.py seed_bulk [--students 300]
#
# - students looking for a job or not, in a school, waiting for one, refused or without any,
#   with or without a CV, premium or not, a few suspended;
# - companies validated, pending or refused, with recruiters who have offers or not;
# - offers with candidates (applications at every step) or without;
# - schools validated, pending or refused, with managers (some without a school);
# - 2 administrators.
#
# Demo accounts, all with the password Demo1234 (short addresses):
#   admin@demo.fr, admin2@demo.fr, etudiant@demo.fr, etudiant2@demo.fr, etudiant3@demo.fr,
#   recruteur@demo.fr, recruteur2@demo.fr, recruteur3@demo.fr,
#   manager@demo.fr, manager2@demo.fr, manager3@demo.fr
#
# Every account has the same known password: only for a site that holds no real user.
# The data is the same at each run and nothing is created twice. Nothing is deleted.
import random
import unicodedata
from datetime import date, timedelta

from django.contrib.auth.hashers import make_password
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.test import override_settings
from django.utils import timezone

from jobup.management.commands.seed_candidates import demoResume
from jobup.models import (
    ApplicationStatus,
    Company,
    ContractType,
    Exclusion,
    JobApplication,
    JobCategory,
    Offer,
    Recruiter,
    ReviewStatus,
    Role,
    SavedOffer,
    School,
    SchoolManager,
    SchoolRequest,
    SchoolRequestStatus,
    Shortlist,
    Student,
    StudentSubscription,
    StudyDegree,
    User,
)

PASSWORD = "Demo1234"
DOMAIN = "demo.fr"

FIRST_NAMES = [
    "Alice", "Amine", "Anaïs", "Antoine", "Aya", "Bastien", "Camille", "Chloé", "Clément",
    "Daniel", "Emma", "Enzo", "Fatou", "Gabriel", "Hugo", "Inès", "Jade", "Julien", "Karim",
    "Léa", "Léo", "Lina", "Louis", "Lucas", "Manon", "Mathis", "Maëlle", "Nathan", "Nina",
    "Noah", "Océane", "Paul", "Quentin", "Rayan", "Romane", "Sacha", "Sarah", "Théo",
    "Yasmine", "Zoé",
]  # fmt: skip
LAST_NAMES = [
    "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy",
    "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Garcia", "David", "Bertrand", "Roux",
    "Vincent", "Fournier", "Morel", "Girard", "André", "Mercier", "Dupont", "Lambert", "Bonnet",
    "François", "Martinez", "Legrand", "Garnier", "Faure", "Rousseau", "Blanc", "Guerin",
    "Muller", "Henry", "Roussel", "Nicolas", "Perrin", "Benali", "Diallo", "Nguyen", "Traoré",
]  # fmt: skip
CITIES = [
    "Paris", "Lyon", "Marseille", "Toulouse", "Nantes", "Bordeaux", "Lille", "Rennes",
    "Strasbourg", "Montpellier", "Nice", "Grenoble",
]  # fmt: skip

SCHOOLS: list[tuple[str, ReviewStatus]] = [
    ("École Centrale de Démo", ReviewStatus.VALIDATED),
    ("Université de Démonstration", ReviewStatus.VALIDATED),
    ("IUT Sorbonne Nord", ReviewStatus.VALIDATED),
    ("Epitech Démo", ReviewStatus.VALIDATED),
    ("ISEG Démo", ReviewStatus.VALIDATED),
    ("Institut Polytechnique Démo", ReviewStatus.VALIDATED),
    ("Business School Lyon Démo", ReviewStatus.VALIDATED),
    ("Université Lille Démo", ReviewStatus.VALIDATED),
    ("École du Numérique Bordeaux", ReviewStatus.PENDING),
    ("Académie Design Nantes", ReviewStatus.PENDING),
    ("Institut Santé Toulouse", ReviewStatus.PENDING),
    ("Campus Créatif Rennes", ReviewStatus.PENDING),
    ("École Fantôme", ReviewStatus.REFUSED),
    ("Institut Douteux", ReviewStatus.REFUSED),
]

# (desired position, category, skills)
POSITIONS: list[tuple[str, JobCategory, str]] = [
    ("Développeur back-end", JobCategory.COMPUTER_SCIENCE, "Java, Spring Boot, SQL, Docker"),
    ("Développeuse front-end", JobCategory.COMPUTER_SCIENCE, "React, TypeScript, CSS, Figma"),
    ("Développeur full-stack", JobCategory.COMPUTER_SCIENCE, "Python, Django, React, Git"),
    ("Data analyst", JobCategory.DATA_AI, "Python, SQL, Power BI, Pandas"),
    ("Data scientist", JobCategory.DATA_AI, "Python, scikit-learn, TensorFlow, SQL"),
    ("Analyste cybersécurité", JobCategory.CYBERSECURITY, "Pentest, SIEM, Linux, Réseaux"),
    ("Chargé de marketing digital", JobCategory.MARKETING, "SEO, Google Ads, Canva, Analytics"),
    ("Assistant chef de projet", JobCategory.PROJECT_MANAGEMENT, "Agile, Jira, Scrum, Excel"),
    ("UX/UI designer", JobCategory.DESIGN, "Figma, Prototypage, Recherche utilisateur"),
    ("Assistant comptable", JobCategory.FINANCE, "Excel, Sage, Comptabilité, Paie"),
    ("Chargé de recrutement", JobCategory.HUMAN_RESOURCES, "Sourcing, Entretiens, SIRH"),
    ("Chargé de communication", JobCategory.COMMUNICATION_PR, "Rédaction, Réseaux sociaux, Adobe"),
    ("Business developer", JobCategory.SALES_BD, "Prospection, CRM, Négociation"),
    ("Ingénieur mécanique", JobCategory.ENGINEERING, "SolidWorks, CAO, Gestion de projet"),
    ("Assistant juridique", JobCategory.LEGAL_COMPLIANCE, "Droit des contrats, RGPD, Veille"),
    ("Logisticien", JobCategory.SUPPLY_CHAIN_LOGISTICS, "WMS, Excel, Gestion des stocks"),
]  # fmt: skip

COMPANY_PREFIXES = [
    "Atlas", "Nova", "Orion", "Helix", "Vertex", "Lumen", "Axiom", "Kobalt", "Pixel", "Solis",
    "Altéa", "Brio", "Cinder", "Delta", "Éclair", "Fusion", "Granit", "Horizon", "Iris", "Jade",
]  # fmt: skip
COMPANY_SUFFIXES = [
    "Tech",
    "Conseil",
    "Industries",
    "Studio",
    "Labs",
    "Group",
    "Solutions",
]

STATUS_WEIGHTS = [
    (ApplicationStatus.DRAFT, 8),
    (ApplicationStatus.SUBMITTED, 30),
    (ApplicationStatus.READ, 20),
    (ApplicationStatus.IN_REVIEW, 18),
    (ApplicationStatus.ACCEPTED, 12),
    (ApplicationStatus.REFUSED, 12),
]


def slug(text: str) -> str:
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return "".join(char for char in plain.lower() if char.isalnum())


class Seeder:
    def __init__(self, students: int, stdout):
        self.rng = random.Random(2026)
        self.students_count = students
        self.stdout = stdout
        self.password = make_password(PASSWORD)  # hashed once: hundreds of users
        self.now = timezone.now()
        self.schools: dict[str, School] = {}
        self.validated_schools: list[School] = []
        self.companies: list[Company] = []
        self.offers: list[Offer] = []
        self.active_students: list[Student] = []

    # ----- accounts -----

    def user(
        self, email: str, first: str, last: str, role: Role, **fields
    ) -> tuple[User, bool]:
        days = self.rng.randint(1, 400)
        user = User.objects.filter(email=email).first()
        if user:
            return user, False
        user = User.objects.create(
            email=email, first_name=first, last_name=last, role=role,
            password=self.password, **fields,
        )  # fmt: skip
        # date_joined is automatic: spread it, for the sorts of the lists
        User.objects.filter(pk=user.pk).update(
            date_joined=self.now - timedelta(days=days)
        )
        return user, True

    def seed(self, key: str) -> None:
        # One generator per item, so that a second run draws the same values for an item it
        # already created, and creates nothing new
        self.rng.seed(f"{key}")

    def person(self) -> tuple[str, str]:
        return self.rng.choice(FIRST_NAMES), self.rng.choice(LAST_NAMES)

    def suspended(self) -> dict:
        # A few accounts are suspended (3 %)
        if self.rng.random() < 0.03:
            return {
                "is_active": False,
                "suspended_at": self.now - timedelta(days=self.rng.randint(1, 60)),
            }
        return {}

    # ----- schools, companies -----

    def make_schools(self):
        for name, status in SCHOOLS:
            school, _ = School.objects.get_or_create(name=name)
            School.objects.filter(pk=school.pk).update(status=status)
            school.status = status
            self.schools[name] = school
            if status == ReviewStatus.VALIDATED:
                self.validated_schools.append(school)

    def make_companies(self):
        self.seed("companies")
        index = 0
        for prefix in COMPANY_PREFIXES:
            for suffix in self.rng.sample(COMPANY_SUFFIXES, 2):
                index += 1
                roll = self.rng.random()
                status = (
                    ReviewStatus.VALIDATED if roll < 0.6
                    else ReviewStatus.PENDING if roll < 0.85
                    else ReviewStatus.REFUSED
                )  # fmt: skip
                self.company(f"{prefix} {suffix}", f"8{index:013d}", status)

    def company(self, name: str, siret: str, status: ReviewStatus) -> Company:
        self.seed(f"company-{name}")
        company, _ = Company.objects.get_or_create(
            name=name,
            defaults={
                "siret": siret,
                "sector": self.rng.choice(list(JobCategory)).value,
                "city": self.rng.choice(CITIES),
                "employees": self.rng.choice([8, 25, 60, 150, 400, 1200]),
                "website": f"https://{slug(name)}.example.fr",
                "description": f"{name} : entreprise fictive de démonstration.",
            },
        )
        Company.objects.filter(pk=company.pk).update(status=status)
        company.status = status
        self.companies.append(company)
        return company

    # ----- recruiters and offers -----

    def recruiter(
        self, email, first, last, company: Company | None, offers: int | None = None
    ) -> Recruiter:
        user, _ = self.user(email, first, last, Role.RECRUITER)
        recruiter, _ = Recruiter.objects.get_or_create(
            user=user, defaults={"company": company}
        )
        # Some recruiters have offers, some none yet
        count = (
            offers
            if offers is not None
            else (self.rng.randint(1, 6) if self.rng.random() < 0.65 else 0)
        )
        for number in range(count):
            self.offer(
                recruiter, number, inactive=offers is None and self.rng.random() < 0.15
            )
        return recruiter

    def offer(self, recruiter: Recruiter, number: int, inactive=False) -> Offer:
        title, category, skills = self.rng.choice(POSITIONS)
        contract = self.rng.choice(list(ContractType))
        offer, _ = Offer.objects.get_or_create(
            recruiter=recruiter,
            title=f"{title} ({contract.label}) n°{number + 1}",
            defaults={
                "description": f"Rejoignez l'équipe en tant que {title.lower()}. Missions variées, équipe "
                "bienveillante, offre fictive de démonstration.",
                "requirements": skills,
                "category": category,
                "contract_type": contract.value,
                "duration": self.rng.choice(["6 mois", "12 mois", "24 mois", ""]),
                "start_date": date.today() + timedelta(days=self.rng.randint(10, 200)),
                "location": self.rng.choice(CITIES),
                "is_active": not inactive,
            },
        )
        self.offers.append(offer)
        return offer

    # ----- managers -----

    def make_managers(self):
        for school in self.schools.values():
            self.seed(f"managers-{school.name}")
            # Validated schools have more managers; the others may have none yet
            count = (
                self.rng.randint(1, 3)
                if school.status == ReviewStatus.VALIDATED
                else self.rng.randint(0, 1)
            )
            for _ in range(count):
                first, last = self.person()
                email = f"{slug(first)}.{slug(last)}.{slug(school.name)[:6]}@{DOMAIN}"
                user, _ = self.user(
                    email, first, last, Role.MANAGER, **self.suspended()
                )
                SchoolManager.objects.get_or_create(
                    user=user, defaults={"school": school}
                )
        for number in range(1, 4):
            self.seed(f"manager-without-school-{number}")
            first, last = self.person()
            user, _ = self.user(
                f"sans.ecole{number}@{DOMAIN}", first, last, Role.MANAGER
            )
            SchoolManager.objects.get_or_create(user=user)

    # ----- students -----

    def student(
        self, user: User, *, searching: bool, school: School | None = None,
        request: SchoolRequestStatus | None = None, request_school: School | None = None,
        cv: bool | None = None,
    ) -> Student:  # fmt: skip
        self.seed(f"student-{user.email}")
        student, created = Student.objects.get_or_create(user=user)
        if not created:
            return student
        student.subscription = (
            StudentSubscription.PREMIUM
            if self.rng.random() < 0.15
            else StudentSubscription.FREE
        )
        student.region = self.rng.choice(CITIES)
        student.school = school
        if searching:
            position, category, skills = self.rng.choice(POSITIONS)
            student.desired_position = position
            student.category = category
            student.skills = skills
            student.study_degree = self.rng.choice(list(StudyDegree))
            student.education = "Formation en " + position.split()[-1].lower()
            student.experience_level = self.rng.choice([0, 0, 3, 6, 12, 24])
            student.description = f"Étudiant à la recherche d'une alternance comme {position.lower()}, motivé et disponible."
            student.available_to = date.today() + timedelta(
                days=self.rng.randint(120, 500)
            )
        else:
            # Not looking: a nearly empty profile
            student.skills = self.rng.choice(["", "", "Excel, Word"])
        has_cv = searching if cv is None else cv
        if has_cv:
            name = f"{user.first_name} {user.last_name}"
            student.resume.save(
                f"CV_{slug(name)}.pdf",
                ContentFile(demoResume(f"CV de demonstration - {slug(name)}")),
                save=False,
            )
            student.resume_updated_at = self.now
        student.save()
        # available_from is automatic: it starts on the day of the signup
        Student.objects.filter(pk=student.pk).update(
            available_from=user.date_joined.date()
        )
        if request is not None:
            SchoolRequest.objects.get_or_create(
                student=student, defaults={"school": request_school, "status": request}
            )
        if searching:
            self.active_students.append(student)
        return student

    def make_students(self):
        for number in range(1, self.students_count + 1):
            self.seed(f"new-student-{number}")
            first, last = self.person()
            user, created = self.user(
                f"{slug(first)}.{slug(last)}{number}@{DOMAIN}",
                first,
                last,
                Role.STUDENT,
                **self.suspended(),
            )
            if not created:
                continue
            roll = self.rng.random()
            school = request = request_school = None
            if roll < 0.45:
                school, request = (
                    self.rng.choice(self.validated_schools),
                    SchoolRequestStatus.ACCEPTED,
                )
                request_school = school
            elif roll < 0.60:
                request, request_school = (
                    SchoolRequestStatus.PENDING,
                    self.rng.choice(self.validated_schools),
                )
            elif roll < 0.65:
                request, request_school = (
                    SchoolRequestStatus.REFUSED,
                    self.rng.choice(self.validated_schools),
                )
            self.student(
                user,
                searching=self.rng.random() < 0.6,
                school=school,
                request=request,
                request_school=request_school,
            )

    # ----- applications -----

    def apply(self, student: Student, offer: Offer, status: ApplicationStatus):
        self.seed(f"apply-{student.pk}-{offer.pk}")
        if JobApplication.objects.filter(student=student, offer=offer).exists():
            return
        application = JobApplication.objects.create(
            student=student, offer=offer, message="Candidature de démonstration."
        )
        if status == ApplicationStatus.DRAFT:
            return
        if not student.resume:
            return  # a draft only: sending needs a CV
        application.submit()
        application.status = status
        if status in (ApplicationStatus.ACCEPTED, ApplicationStatus.REFUSED):
            application.decision_message = "Décision de démonstration."
        application.save()
        days = self.rng.randint(0, 45)
        JobApplication.objects.filter(pk=application.pk).update(
            submitted_at=self.now - timedelta(days=days)
        )

    def make_applications(self):
        statuses = [status for status, weight in STATUS_WEIGHTS for _ in range(weight)]
        # Offers of validated companies, active ones; a third of them stay without candidates
        open_offers = [
            o
            for o in self.offers
            if o.is_active
            and o.recruiter.company
            and o.recruiter.company.status == ReviewStatus.VALIDATED
        ]
        popular = [o for index, o in enumerate(open_offers) if index % 3 != 2]
        for student in self.active_students:
            self.seed(f"applications-{student.pk}")
            if not popular:
                break
            for offer in self.rng.sample(
                popular, min(len(popular), self.rng.randint(0, 4))
            ):
                self.apply(student, offer, self.rng.choice(statuses))

    # ----- accounts to log in with -----

    def make_demo_accounts(self):
        for number, (first, last) in enumerate(
            [("Alex", "Admin"), ("Sam", "Admin")], start=1
        ):
            email = f"admin{'' if number == 1 else number}@{DOMAIN}"
            user, created = self.user(email, first, last, Role.ADMIN)
            if created:
                User.objects.filter(pk=user.pk).update(is_superuser=True)

        # Recruiters: validated company with offers and candidates, pending company without
        # offers, validated company with offers nobody applied to
        main = self.company("Démo Corp", "70000000000001", ReviewStatus.VALIDATED)
        self.company("Démo Startup", "70000000000002", ReviewStatus.PENDING)
        studio = self.company("Démo Studio", "70000000000003", ReviewStatus.VALIDATED)
        recruiter = self.recruiter(
            f"recruteur@{DOMAIN}", "Rita", "Recrute", main, offers=6
        )
        self.recruiter(
            f"recruteur2@{DOMAIN}",
            "Rémy",
            "Débute",
            Company.objects.get(name="Démo Startup"),
            offers=0,
        )
        self.recruiter(f"recruteur3@{DOMAIN}", "Roxane", "Studio", studio, offers=2)
        # One closed offer
        last = Offer.objects.filter(recruiter=recruiter).order_by("-pk").first()
        Offer.objects.filter(pk=last.pk).update(is_active=False)

        # Managers: validated, pending and refused school
        for number, (name, first) in enumerate(
            [
                ("Université de Démonstration", "Manon"),
                ("École du Numérique Bordeaux", "Mehdi"),
                ("École Fantôme", "Maya"),
            ],
            start=1,
        ):
            user, _ = self.user(
                f"manager{'' if number == 1 else number}@{DOMAIN}",
                first,
                "Manage",
                Role.MANAGER,
            )
            SchoolManager.objects.get_or_create(
                user=user, defaults={"school": self.schools[name]}
            )

        # Students: searching, in a school, with applications at every step; not searching and
        # without school; waiting for the school to accept the request
        school = self.schools["Université de Démonstration"]
        lea, _ = self.user(f"etudiant@{DOMAIN}", "Léa", "Étudie", Role.STUDENT)
        lea_student = self.student(
            lea,
            searching=True,
            school=school,
            request=SchoolRequestStatus.ACCEPTED,
            request_school=school,
            cv=True,
        )
        for offer, status in zip(
            Offer.objects.filter(recruiter=recruiter).order_by("pk"),
            [s for s, _ in STATUS_WEIGHTS],
            strict=False,
        ):
            self.apply(lea_student, offer, status)
        other = (
            Offer.objects.exclude(recruiter=recruiter).filter(is_active=True).first()
        )
        if other:
            SavedOffer.objects.get_or_create(student=lea_student, offer=other)
        user, _ = self.user(f"etudiant2@{DOMAIN}", "Eliott", "Inactif", Role.STUDENT)
        self.student(user, searching=False, cv=False)
        user, _ = self.user(f"etudiant3@{DOMAIN}", "Elsa", "Attend", Role.STUDENT)
        self.student(
            user,
            searching=True,
            request=SchoolRequestStatus.PENDING,
            request_school=school,
        )

        # The main recruiter has many candidates, a shortlist and an excluded student
        offers = list(
            Offer.objects.filter(recruiter=recruiter, is_active=True).order_by("pk")
        )
        statuses = [status for status, _ in STATUS_WEIGHTS]
        for index, student in enumerate(self.active_students[:40]):
            self.apply(
                student, offers[index % len(offers)], statuses[index % len(statuses)]
            )
        for student in self.active_students[40:43]:
            Shortlist.objects.get_or_create(
                recruiter=recruiter, student=student, defaults={"offer": offers[0]}
            )
        if len(self.active_students) > 43:
            Exclusion.objects.get_or_create(
                recruiter=recruiter, student=self.active_students[43]
            )

    # ----- bulk of the other recruiters -----

    def make_recruiters(self):
        for company in list(self.companies):
            count = (
                1
                if company.status != ReviewStatus.VALIDATED
                else self.rng.randint(1, 3)
            )
            for number in range(count):
                self.seed(f"recruiter-{company.name}-{number}")
                first, last = self.person()
                self.recruiter(
                    f"{slug(first)}.{slug(last)}.{slug(company.name)[:8]}{number}@{DOMAIN}",
                    first,
                    last,
                    company,
                )
        for number in range(1, 4):
            self.seed(f"recruiter-without-company-{number}")
            first, last = self.person()
            self.recruiter(
                f"sans.entreprise{number}@{DOMAIN}", first, last, None, offers=0
            )


class Command(BaseCommand):
    help = (
        "Remplit la base de centaines de comptes variés (étudiants, recruteurs, managers, "
        "administrateurs) pour essayer toute l'application (site de démonstration, faux comptes seulement)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--students",
            type=int,
            default=300,
            help="Nombre d'étudiants générés (300 par défaut)",
        )
        parser.add_argument(
            "--with-demo",
            action="store_true",
            help="Lance aussi seed_demo (annuaire et conversations)",
        )

    # Each application sent notifies its recruiter by e-mail, once the transaction is
    # committed: no e-mail is printed for a seed, so the setting covers the commit too
    @override_settings(
        MAILERS={"default": {"BACKEND": "django.core.mail.backends.dummy.EmailBackend"}}
    )
    def handle(self, *args, **options):
        with transaction.atomic():
            self.seed_all(options)

    def seed_all(self, options):
        if options["students"] < 50:
            raise CommandError("Au moins 50 étudiants, pour remplir les listes.")
        if options["with_demo"]:
            call_command("seed_demo", stdout=self.stdout)
        seeder = Seeder(options["students"], self.stdout)
        seeder.make_schools()
        seeder.make_companies()
        seeder.make_managers()
        seeder.make_recruiters()
        seeder.make_students()
        seeder.make_applications()
        seeder.make_demo_accounts()
        self.stdout.write(
            self.style.SUCCESS(
                f"{User.objects.count()} comptes, {Company.objects.count()} entreprises, "
                f"{School.objects.count()} écoles, {Offer.objects.count()} offres, "
                f"{JobApplication.objects.count()} candidatures."
            )
        )
        self.stdout.write(f"Mot de passe de tous les comptes : {PASSWORD}")
        self.stdout.write(
            "Connexion : etudiant@ / etudiant2@ / etudiant3@, recruteur@ / recruteur2@ / recruteur3@, "
            f"manager@ / manager2@ / manager3@ (@{DOMAIN}), admin@{DOMAIN} (page /administration)."
        )
