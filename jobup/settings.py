import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv("DEBUG", "True") == "True"

# SECURITY WARNING: keep the secret key used in production secret!
DEFAULT_SECRET_KEY = (
    "django-insecure-nvq5q$m&0kdpgj&wy&p)1%1_a+^dhd@(@1b8=x(b(n2&(^2f39"
)

SECRET_KEY = os.getenv("SECRET_KEY", DEFAULT_SECRET_KEY)

ALLOWED_HOSTS = ["127.0.0.1", "localhost"] if DEBUG else ["*"]


AUTH_USER_MODEL = "jobup.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication"
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_THROTTLE_RATES": {
        # Renvoi de l'e-mail de confirmation, par adresse IP (jobup/email_confirmation.py)
        "resend_confirmation": "10/hour",
    },
}

# Application definition

INSTALLED_APPS = [
    "jobup",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # Presence of the logged-in users (JOB-039), after the authentication
    "jobup.presence.PresenceMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "jobup.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "jobup.wsgi.application"


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "Europe/Paris"

USE_I18N = True

USE_TZ = True

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Pièces jointes des messages (JOB-043) : hors de MEDIA_ROOT, donc jamais servies par
# MEDIA_URL. Elles ne sont lisibles que par l'API, pour les participants de la conversation.
PRIVATE_MEDIA_ROOT = BASE_DIR / "private_media"

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = "static/"

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

MAILERS = {
    "default": {
        "BACKEND": "django.core.mail.backends.smtp.EmailBackend",
        "OPTIONS": {
            "host": "smtp.gmail.com",
            "port": 587,
            "use_tls": True,
            "username": os.getenv("THE_EMAIL_ADDRESS"),
            "password": os.getenv("THE_PASSWORD"),
        },
    }
}
# Sans compte SMTP (développement) : les e-mails des notifications (JOB-042) s'affichent dans
# la console au lieu d'échouer. Le choix du prestataire reste une question ouverte de JOB-042.
if not os.getenv("THE_EMAIL_ADDRESS"):
    MAILERS["default"] = {"BACKEND": "django.core.mail.backends.console.EmailBackend"}
DEFAULT_FROM_EMAIL = os.getenv("THE_EMAIL_ADDRESS", "JobUp <notifications@jobup.local>")
# Adresse du site, pour les liens des e-mails
SITE_URL = os.getenv("SITE_URL", "http://127.0.0.1:8000")


# Confirmation de l'adresse e-mail à l'inscription.
# Interrupteur : EMAIL_CONFIRMATION_REQUIRED=true (ou 1, yes, on) l'active. Désactivé par défaut :
# l'inscription ouvre alors la session directement, comme avant. Voir docs/api/email-confirmation.md
EMAIL_CONFIRMATION_REQUIRED = os.getenv(
    "EMAIL_CONFIRMATION_REQUIRED", "false"
).strip().lower() in ("1", "true", "yes", "on")
# Durée de validité du lien de confirmation, en secondes (3 jours par défaut)
EMAIL_CONFIRMATION_MAX_AGE = int(
    os.getenv("EMAIL_CONFIRMATION_MAX_AGE", str(3 * 24 * 3600))
)
# Délai minimal entre deux e-mails de confirmation pour un même compte, en secondes
EMAIL_CONFIRMATION_RESEND_DELAY = int(
    os.getenv("EMAIL_CONFIRMATION_RESEND_DELAY", "60")
)
