from __future__ import annotations

import os
import re
from typing import TYPE_CHECKING, Any, ClassVar, Self
from uuid import uuid4

from django.conf import settings
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.files import File
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import UploadedFile
from django.core.validators import RegexValidator
from django.db import models, transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from .settings import DEBUG


class StrictCharField(models.CharField):
    if DEBUG:

        def pre_save(self, model_instance: models.Model, add: bool) -> str | None:
            value: str | None = super().pre_save(model_instance, add)
            if not self.blank and (value is None or value.strip() == ""):
                raise ValidationError({self.name: "Field is required"})
            return value


# ----- ENUMS ----- #


def choice_from_frontend(derived_class: Any, frontend_choice: int | str) -> int | None:
    for choice_tuple in derived_class.choices:
        if frontend_choice in choice_tuple:
            return choice_tuple[0]
    return None


class Role(models.IntegerChoices):
    ADMIN = 127, "Administrator"
    STUDENT = 1, "Student"
    MANAGER = 2, "School Manager"
    RECRUITER = 3, "Recruiter"


class StudentSubscription(models.IntegerChoices):
    FREE = 0, "Free"
    PREMIUM = 1, "Premium"


class JobCategory(models.IntegerChoices):
    COMPUTER_SCIENCE = 1, "Computer Science & IT"
    DATA_AI = 2, "Data Science & AI"
    CYBERSECURITY = 3, "Cybersecurity"
    BUSINESS = 4, "Business & Strategy"
    MANAGEMENT = 5, "Management & Administration"
    PROJECT_MANAGEMENT = 6, "Project & Product Management"
    ENGINEERING = 7, "Engineering"
    BIOTECH_SCIENCE = 8, "Biotechnology & Applied Sciences"
    ENERGY_ENVIRONMENT = 9, "Energy & Environment"
    MARKETING = 10, "Marketing & Growth"
    SALES_BD = 11, "Sales & Business Development"
    COMMUNICATION_PR = 12, "Communication & Public Relations"
    FINANCE = 13, "Finance & Accounting"
    BANKING_INSURANCE = 14, "Banking & Insurance"
    LEGAL_COMPLIANCE = 15, "Legal & Compliance"
    CONSULTING = 16, "Consulting & Strategy"
    DESIGN = 17, "UX/UI & Graphic Design"
    MEDIA_JOURNALISM = 18, "Media, Journalism & Content Creation"
    ARTS_ENTERTAINMENT = 19, "Arts, Culture & Entertainment"
    HUMAN_RESOURCES = 20, "Human Resources & Recruiting"
    EDUCATION_TRAINING = 21, "Education & Training"
    SOCIAL_NONPROFIT = 22, "Social Services & Non-Profit"
    HEALTH = 23, "Healthcare & Medical"
    PHARMACEUTICALS = 24, "Pharmaceuticals & Research"
    SPORTS_WELLNESS = 25, "Sports & Wellness"
    SUPPLY_CHAIN_LOGISTICS = 26, "Logistics & Supply Chain"
    REAL_ESTATE_ARCHITECTURE = 27, "Real Estate & Architecture"
    HOSPITALITY_TOURISM = 28, "Hospitality, Catering & Tourism"
    TRADES_CRAFTS = 29, "Trades & Construction"

    OTHER = 99, "Other"


class StudyDegree(models.IntegerChoices):
    LICENCE1 = 1, "BAC+1"
    LICENCE2 = 2, "BAC+2"
    LICENCE3 = 3, "BAC+3"
    MASTER1 = 4, "BAC+4"
    MASTER2 = 5, "BAC+5"


class ApplicationStatus(models.IntegerChoices):
    DRAFT = 0, "Draft"
    SUBMITTED = 1, "Submitted"
    READ = 2, "Read"
    IN_REVIEW = 3, "In review"
    ACCEPTED = 4, "Accepted"
    REFUSED = 5, "Refused"


FINAL_STATUSES = frozenset({ApplicationStatus.ACCEPTED, ApplicationStatus.REFUSED})


# ----- GROUPS ----- #


class School(models.Model):
    name = StrictCharField(max_length=128, unique=True)


siret_validator = RegexValidator(r"^\d{14}$", "A SIRET must be exactly 14 digits")


class Company(models.Model):
    name = StrictCharField(max_length=128, unique=True)
    siret = StrictCharField(max_length=14, unique=True, validators=[siret_validator])


# ----- USERS ----- #


class UserManager(BaseUserManager["User"]):
    def create_user(self, email: str, password: str, **fields: Any) -> User:
        if not email.strip():
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email), **fields)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email: str, password: str, **fields: Any) -> User:
        fields.setdefault("role", Role.ADMIN)
        fields["is_superuser"] = True
        return self.create_user(email, password, **fields)


