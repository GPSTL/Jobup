"""Add varied local candidates without changing existing profiles or recruiter decisions."""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from jobup.models import Role, Student, StudyDegree, User

# Fictional profiles for browsing a deck larger than the five recommendations.
PROFILES = [
    ("Amine", "Boukari", "Développeur Python", "Paris", "Python, Django, SQL", 12),
    ("Clara", "Moreau", "Développeuse React", "Lyon", "React, TypeScript, CSS", 8),
    ("Yanis", "Petit", "Analyste de données", "Lille", "Python, SQL, Tableau", 6),
    (
        "Lina",
        "Robert",
        "Designer UX",
        "Bordeaux",
        "Figma, Prototypage, Accessibilité",
        4,
    ),
    (
        "Adam",
        "Laurent",
        "Assistant marketing",
        "Nantes",
        "SEO, Rédaction, Analytics",
        3,
    ),
    (
        "Jade",
        "Simon",
        "Chargée de communication",
        "Toulouse",
        "Communication, Canva, Réseaux sociaux",
        6,
    ),
    (
        "Noah",
        "Michel",
        "Assistant comptable",
        "Rennes",
        "Excel, Comptabilité, Gestion",
        10,
    ),
    (
        "Manon",
        "Leroy",
        "Assistante RH",
        "Strasbourg",
        "Recrutement, Paie, Formation",
        5,
    ),
    ("Rayan", "Roux", "Technicien réseaux", "Marseille", "Linux, Cisco, Réseaux", 12),
    ("Eva", "David", "Développeuse Java", "Paris", "Java, Spring Boot, PostgreSQL", 18),
    ("Louis", "Bertrand", "Assistant commercial", "Nice", "Vente, CRM, Négociation", 4),
    (
        "Nora",
        "Vincent",
        "Cheffe de projet junior",
        "Montpellier",
        "Agile, Scrum, Planification",
        9,
    ),
    (
        "Ilyes",
        "Fournier",
        "Technicien maintenance",
        "Grenoble",
        "Maintenance, Électricité, Diagnostic",
        8,
    ),
    (
        "Alice",
        "Girard",
        "Assistante logistique",
        "Rouen",
        "Logistique, Stocks, Excel",
        6,
    ),
    ("Sami", "Andre", "Développeur mobile", "Montreuil", "Kotlin, Flutter, Git", 10),
]


class Command(BaseCommand):
    help = (
        "Ajoute 15 profils fictifs pour tester les cartes et recommandations en local."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Commande réservée au développement local (DEBUG=True).")
        created = 0
        for first, last, position, city, skills, months in PROFILES:
            email = f"candidat.{first.lower()}.{last.lower()}@demo.jobup.fr"
            # Repeated runs preserve existing profiles and keep/exclude decisions.
            if User.objects.filter(email=email).exists():
                continue
            user = User(
                email=email, first_name=first, last_name=last, role=Role.STUDENT
            )
            user.set_unusable_password()
            user.save()
            Student.objects.create(
                user=user,
                desired_position=position,
                region=city,
                skills=skills,
                experience_level=months,
                study_degree=StudyDegree.LICENCE3,
                description=(
                    f"Profil de démonstration : {position.lower()}, à la recherche "
                    f"d’une alternance à {city}. Compétences : {skills}."
                ),
            )
            created += 1
        self.stdout.write(self.style.SUCCESS(f"{created} nouveaux profils créés."))
