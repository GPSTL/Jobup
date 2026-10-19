from __future__ import annotations

import uuid
from typing import Any, ClassVar

from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.core.files.base import ContentFile
from django.db import models


class Role(models.TextChoices):
    STUDENT = "student"
    RECRUITER = "recruiter"
    SCHOOL = "school"
    ADMIN = "admin"


class UserManager(BaseUserManager["User"]):
    def create_user(self, email: str, password: str, **fields: Any) -> User:
        if not email.strip():
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email), **fields)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email: str, password: str, **fields: Any) -> User:
        return self.create_user(
            email, password, role=Role.ADMIN, is_staff=True, is_superuser=True, **fields
        )


class User(AbstractBaseUser, PermissionsMixin):  # pyright: ignore[reportIncompatibleVariableOverride]
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=32)
    role = models.CharField(max_length=16, choices=Role.choices)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: ClassVar = ["name"]

    objects = UserManager()

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.pk,
            "email": self.email,
            "name": self.name,
            "role": self.role,
        }


class Student(models.Model):
    user_id: int
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="student")
    age = models.PositiveSmallIntegerField()
    has_job = models.BooleanField(default=False)
    cv = models.FileField(upload_to="CVs", null=True, blank=True)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.pk,
            "name": self.user.name,
            "email": self.user.email,
            "age": self.age,
            "has_job": self.has_job,
        }


def getStudent(_id: int) -> Student | None:
    return Student.objects.filter(user_id=_id).select_related("user").first()

def canViewStudent(user: User, id: int) -> bool:
    return user.role == Role.ADMIN or id == user.pk

def uploadCV(studend: Student, content: bytes):
    studend.cv.save(uuid.uuid4().hex, ContentFile(content))