class User(AbstractBaseUser, PermissionsMixin):  # pyright: ignore[reportIncompatibleVariableOverride]
    email = models.EmailField(unique=True)
    last_name = StrictCharField(max_length=32)
    first_name = StrictCharField(max_length=32)
    role = models.SmallIntegerField(choices=Role.choices)
    is_active = models.BooleanField(default=True)
    email_confirmed = models.BooleanField(default=True)
    date_joined = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: ClassVar = ["first_name", "last_name", "role"]

    objects = UserManager()

    if TYPE_CHECKING:
        id: int
        student: Student

    def to_dict(self) -> dict[str, Any]:
        return {
            "email": self.email,
            "id": self.pk,
            "last_name": self.last_name,
            "first_name": self.first_name,
            "role": self.role,
        }


class Student(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="student")
    subscription = models.SmallIntegerField(
        choices=StudentSubscription.choices,
        default=StudentSubscription.FREE,
    )
    resume = models.FileField(upload_to="CVs", blank=True)
    # Date of the last import of the CV
    resume_updated_at = models.DateTimeField(null=True, blank=True)
    photo = models.ImageField(upload_to="photos", blank=True)
    desired_position = models.CharField(max_length=100, blank=True)
    description = models.CharField(max_length=500, blank=True)
    category = models.SmallIntegerField(
        choices=JobCategory.choices, null=True, blank=True
    )
    experience_level = models.PositiveSmallIntegerField(default=0)  # months
    skills = models.CharField(max_length=256, blank=True)  # Comma separated skills
    region = models.CharField(max_length=64, default="Île-de-France")
    study_degree = models.SmallIntegerField(
        choices=StudyDegree.choices, null=True, blank=True
    )
    rhythm = models.CharField(
        max_length=64, blank=True
    )  # years\d{1} (weeks(\d{1}){2-48} | days(\d{1}){2-7})
    available_from = models.DateField(null=True, auto_now_add=True)
    available_to = models.DateField(null=True)
    school = models.ForeignKey(
        School, models.SET_NULL, null=True, blank=True, related_name="students"
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "uid": self.user.id,
            "subscription": self.subscription,
            "photo_url": self.photo.url if self.photo else None,
            "description": self.description,
            "desired_position": self.desired_position,
            "category": self.category,
            "experience_level": self.experience_level,
            "skills": self.skills,
            "region": self.region,
            "rhythm": self.rhythm,
            "available_from": self.available_from,
            "available_to": self.available_to,
            "school": self.school.id if self.school else -1,
        }


class Recruiter(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="recruiter"
    )
    company = models.ForeignKey(
        Company, models.PROTECT, null=True, blank=True, related_name="recruiters"
    )


class SchoolManager(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="school_manager"
    )
    school = models.ForeignKey(
        School, models.PROTECT, null=True, blank=True, related_name="managers"
    )


# ----- JOB SEARCH ----- #


class Offer(models.Model):
    recruiter = models.ForeignKey(Recruiter, models.CASCADE, related_name="offers")
    title = StrictCharField(max_length=128)
    description = StrictCharField(max_length=2048)
    requirements = models.CharField(max_length=256, blank=True)
    category = models.SmallIntegerField(choices=JobCategory.choices)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class JobApplication(models.Model):
    student = models.ForeignKey(Student, models.CASCADE, related_name="applications")
    offer = models.ForeignKey(Offer, models.CASCADE, "applications")
    status = models.SmallIntegerField(
        choices=ApplicationStatus.choices, default=ApplicationStatus.DRAFT
    )
    message = models.CharField(max_length=1024, blank=True)
    cover_letter = models.FileField(upload_to="covers", blank=True)
    sent_resume = models.FileField(upload_to="sent_resumes", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["student", "offer"], name="unique_application_per_offer"
            )
        ]

    @property
    def is_draft(self) -> bool:
        return self.status == ApplicationStatus.DRAFT

    def submit(self) -> None:
        resume = self.student.resume
        with resume.open("rb") as source:
            self.sent_resume.save(
                os.path.basename(resume.name), File(source), save=False
            )
        self.status = ApplicationStatus.SUBMITTED
        self.submitted_at = timezone.now()
        self.save()

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.pk,
            "offer": {"id": self.offer.pk, "title": self.offer.title},
            "company": self.offer.recruiter.company.name,
            "status": self.status,
            "status_label": ApplicationStatus(self.status).label,
            "submitted_at": self.submitted_at,
            "updated_at": self.updated_at,
        }

    def to_detail_dict(self) -> dict[str, Any]:
        base = f"/api/applications/{self.pk}/documents"
        return {
            **self.to_dict(),
            "message": self.message,
            "documents": {
                "resume": f"{base}/resume" if self.sent_resume else None,
                "cover_letter": f"{base}/cover_letter" if self.cover_letter else None,
            },
        }


