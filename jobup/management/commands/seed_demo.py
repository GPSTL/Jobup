# Complete demo of the project, for local use: a recruiter account you can log in with, its
# candidates, offers, applications, shortlist, exclusions and conversations, including a message
# with an attachment (JOB-043). Builds on the candidates of seed_candidates (JOB-035).
# Remplit aussi l'annuaire des entreprises (JOB-021) : entreprises, recruteurs et offres.
import io
import zipfile
from datetime import datetime, time, timedelta
from typing import Any

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from jobup.management.commands.seed_candidates import (
    CANDIDATES,
    demoResume,
    demoStudent,
)
from jobup.models import (
    ApplicationStatus,
    Company,
    Contract,
    ContractStage,
    Conversation,
    Exclusion,
    JobApplication,
    JobCategory,
    Message,
    MessageAttachment,
    Offer,
    Recruiter,
    Role,
    School,
    SchoolManager,
    SchoolRequest,
    Shortlist,
    Student,
    StudyDegree,
    User,
)

PASSWORD = "Demo1234"
RECRUITER_EMAIL = "recruteur@demo.jobup.fr"
STUDENT_EMAIL = "lucas.martin@demo.jobup.fr"
MANAGER_EMAIL = "ecole@demo.jobup.fr"

# More students than the mockups, to fill the filters and the lists
EXTRA_CANDIDATES: list[dict[str, Any]] = [
    {
        "email": "sophie.bernard@demo.jobup.fr",
        "first_name": "Sophie",
        "last_name": "Bernard",
        "school": "Université Paris Nanterre",
        "study_degree": StudyDegree.MASTER2,
        "desired_position": "Data analyst",
        "experience_level": 18,
        "region": "Paris",
        "skills": "Python, SQL, Power BI, Pandas",
        "description": "En Master 2 d'informatique décisionnelle, je cherche une alternance "
        "en analyse de données, disponible dès janvier 2027.",
        "resume": "CV_Sophie_Bernard.pdf",
    },
    {
        "email": "emma.garcia@demo.jobup.fr",
        "first_name": "Emma",
        "last_name": "Garcia",
        "school": "IUT Montreuil",
        "study_degree": StudyDegree.LICENCE2,
        "desired_position": "Développeuse mobile",
        "experience_level": 6,
        "region": "Montreuil",
        "skills": "Kotlin, Swift, Flutter, Git",
        "description": "Je prépare une licence professionnelle et souhaite une alternance "
        "en développement d'applications mobiles.",
        "resume": "CV_Emma_Garcia.pdf",
    },
    {
        "email": "hugo.lefevre@demo.jobup.fr",
        "first_name": "Hugo",
        "last_name": "Lefèvre",
        "school": "Université Lyon 1",
        "study_degree": StudyDegree.LICENCE3,
        "desired_position": "Administrateur systèmes",
        "experience_level": 10,
        "region": "Lyon",
        "skills": "Linux, Ansible, Docker, Réseaux",
        "description": "Profil systèmes et réseaux, à la recherche d'une alternance en infrastructure.",
        "resume": "CV_Hugo_Lefevre.pdf",
    },
]


