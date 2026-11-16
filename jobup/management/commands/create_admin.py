# Administrator account shared by the team (ADM-13): the public signup never creates one.
# Its e-mail and password come from the environment (JOBUP_ADMIN_EMAIL, JOBUP_ADMIN_PASSWORD,
# e.g. in the .env that is not versioned) or from the options. Running it again updates the
# password of the same account.
import os

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from jobup.models import Role, User


class Command(BaseCommand):
    help = "Create or update the JobUp administrator account (role 127)"

    def add_arguments(self, parser):
        parser.add_argument("--email", help="Default: JOBUP_ADMIN_EMAIL")
        parser.add_argument("--password", help="Default: JOBUP_ADMIN_PASSWORD")

    def handle(self, *args, **options):
        email = (options["email"] or os.getenv("JOBUP_ADMIN_EMAIL") or "").strip()
        password = options["password"] or os.getenv("JOBUP_ADMIN_PASSWORD") or ""
        if not email or not password:
            raise CommandError(
                "Give the e-mail and the password: JOBUP_ADMIN_EMAIL and "
                "JOBUP_ADMIN_PASSWORD in .env, or --email and --password."
            )
        email = User.objects.normalize_email(email)
        with transaction.atomic():
            user = User.objects.filter(email__iexact=email).first()
            if user is not None and user.role != Role.ADMIN:
                raise CommandError(
                    f"{email} is already used by an account of another role."
                )
            if user is None:
                user = User(
                    email=email, first_name="Admin", last_name="JobUp", role=Role.ADMIN
                )
            user.set_password(password)
            user.is_active = True
            user.save()
        self.stdout.write(self.style.SUCCESS(f"Administrator ready: {email}"))
