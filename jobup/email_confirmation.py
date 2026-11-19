# Confirmation de l'adresse e-mail à l'inscription.
#
# Tout est piloté par le réglage EMAIL_CONFIRMATION_REQUIRED (variable d'environnement du même
# nom, voir settings.py). Désactivé : rien ne change, l'inscription ouvre la session. Activé :
# l'inscription crée un compte non confirmé (User.email_confirmed = False) et envoie un lien ;
# la connexion est refusée tant que l'adresse n'est pas confirmée.
# Contrat : docs/api/email-confirmation.md
import logging

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.core.mail import send_mail
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .models import User

logger = logging.getLogger(__name__)

SALT = "jobup.email-confirmation"


def is_enabled() -> bool:
    # Lu à chaque appel, pour que le réglage puisse changer sans importer ce module à nouveau
    return bool(settings.EMAIL_CONFIRMATION_REQUIRED)


def make_token(user: User) -> str:
    # Jeton signé, sans stockage : l'e-mail est inclus pour qu'un lien devienne invalide
    # si l'adresse du compte change.
    return signing.dumps({"uid": user.pk, "email": user.email}, salt=SALT)


def read_token(token: str) -> tuple[User | None, str]:
    # (utilisateur, "") si le jeton est valable, sinon (None, "expired" | "invalid")
    try:
        data = signing.loads(
            token, salt=SALT, max_age=settings.EMAIL_CONFIRMATION_MAX_AGE
        )
    except signing.SignatureExpired:
        return None, "expired"
    except signing.BadSignature:
        return None, "invalid"
    if not isinstance(data, dict):
        return None, "invalid"
    user = User.objects.filter(pk=data.get("uid"), email=data.get("email")).first()
    return (user, "") if user is not None else (None, "invalid")


def confirmation_link(user: User) -> str:
    return f"{settings.SITE_URL}/confirm-email?token={make_token(user)}"


def send_confirmation_email(user: User) -> bool:
    # Un échec d'envoi est journalisé sans faire échouer l'inscription : le compte existe et
    # l'utilisateur peut demander un nouvel e-mail (resend_confirmation).
    link = confirmation_link(user)
    if settings.DEBUG:
        # The console e-mail backend prints the body quoted-printable encoded, which cuts a
        # long link with "=" line breaks: log it plain too, for development only
        logger.warning("Confirmation link of %s (DEBUG only): %s", user.email, link)
    try:
        send_mail(
            "JobUp — Confirmez votre adresse e-mail",
            (
                f"Bonjour {user.first_name},\n\n"
                f"Pour activer votre compte JobUp, confirmez votre adresse e-mail :\n"
                f"{link}\n\n"
                "Ce lien est valable "
                f"{max(settings.EMAIL_CONFIRMATION_MAX_AGE // 3600, 1)} heures.\n\n"
                "Si vous n'avez pas créé de compte JobUp, ignorez ce message."
            ),
            None,
            [user.email],
        )
    except Exception:  # noqa: BLE001
        logger.exception("Confirmation e-mail of user %s not sent", user.pk)
        return False
    return True


class ResendThrottle(AnonRateThrottle):
    scope = "resend_confirmation"


@api_view(["POST"])
@permission_classes([AllowAny])
def confirm_email(request: Request) -> Response:
    token = request.data.get("token") if hasattr(request.data, "get") else None
    if not isinstance(token, str) or not token:
        return Response({"error": "invalid"}, status=400)
    user, error = read_token(token)
    if user is None:
        return Response({"error": error}, status=400)
    # Idempotent : un lien ouvert deux fois (ou par un antivirus de messagerie) reste valable
    if not user.email_confirmed:
        user.email_confirmed = True
        user.save(update_fields=["email_confirmed"])
    return Response({"confirmed": True})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ResendThrottle])
def resend_confirmation(request: Request) -> Response:
    if not is_enabled():
        return Response({"error": "Email confirmation is disabled"}, status=404)
    email = request.data.get("email") if hasattr(request.data, "get") else None
    if not isinstance(email, str):
        return Response({"error": "Invalid payload"}, status=400)
    user = User.objects.filter(email__iexact=email.strip()).first()
    # Même réponse que le compte existe ou non, ou soit déjà confirmé : l'API ne sert pas à
    # deviner quelles adresses sont inscrites.
    if (
        user is not None
        and user.is_active
        and not user.email_confirmed
        and cache.add(
            f"email-confirmation-resend:{user.pk}",
            1,
            settings.EMAIL_CONFIRMATION_RESEND_DELAY,
        )
    ):
        send_confirmation_email(user)
    return Response({"sent": True}, status=202)