# Annuaire des entreprises (JOB-021) : (nom, siret, secteur, ville, effectif, site, présentation,
# offres [(titre, catégorie, en cours)]). Un recruteur de démo par entreprise qui a des offres.
COMPANIES: list[tuple[Any, ...]] = [
    (
        "Atelier Studio",
        "90000000000001",
        JobCategory.COMPUTER_SCIENCE,
        "Paris",
        70,
        "https://atelier-studio.fr",
        "Atelier Studio conçoit des applications web et mobiles pour des clients du retail et de la culture. "
        "L'équipe de 70 personnes accueille chaque année une dizaine d'alternants en développement, design et gestion de projet, avec un tuteur dédié.",
        [
            ("Développeur Java en alternance", JobCategory.COMPUTER_SCIENCE, True),
            ("Développeur Angular", JobCategory.COMPUTER_SCIENCE, True),
            ("Chef de projet digital junior", JobCategory.PROJECT_MANAGEMENT, True),
            ("Stage design UI (pourvu)", JobCategory.DESIGN, False),
        ],
    ),
    (
        "Doctolib",
        "90000000000002",
        JobCategory.HEALTH,
        "Paris",
        2800,
        "https://www.doctolib.fr",
        "Faciliter l'accès aux soins et accompagner les professionnels de santé.",
        [
            ("Alternance développeur back-end", JobCategory.COMPUTER_SCIENCE, True),
            ("Alternance chargé de relation praticiens", JobCategory.SALES_BD, True),
        ],
    ),
    (
        "Back Market",
        "90000000000003",
        JobCategory.ENERGY_ENVIRONMENT,
        "Paris",
        700,
        "https://www.backmarket.fr",
        "Donner une seconde vie aux appareils et une autre voie à la technologie.",
        [("Alternance data analyst", JobCategory.DATA_AI, True)],
    ),
    (
        "Qonto",
        "90000000000004",
        JobCategory.FINANCE,
        "Paris",
        1600,
        "https://qonto.com",
        "Simplifier la gestion financière des indépendants et des entreprises.",
        [
            ("Alternance contrôle de gestion", JobCategory.FINANCE, True),
            ("Alternance product designer", JobCategory.DESIGN, True),
        ],
    ),
    (
        "BlaBlaCar",
        "90000000000005",
        JobCategory.SUPPLY_CHAIN_LOGISTICS,
        "Paris",
        800,
        "https://www.blablacar.fr",
        "Connecter les voyageurs pour une mobilité plus accessible et partagée.",
        [],
    ),
    (
        "Alan",
        "90000000000006",
        JobCategory.BANKING_INSURANCE,
        "Paris",
        600,
        "https://alan.com",
        "Prendre soin de la santé et du bien-être, simplement et au quotidien.",
        [("Alternance chargé de clientèle", JobCategory.BANKING_INSURANCE, True)],
    ),
    (
        "Mistral AI",
        "90000000000007",
        JobCategory.DATA_AI,
        "Paris",
        250,
        "https://mistral.ai",
        "Créer une intelligence artificielle ouverte, utile et accessible à tous.",
        [("Alternance ingénieur machine learning", JobCategory.DATA_AI, True)],
    ),
    (
        "Lumen Conseil",
        "90000000000008",
        JobCategory.CONSULTING,
        "Lyon",
        45,
        "",
        "Cabinet de conseil en stratégie pour les PME de la région lyonnaise.",
        [("Alternance consultant junior", JobCategory.CONSULTING, True)],
    ),
    (
        "Verdi Énergie",
        "90000000000009",
        JobCategory.ENERGY_ENVIRONMENT,
        "Nantes",
        120,
        "https://verdi-energie.example",
        "Installation et maintenance de panneaux solaires pour les particuliers et les collectivités.",
        [("Alternance technicien photovoltaïque", JobCategory.ENGINEERING, True)],
    ),
    # Fiche volontairement incomplète : affichage sans ville, effectif, site ni présentation
    ("Pixel & Co", "90000000000010", JobCategory.DESIGN, "", None, "", "", []),
]


def demoDocx(text: str) -> bytes:
    # Minimal Word document showing `text`, which Word and LibreOffice open
    types = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        "</Relationships>"
    )
    document = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>"
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("word/document.xml", document)
    return buffer.getvalue()


def demoUser(email: str, first_name: str, last_name: str, role: Role) -> User:
    user = User.objects.filter(email=email).first()
    if user is None:
        user = User(email=email, first_name=first_name, last_name=last_name, role=role)
    user.role = role
    # The demo accounts you log in with all share the same password
    user.set_password(PASSWORD)
    user.save()
    return user


def at(day: datetime, hour: int, minute: int) -> datetime:
    return timezone.make_aware(datetime.combine(day.date(), time(hour, minute)))


def say(
    conversation: Conversation,
    sender: User,
    when: datetime,
    body: str = "",
    file: tuple[str, bytes] | None = None,
) -> Message:
    message = Message.objects.create(
        conversation=conversation, sender=sender, body=body
    )
    if file is not None:
        name, content = file
        MessageAttachment.store(message, SimpleUploadedFile(name, content), name)
    # created_at is set by the database on creation: dated afterwards
    Message.objects.filter(pk=message.pk).update(created_at=when)
    return message


