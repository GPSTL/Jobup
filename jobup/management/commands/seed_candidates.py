# Demo data of the "Candidats" tab (JOB-035), for local use: a new database has
# no student, so without it a recruiter sees no candidate.
from typing import Any

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from jobup.models import (
    Company,
    JobApplication,
    JobCategory,
    Offer,
    Recruiter,
    Role,
    School,
    Student,
    StudyDegree,
    User,
)

# The two students of the mockups, and one who filled in almost nothing
CANDIDATES: list[dict[str, Any]] = [
    {
        "email": "lucas.martin@demo.jobup.fr",
        "first_name": "Lucas",
        "last_name": "Martin",
        "school": "Université Paris Nanterre",
        "study_degree": StudyDegree.MASTER1,
        "desired_position": "Développeur back-end",
        "experience_level": 12,
        "region": "Paris",
        "skills": "Java, Spring Boot, Angular, SQL, Docker, Git",
        "description": "Étudiant en Master MIAGE, je recherche une alternance de 12 mois "
        "en développement back-end (Java / Spring Boot). Disponible dès novembre 2026, à Paris.",
        "resume": "CV_Lucas_Martin.pdf",
    },
    {
        "email": "sarah.benali@demo.jobup.fr",
        "first_name": "Sarah",
        "last_name": "Benali",
        "school": "IUT Montreuil",
        "study_degree": StudyDegree.LICENCE3,
        "desired_position": "Développeuse front-end",
        "experience_level": 4,
        "region": "Montreuil",
        "skills": "Angular, TypeScript, Accessibilité, Figma",
        "description": "Passionnée de front-end (Angular, accessibilité), je cherche une "
        "alternance de 12 mois en développement web. Disponible dès octobre 2026.",
        "resume": "CV_Sarah_Benali.pdf",
    },
    {
        "email": "ines.diallo@demo.jobup.fr",
        "first_name": "Inès",
        "last_name": "Diallo",
        "school": None,
        "study_degree": None,
        "desired_position": "",
        "experience_level": 0,
        "region": "Lyon",
        "skills": "Python, Django, SQL",
        "description": "Intéressée par le développement back-end, je souhaite approfondir "
        "mes compétences en API et en bases de données pendant une alternance.",
        "resume": None,
    },
]


def demoResume(text: str) -> bytes:
    # One-page PDF showing `text` (ASCII), so that the downloaded CV opens
    stream = f"BT /F1 20 Tf 72 770 Td ({text}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    pdf = b"%PDF-1.4\n"
    offsets = []
    for number, body in enumerate(objects, 1):
        offsets.append(len(pdf))
        pdf += b"%d 0 obj\n%s\nendobj\n" % (number, body)
    table = len(pdf)
    pdf += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    pdf += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    pdf += b"trailer\n<< /Size %d /Root 1 0 R >>\n" % (len(objects) + 1)
    return pdf + b"startxref\n%d\n%%%%EOF\n" % table


def demoStudent(data: dict[str, Any]) -> Student:
    user = User.objects.filter(email=data["email"]).first()
    if user is None:
        user = User(
            email=data["email"],
            first_name=data["first_name"],
            last_name=data["last_name"],
            role=Role.STUDENT,
        )
        # Demo accounts: nobody can log in with them
        user.set_unusable_password()
        user.save()
    student, _ = Student.objects.get_or_create(user=user)
    school = data["school"]
    student.school = School.objects.get_or_create(name=school)[0] if school else None
    student.study_degree = data["study_degree"]
    # Criteria of the filters (JOB-036)
    student.desired_position = data["desired_position"]
    student.experience_level = data["experience_level"]
    student.region = data["region"]
    student.skills = data["skills"]
    student.description = data["description"]
    if data["resume"] and not student.resume:
        name = f"{data['first_name']} {data['last_name']}"
        content = ContentFile(demoResume(f"CV de demonstration - {name}"))
        student.resume.save(data["resume"], content, save=False)
    student.save()
    return student


class Command(BaseCommand):
    help = (
        "Crée les candidats de démonstration de JOB-035 et une candidature de Lucas "
        "Martin envoyée au recruteur donné (usage local)."
    )

    def add_arguments(self, parser):
        parser.add_argument("email", help="Adresse d'un compte recruteur existant")

    @transaction.atomic
    def handle(self, *args, **options):
        user = User.objects.filter(
            email__iexact=options["email"], role=Role.RECRUITER
        ).first()
        if user is None:
            raise CommandError("Aucun compte recruteur ne correspond à cette adresse.")
        # Created from the last to the first: the cards come newest first, so in
        # the order of the mockups
        students = [demoStudent(data) for data in reversed(CANDIDATES)]
        lucas = students[-1]

        # Exchange history of Lucas Martin: an application sent to an offer of this
        # recruiter. Accounts created by shell, or before signup made the Recruiter
        # row, have none: one is created then, with a demo company.
        recruiter = Recruiter.objects.filter(user=user).first()
        if recruiter is None:
            company, _ = Company.objects.get_or_create(
                name="Entreprise de démonstration", defaults={"siret": "00000000000000"}
            )
            recruiter = Recruiter.objects.create(user=user, company=company)
        offer, _ = Offer.objects.get_or_create(
            recruiter=recruiter,
            title="[Démo JOB-035] Développeur Java en alternance",
            defaults={
                "description": "Offre de démonstration pour l’historique des échanges.",
                "category": JobCategory.COMPUTER_SCIENCE,
            },
        )
        application, _ = JobApplication.objects.get_or_create(
            student=lucas, offer=offer
        )
        if application.is_draft:
            application.submit()
        self.stdout.write(
            self.style.SUCCESS(f"{len(students)} candidats de démonstration prêts.")
        )