# Présélection du recruteur (JOB-037, REC-03) : les candidats retenus avec ♥.
# Elle appartient au recruteur, pas à son entreprise ; un candidat n'y figure qu'une fois.
class Shortlist(models.Model):
    recruiter = models.ForeignKey(Recruiter, models.CASCADE, related_name="shortlist")
    student = models.ForeignKey(Student, models.CASCADE, related_name="shortlisted_by")
    # Offre pour laquelle le candidat est retenu (« Pour : … » de la maquette) :
    # prévue pour les filtres de JOB-036, vide tant qu'aucun écran ne permet de la choisir
    offer = models.ForeignKey(
        Offer, models.SET_NULL, null=True, blank=True, related_name="shortlisted"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["recruiter", "student"], name="unique_recruiter_shortlist"
            )
        ]


# Candidats écartés avec 🚫 (JOB-038, REC-04). Portée retenue en attendant la décision de l'équipe :
# le recruteur seul, sans limite de durée, toutes recherches confondues. Comme la présélection, elle
# n'est jamais partagée avec les collègues de l'entreprise. Ne touche ni aux candidatures ni à la présélection.
class Exclusion(models.Model):
    recruiter = models.ForeignKey(Recruiter, models.CASCADE, related_name="exclusions")
    student = models.ForeignKey(Student, models.CASCADE, related_name="excluded_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["recruiter", "student"], name="unique_recruiter_exclusion"
            )
        ]


class Contract(models.Model):
    school = models.ForeignKey(School, models.PROTECT)
    company = models.ForeignKey(Company, models.PROTECT)
    student = models.ForeignKey(Student, models.PROTECT)


# ----- MESSAGING ----- #


MESSAGE_MAX_LENGTH = 2000


# Socle commun de la messagerie (JOB-032), partagé avec le fil (JOB-034) et le côté recruteur (JOB-041).
# Une conversation relie un étudiant à un seul interlocuteur : un recruteur ou un employé d'école.
class Conversation(models.Model):
    student = models.ForeignKey(Student, models.CASCADE, related_name="conversations")
    recruiter = models.ForeignKey(
        Recruiter, models.CASCADE, null=True, blank=True, related_name="conversations"
    )
    school_manager = models.ForeignKey(
        SchoolManager,
        models.CASCADE,
        null=True,
        blank=True,
        related_name="conversations",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    if TYPE_CHECKING:
        last_at: Any
        last_body: Any
        last_sender: Any
        last_attachment: Any

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(recruiter__isnull=False, school_manager__isnull=True)
                | models.Q(recruiter__isnull=True, school_manager__isnull=False),
                name="conversation_has_one_interlocutor",
            ),
            # Une seule conversation par paire étudiant / interlocuteur
            models.UniqueConstraint(
                fields=["student", "recruiter"], name="unique_student_recruiter"
            ),
            models.UniqueConstraint(
                fields=["student", "school_manager"],
                name="unique_student_school_manager",
            ),
        ]


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation, models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(User, models.CASCADE, related_name="sent_messages")
    body = models.CharField(max_length=MESSAGE_MAX_LENGTH)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    if TYPE_CHECKING:
        sender_id: int
        conversation_id: int
        attachment: MessageAttachment


# Stockage des pièces jointes (JOB-043) : un dossier à part, hors de MEDIA_ROOT. Aucune URL
# publique n'en est déduite (url() échoue) : le téléchargement passe par l'API, qui vérifie
# que l'utilisateur participe à la conversation. Lu à chaque appel pour suivre les réglages.
class PrivateStorage(FileSystemStorage):
    @property
    def base_location(self) -> str:  # type: ignore[override]
        return str(settings.PRIVATE_MEDIA_ROOT)

    @property
    def location(self) -> str:  # type: ignore[override]
        return os.path.abspath(self.base_location)

    @property
    def base_url(self) -> None:  # type: ignore[override]
        return None


# Dossier créé pour chaque pièce jointe : message_attachments/<32 chiffres hexadécimaux>
ATTACHMENT_FOLDER = re.compile(r"message_attachments/[0-9a-f]{32}")