class Command(BaseCommand):
    help = (
        "Crée un jeu de données de démonstration complet et un compte recruteur "
        f"({RECRUITER_EMAIL} / {PASSWORD}) pour parcourir toutes les fonctionnalités "
        "(usage local, relançable sans doublons)."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        # Known passwords: never on a real deployment
        if not settings.DEBUG:
            raise CommandError("Cette commande est réservée à l'usage local (DEBUG).")

        company, _ = Company.objects.get_or_create(
            name="Acme Tech", defaults={"siret": "12345678901234"}
        )
        recruiter_user = demoUser(RECRUITER_EMAIL, "Léa", "Martin", Role.RECRUITER)
        recruiter, _ = Recruiter.objects.get_or_create(
            user=recruiter_user, defaults={"company": company}
        )

        # Students: the three of seed_candidates and three more. Created from the last to
        # the first, so that the cards come in the order of the list.
        everyone = CANDIDATES + EXTRA_CANDIDATES
        students = {data["email"]: demoStudent(data) for data in reversed(everyone)}
        for data in EXTRA_CANDIDATES:
            student = students[data["email"]]
            if not student.resume:
                name = f"{data['first_name']} {data['last_name']}"
                student.resume.save(
                    data["resume"],
                    SimpleUploadedFile(
                        data["resume"], demoResume(f"CV de demonstration - {name}")
                    ),
                )
        lucas = students[STUDENT_EMAIL]
        sophie = students["sophie.bernard@demo.jobup.fr"]
        emma = students["emma.garcia@demo.jobup.fr"]
        sarah = students["sarah.benali@demo.jobup.fr"]
        hugo = students["hugo.lefevre@demo.jobup.fr"]
        # Lucas can be logged in, to see the student side of the same exchanges
        demoUser(STUDENT_EMAIL, "Lucas", "Martin", Role.STUDENT)

        # Offers and applications (exchange history of the profiles)
        java, _ = Offer.objects.get_or_create(
            recruiter=recruiter,
            title="Développeur Java en alternance",
            defaults={
                "description": "Rejoignez l'équipe back-end pour développer nos API en "
                "Java / Spring Boot. Alternance de 12 mois à Paris.",
                "requirements": "Java, Spring Boot, SQL",
                "category": JobCategory.COMPUTER_SCIENCE,
            },
        )
        data_offer, _ = Offer.objects.get_or_create(
            recruiter=recruiter,
            title="Data analyst en alternance",
            defaults={
                "description": "Analysez les usages de nos clients et construisez les "
                "tableaux de bord de l'équipe produit.",
                "requirements": "Python, SQL, Power BI",
                "category": JobCategory.DATA_AI,
            },
        )
        Offer.objects.get_or_create(
            recruiter=recruiter,
            title="Développeur front-end accessibilité",
            defaults={
                "description": "Faites de notre interface une référence d'accessibilité.",
                "requirements": "Angular, TypeScript",
                "category": JobCategory.COMPUTER_SCIENCE,
                "is_active": False,
            },
        )
        for student, offer, status in (
            (lucas, java, ApplicationStatus.IN_REVIEW),
            (sophie, data_offer, ApplicationStatus.SUBMITTED),
            (sarah, java, ApplicationStatus.READ),
        ):
            application, created = JobApplication.objects.get_or_create(
                student=student,
                offer=offer,
                defaults={
                    "message": "Bonjour, votre offre correspond exactement à mon projet."
                },
            )
            if application.is_draft:
                application.submit()
            if created:
                JobApplication.objects.filter(pk=application.pk).update(status=status)
        # A draft, which the recruiter never sees
        JobApplication.objects.get_or_create(student=emma, offer=java)

        # Shortlist and exclusions of the recruiter
        Shortlist.objects.get_or_create(
            recruiter=recruiter, student=lucas, defaults={"offer": java}
        )
        Shortlist.objects.get_or_create(
            recruiter=recruiter, student=sophie, defaults={"offer": data_offer}
        )
        Exclusion.objects.get_or_create(recruiter=recruiter, student=hugo)

        # Conversations: the ones of the mockup "Messages", dated from today
        today = timezone.localtime()
        self.conversations(recruiter, recruiter_user, lucas, sophie, emma, today)
        self.school(
            lucas, sophie, students["ines.diallo@demo.jobup.fr"], data_offer, today
        )
        self.companies()

        self.stdout.write(
            self.style.SUCCESS(
                f"Démo prête. Recruteur : {RECRUITER_EMAIL} / {PASSWORD} — "
                f"étudiant : {STUDENT_EMAIL} / {PASSWORD} — "
                f"employé d'école : {MANAGER_EMAIL} / {PASSWORD}"
            )
        )

    def conversations(
        self,
        recruiter: Recruiter,
        me: User,
        lucas: Student,
        sophie: Student,
        emma: Student,
        today: datetime,
    ) -> None:
        # Lucas: an interview arranged, then the convocation sent as a file alone
        chat, created = Conversation.objects.get_or_create(
            student=lucas, recruiter=recruiter
        )
        if created:
            say(
                chat,
                lucas.user,
                at(today, 10, 24),
                "Bonjour, merci pour votre retour ! Je suis disponible mardi ou jeudi pour un entretien.",
            )
            say(
                chat,
                me,
                at(today, 10, 30),
                "Parfait, retenons mardi 21 octobre à 14 h. Je vous envoie la convocation.",
            )
            say(
                chat,
                me,
                at(today, 10, 32),
                file=(
                    "Convocation_entretien.pdf",
                    demoResume("Convocation - entretien du mardi 21 octobre a 14 h"),
                ),
            )

        # Sophie: a job description sent as a Word document, with a text
        chat, created = Conversation.objects.get_or_create(
            student=sophie, recruiter=recruiter
        )
        if created:
            yesterday = today - timedelta(days=1)
            say(
                chat,
                me,
                at(yesterday, 16, 5),
                "Bonjour Sophie, voici la fiche de poste détaillée avant notre échange.",
                (
                    "Fiche_de_poste.docx",
                    demoDocx("Fiche de poste - Data analyst en alternance"),
                ),
            )
            say(chat, sophie.user, at(yesterday, 17, 40), "Merci pour votre retour !")

        # Emma: a message of her own, a few days ago, still unanswered
        chat, created = Conversation.objects.get_or_create(
            student=emma, recruiter=recruiter
        )
        if created:
            say(
                chat,
                emma.user,
                at(today - timedelta(days=3), 9, 15),
                "Je suis disponible jeudi.",
            )

    def school(
        self,
        lucas: Student,
        sophie: Student,
        ines: Student,
        offer: Offer,
        today: datetime,
    ) -> None:
        # A conversation with his school, for the student side
        school, _ = School.objects.get_or_create(name="Université Paris Nanterre")
        manager_user = demoUser(MANAGER_EMAIL, "Inès", "Roux", Role.MANAGER)
        manager, _ = SchoolManager.objects.get_or_create(
            user=manager_user, defaults={"school": school}
        )
        chat, created = Conversation.objects.get_or_create(
            student=lucas, school_manager=manager
        )
        if created:
            say(
                chat,
                manager_user,
                at(today - timedelta(days=5), 11, 0),
                "Bonjour Lucas, n'oubliez pas de me transmettre votre convention d'alternance.",
            )
            say(
                chat,
                lucas.user,
                at(today - timedelta(days=5), 14, 20),
                "Bonjour, je vous l'envoie dès que l'entreprise l'a signée.",
            )

        # Tracking: a contract validated by the school (Lucas), one just deposited (Sophie)
        # and a student asking to join the school (Inès)
        for student, stage, days in (
            (lucas, ContractStage.VALIDATED, 6),
            (sophie, ContractStage.DEPOSITED, 2),
        ):
            application, _ = JobApplication.objects.get_or_create(
                student=student, offer=offer
            )
            if application.is_draft:
                application.submit()
            JobApplication.objects.filter(pk=application.pk).update(
                status=ApplicationStatus.ACCEPTED
            )
            deposited = today - timedelta(days=days)
            Contract.objects.get_or_create(
                application=application,
                defaults={
                    "school": school,
                    "company": offer.recruiter.company,
                    "student": student,
                    "stage": stage,
                    "deposited_at": deposited,
                    "validated_at": deposited + timedelta(days=2)
                    if stage == ContractStage.VALIDATED
                    else None,
                },
            )
        SchoolRequest.objects.get_or_create(student=ines, defaults={"school": school})

    def companies(self) -> None:
        # Annuaire des entreprises (JOB-021) : relançable sans doublons
        for (
            name,
            siret,
            sector,
            city,
            employees,
            website,
            description,
            offers,
        ) in COMPANIES:
            company, _ = Company.objects.update_or_create(
                siret=siret,
                defaults={
                    "name": name,
                    "sector": sector,
                    "city": city,
                    "employees": employees,
                    "website": website,
                    "description": description,
                },
            )
            if not offers:
                continue
            # Un recruteur de démo par entreprise, pour rattacher ses offres
            user = demoUser(
                f"recrutement+{siret[-2:]}@demo.jobup",
                name[:32],
                "Démo",
                Role.RECRUITER,
            )
            recruiter, _ = Recruiter.objects.get_or_create(
                user=user, defaults={"company": company}
            )
            for title, category, active in offers:
                Offer.objects.update_or_create(
                    recruiter=recruiter,
                    title=title,
                    defaults={
                        "description": f"{title} chez {name}.",
                        "category": category,
                        "is_active": active,
                    },
                )
