from __future__ import annotations

from typing import Any, ClassVar

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models

# ----- ENUMS ----- #


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


# ----- GROUPS ----- #


class School(models.Model):
    name = models.CharField(max_length=128, unique=True)


siret_validator = RegexValidator(r"^\d{14}$", "A SIRET must be exactly 14 digits")


class Company(models.Model):
    name = models.CharField(max_length=128, unique=True)
    siret = models.CharField(max_length=14, unique=True, validators=[siret_validator])


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
    name = models.CharField(max_length=32)
    first_name = models.CharField(max_length=32)
    role = models.SmallIntegerField(choices=Role.choices)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: ClassVar = ["first_name", "name"]

    objects = UserManager()

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.pk,
            "name": self.name,
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
    description = models.CharField(max_length=512, blank=True)
    category = models.SmallIntegerField(choices=JobCategory.choices)
    experience_level = models.PositiveSmallIntegerField(default=0)  # months
    skills = models.CharField(max_length=256, blank=True)  # Comma separated skills
    region = models.CharField(max_length=64, default="Île-de-France")
    study_degree = models.SmallIntegerField(choices=StudyDegree.choices)
    rhythm = models.CharField(
        max_length=64, blank=True
    )  # years\d{1} (weeks(\d{1}){2-48} | days(\d{1}){2-7})
    available_from = models.DateField(null=True, auto_now_add=True)
    available_to = models.DateField(null=True)
    school = models.ForeignKey(
        School, models.SET_NULL, null=True, blank=True, related_name="students"
    )


class Recruiter(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="recruiter"
    )
    company = models.ForeignKey(Company, models.PROTECT, related_name="recruiters")


class SchoolManager(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="school_manager"
    )
    school = models.ForeignKey(School, models.PROTECT, related_name="managers")


# ----- JOB SEARCH ----- #


class Offer(models.Model):
    recruiter = models.ForeignKey(Recruiter, models.CASCADE, related_name="offers")
    title = models.CharField(max_length=128)
    description = models.CharField(max_length=2048)
    requirements = models.CharField(max_length=256, blank=True)
    category = models.SmallIntegerField(choices=JobCategory.choices)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class JobApplication(models.Model):
    student = models.ForeignKey(Student, models.CASCADE, related_name="applications")
    offer = models.ForeignKey(Offer, models.CASCADE, "applications")
    message = models.CharField(max_length=1024)
    cover_letter = models.FileField(upload_to="covers", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Contract(models.Model):
    school = models.ForeignKey(School, models.PROTECT)
    company = models.ForeignKey(Company, models.PROTECT)
    student = models.ForeignKey(Student, models.PROTECT)


# Utilities #


def getUser(_id: int) -> User | None:
    try:
        return User.objects.get(id=_id)
    except User.DoesNotExist:
        return None
