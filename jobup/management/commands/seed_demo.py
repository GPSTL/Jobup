# Données de démo pour le développement local (JOB-021) : entreprises, recruteurs et offres.
# `python manage.py seed_demo` ou `make seed` ; relançable sans créer de doublons.
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from jobup.models import Company, JobCategory as C, Offer, Recruiter, Role, User

# Mot de passe commun des comptes recruteurs de démo : uniquement pour le développement local
DEMO_PASSWORD = "Demo12345"

# (nom, siret, secteur, ville, effectif, site, présentation, offres [(titre, catégorie, en cours)])
COMPANIES = [
    ("Atelier Studio", "90000000000001", C.COMPUTER_SCIENCE, "Paris", 70, "https://atelier-studio.fr",
     "Atelier Studio conçoit des applications web et mobiles pour des clients du retail et de la culture. "
     "L'équipe de 70 personnes accueille chaque année une dizaine d'alternants en développement, design et gestion de projet, avec un tuteur dédié.",
     [("Développeur Java en alternance", C.COMPUTER_SCIENCE, True),
      ("Développeur Angular", C.COMPUTER_SCIENCE, True),
      ("Chef de projet digital junior", C.PROJECT_MANAGEMENT, True),
      ("Stage design UI (pourvu)", C.DESIGN, False)]),
    ("Doctolib", "90000000000002", C.HEALTH, "Paris", 2800, "https://www.doctolib.fr",
     "Faciliter l'accès aux soins et accompagner les professionnels de santé.",
     [("Alternance développeur back-end", C.COMPUTER_SCIENCE, True),
      ("Alternance chargé de relation praticiens", C.SALES_BD, True)]),
    ("Back Market", "90000000000003", C.ENERGY_ENVIRONMENT, "Paris", 700, "https://www.backmarket.fr",
     "Donner une seconde vie aux appareils et une autre voie à la technologie.",
     [("Alternance data analyst", C.DATA_AI, True)]),
    ("Qonto", "90000000000004", C.FINANCE, "Paris", 1600, "https://qonto.com",
     "Simplifier la gestion financière des indépendants et des entreprises.",
     [("Alternance contrôle de gestion", C.FINANCE, True),
      ("Alternance product designer", C.DESIGN, True)]),
    ("BlaBlaCar", "90000000000005", C.SUPPLY_CHAIN_LOGISTICS, "Paris", 800, "https://www.blablacar.fr",
     "Connecter les voyageurs pour une mobilité plus accessible et partagée.", []),
    ("Alan", "90000000000006", C.BANKING_INSURANCE, "Paris", 600, "https://alan.com",
     "Prendre soin de la santé et du bien-être, simplement et au quotidien.",
     [("Alternance chargé de clientèle", C.BANKING_INSURANCE, True)]),
    ("Mistral AI", "90000000000007", C.DATA_AI, "Paris", 250, "https://mistral.ai",
     "Créer une intelligence artificielle ouverte, utile et accessible à tous.",
     [("Alternance ingénieur machine learning", C.DATA_AI, True)]),
    ("Lumen Conseil", "90000000000008", C.CONSULTING, "Lyon", 45, "",
     "Cabinet de conseil en stratégie pour les PME de la région lyonnaise.",
     [("Alternance consultant junior", C.CONSULTING, True)]),
    ("Verdi Énergie", "90000000000009", C.ENERGY_ENVIRONMENT, "Nantes", 120, "https://verdi-energie.example",
     "Installation et maintenance de panneaux solaires pour les particuliers et les collectivités.",
     [("Alternance technicien photovoltaïque", C.ENGINEERING, True)]),
    # Fiche volontairement incomplète : affichage sans ville, effectif, site ni présentation
    ("Pixel & Co", "90000000000010", C.DESIGN, "", None, "", "", []),
]


class Command(BaseCommand):
    help = "Ajoute des entreprises, des recruteurs et des offres de démo (développement local uniquement)."

    @transaction.atomic
    def handle(self, *args, **options):
        # Jamais en production : les comptes de démo ont un mot de passe connu
        if not settings.DEBUG:
            raise CommandError("seed_demo est réservé au développement (DEBUG=True).")

        for name, siret, sector, city, employees, website, description, offers in COMPANIES:
            company, _ = Company.objects.update_or_create(
                siret=siret,
                defaults={"name": name, "sector": sector, "city": city, "employees": employees,
                          "website": website, "description": description},
            )
            if not offers:
                continue

            # Un recruteur de démo par entreprise, pour rattacher ses offres
            email = f"recrutement+{siret[-2:]}@demo.jobup"
            user = User.objects.filter(email=email).first()
            if user is None:
                user = User.objects.create_user(email, DEMO_PASSWORD, last_name="Démo", first_name=name[:32], role=Role.RECRUITER)
            recruiter, _ = Recruiter.objects.get_or_create(user=user, defaults={"company": company})
            for title, category, active in offers:
                Offer.objects.update_or_create(
                    recruiter=recruiter, title=title,
                    defaults={"description": f"{title} chez {name}.", "category": category, "is_active": active},
                )

        active = Offer.objects.filter(is_active=True).count()
        self.stdout.write(self.style.SUCCESS(f"{Company.objects.count()} entreprises, {active} offres en cours."))
