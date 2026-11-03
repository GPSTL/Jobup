from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from jobup.models import JobCategory, Offer, Recruiter, Role


class Command(BaseCommand):
    help = "Ajoute 14 offres de démonstration à un recruteur existant (usage local)."

    def add_arguments(self, parser):
        parser.add_argument("email", help="Adresse du compte recruteur existant")

    @transaction.atomic
    def handle(self, *args, **options):
        recruiter = Recruiter.objects.filter(
            user__email__iexact=options["email"], user__role=Role.RECRUITER
        ).first()
        if recruiter is None:
            raise CommandError("Aucun profil recruteur ne correspond à cette adresse.")
        created = 0
        for index in range(1, 15):
            _, added = Offer.objects.get_or_create(
                recruiter=recruiter,
                title=f"[Démo JOB-022] Développeur en alternance {index:02d}",
                defaults={
                    "description": f"Offre de démonstration {index}. Rejoignez notre équipe pour développer des applications web et participer à des projets concrets.",
                    "requirements": "Curiosité, esprit d’équipe et bases en développement web.",
                    "category": JobCategory.COMPUTER_SCIENCE,
                },
            )
            created += added
        self.stdout.write(self.style.SUCCESS(f"{created} offres de démonstration créées."))