# Pièce jointe d'un message (JOB-043, REC-14), dans le socle commun de la messagerie : elle suit
# son message, donc la conversation et ses participants. Un fichier au plus par message ; la
# politique (formats, taille) est dans attachments.py.
class MessageAttachment(models.Model):
    message = models.OneToOneField(Message, models.CASCADE, related_name="attachment")
    file = models.FileField(
        upload_to="message_attachments", storage=PrivateStorage(), max_length=255
    )
    # Taille en octets, mesurée à l'envoi
    size = models.PositiveIntegerField()

    if TYPE_CHECKING:
        message_id: int

    @property
    def name(self) -> str:
        return os.path.basename(self.file.name)  # type: ignore

    @classmethod
    def store(cls, message: Message, upload: UploadedFile, name: str) -> Self:
        attachment = cls(message=message, size=upload.size)
        # Un nouveau dossier par envoi : le fichier garde son nom, sans écraser un autre
        attachment.file.save(f"{uuid4().hex}/{name}", upload, save=False)
        try:
            attachment.save()
        except Exception:
            # Le message n'existera pas : le fichier est inutile
            attachment.discard_file()
            raise
        return attachment

    def discard_file(self) -> None:
        storage, name = self.file.storage, self.file.name
        if not name:
            return
        storage.delete(name)
        # Son dossier aussi, maintenant vide : jamais message_attachments lui-même
        folder = os.path.dirname(name)
        if ATTACHMENT_FOLDER.fullmatch(folder):
            storage.delete(folder)


# Un message supprimé (avec sa conversation ou son étudiant) emporte son fichier, une fois la
# suppression validée en base : Django ne supprime jamais les fichiers lui-même.
@receiver(post_delete, sender=MessageAttachment)
def delete_attachment_file(instance: MessageAttachment, **_: Any) -> None:
    transaction.on_commit(instance.discard_file)


# Utilities #


def getUser(_id: int) -> User | None:
    try:
        return User.objects.get(id=_id)
    except User.DoesNotExist:
        return None


# class TokenGenerator(PasswordResetTokenGenerator):
#     def _make_hash_value(self, user, timestamp):
#         return f"{user['password']}{timestamp}{user['email']}"


# token_generator = TokenGenerator()


class SignupSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("email", "password", "last_name", "first_name", "role")

    def to_internal_value(self, data: dict[str, str | int | None | bool], **kwargs):
        if "role" not in data:
            raise ValidationError({"role": "This field is required."})
        if not isinstance(data["role"], (str, int)):
            raise ValidationError({"role": "This field is invalid."})
        role = choice_from_frontend(Role, data["role"])
        if role is None:
            raise ValidationError({"role": "This field is invalid."})
        data["role"] = role
        return super().to_internal_value(data)

    def create(self, validated_data):
        password = validated_data.pop("password")
        with transaction.atomic():
            user = super().create(validated_data)
            user.set_password(password)
            user.save()
            match user.role:
                case Role.STUDENT:
                    Student.objects.create(user=user)
                case Role.RECRUITER:
                    Recruiter.objects.create(user=user)
                case Role.MANAGER:
                    SchoolManager.objects.create(user=user)
        return user

    def save(self, **kwargs):
        # token = token_generator.make_token(self.validated_data)
        # link = f"http://localhost:8000/api/confirm_email/{token}"
        # send_mail(
        #     "Confirmez votre adresse mail",
        #     (
        #         f"Lien de vérification: {link}\n\n"
        #         + "Si vous n'avez pas créé de compte Jobup, "
        #         + "veuillez ignorer ce message."
        #     ),
        #     "xx.yy@gmail.com",
        #     [self.validated_data["email"]],
        # )
        super().save()


class DraftSerializer(serializers.Serializer):
    offer = serializers.PrimaryKeyRelatedField(
        queryset=Offer.objects.filter(is_active=True)
    )
    message = serializers.CharField(max_length=1024, required=False, allow_blank=True)
    cover_letter = serializers.FileField(required=False)

    if TYPE_CHECKING:
        validated_data: dict[str, Any]  # type: ignore

    def save_draft(self, student: Student) -> tuple[JobApplication, bool]:
        data = self.validated_data
        application, created = JobApplication.objects.get_or_create(
            student=student, offer=data["offer"]
        )
        if "message" in data:
            application.message = data["message"]
        if "cover_letter" in data:
            application.cover_letter = data["cover_letter"]
        application.save()
        return application, created


class MessageSerializer(serializers.Serializer):
    # Le texte peut être vide quand le message porte un fichier (JOB-043) : has_file, dans le
    # contexte, est donné par la vue, qui lit le fichier à part
    body = serializers.CharField(
        max_length=MESSAGE_MAX_LENGTH, required=False, allow_blank=True
    )

    if TYPE_CHECKING:
        validated_data: dict[str, Any]  # type: ignore

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if not attrs.get("body") and not self.context.get("has_file"):
            raise ValidationError({"body": "This field may not be blank."})
        return attrs

    def save_message(
        self,
        conversation: Conversation,
        sender: User,
        attachment: tuple[UploadedFile, str] | None = None,
    ) -> Message:
        # Le message et son fichier sont enregistrés ensemble, ou pas du tout
        with transaction.atomic():
            message = Message.objects.create(
                conversation=conversation,
                sender=sender,
                body=self.validated_data.get("body", ""),
            )
            if attachment is not None:
                MessageAttachment.store(message, *attachment)
        return message
