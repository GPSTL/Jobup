# Student CV API (JOB-018): reading the name and the date of the CV, and
# importing a CV, which replaces the current one. Contract with the front end:
# docs/api/resume.md
import io
import os
import re
import zipfile
from typing import Any
from uuid import uuid4

from django.core.files.storage import Storage
from django.core.files.uploadedfile import UploadedFile
from django.utils import timezone
from django.utils.datastructures import MultiValueDict
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .api import canViewStudent, getStudent
from .models import Student, User
from .profile import canEditStudent

RESUME_MAX_SIZE = 5 * 1024 * 1024
# So that the path CVs/<32 hexadecimal digits>/<name> fits in the 100
# characters of Student.resume
RESUME_NAME_MAX_LENGTH = 60
# Start of the Word 97-2003 files (.doc), which are OLE2 compound files. Excel
# and PowerPoint 97-2003 files start the same way and are not told apart.
OLE2_SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
# Folder created for each CV by student_resume
RESUME_FOLDER = re.compile(r"CVs/[0-9a-f]{32}")


def resumeError(message: str) -> Response:
    return Response({"errors": {"resume": message}}, status=400)


def isWordArchive(content: bytes) -> bool:
    # A .docx file is a ZIP archive holding the text in word/document.xml
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            return "word/document.xml" in archive.namelist()
    except Exception:  # noqa: BLE001
        # Besides BadZipFile, a damaged archive can raise NotImplementedError
        # or UnicodeDecodeError, among others
        return False


def resumeFormat(resume: UploadedFile) -> str | None:
    # Read from the content (5 MB at most, checked before), whatever the file
    # name: the extension of the format, or None when the file is neither a
    # PDF nor a Word document
    content: bytes = resume.read()
    resume.seek(0)
    if content.startswith(b"%PDF-"):
        return "pdf"
    if content.startswith(OLE2_SIGNATURE):
        return "doc"
    if content.startswith(b"PK\x03\x04") and isWordArchive(content):
        return "docx"
    return None


def resumeName(uploaded: str, extension: str) -> str:
    # Name of the imported file, shortened, with the extension of its format,
    # added when the name does not end with it (CV.doc holding a PDF becomes
    # CV.doc.pdf). The storage then turns the spaces into underscores and
    # removes the other special characters.
    stem, suffix = os.path.splitext(uploaded.strip())
    if suffix.lower() != f".{extension}":
        stem, suffix = stem + suffix, f".{extension}"
    return stem[: RESUME_NAME_MAX_LENGTH - len(suffix)] + suffix


def deleteResume(storage: Storage, name: str | None) -> None:
    if not name:
        return
    storage.delete(name)
    # Its folder too, now empty, if student_resume created it: never the CVs
    # folder itself
    folder = os.path.dirname(name)
    if RESUME_FOLDER.fullmatch(folder):
        storage.delete(folder)


def replaceResume(student: Student, resume: UploadedFile, name: str) -> None:
    storage = student.resume.storage
    previous = student.resume.name
    # Written in a new folder, so the file keeps its name, and the current CV
    # stays untouched until the profile points to the new one. If writing
    # fails, nothing has changed.
    student.resume.save(f"{uuid4().hex}/{name}", resume, save=False)
    student.resume_updated_at = timezone.now()
    try:
        student.save(update_fields=["resume", "resume_updated_at"])
    except Exception:
        # The profile still points to the previous CV: the new file is useless
        deleteResume(storage, student.resume.name)
        raise
    deleteResume(storage, previous)


def resumeInfo(student: Student) -> dict[str, Any]:
    name = student.resume.name
    # Both None when the student has not imported a CV yet
    if not name:
        return {"file_name": None, "updated_at": None}
    return {
        "file_name": os.path.basename(name),
        "updated_at": student.resume_updated_at,
    }


@api_view(["GET", "POST"])
def student_resume(request: Request, id: int) -> Response:
    user: User = request.user
    allowed = (
        canViewStudent(user, id)
        if request.method == "GET"
        else canEditStudent(user, id)
    )
    if not allowed:
        return Response({"error": "Forbidden"}, status=403)

    target = getStudent(id)
    if target is None:
        return Response({"error": "Student not found"}, status=404)

    if request.method == "POST":
        files = request.FILES
        # Checked for the type checker: DRF does not type FILES
        resume = files.get("resume") if isinstance(files, MultiValueDict) else None
        if not isinstance(resume, UploadedFile):
            return resumeError("Aucun CV reçu.")
        # The size is None only for a file created without it, never for an upload
        if resume.size is None or resume.size > RESUME_MAX_SIZE:
            return resumeError("Le CV ne doit pas dépasser 5 Mo.")
        extension = resumeFormat(resume)
        if extension is None:
            return resumeError("Le CV doit être au format PDF, DOCX ou DOC.")
        replaceResume(target, resume, resumeName(resume.name or "", extension))

    return Response(resumeInfo(target))
