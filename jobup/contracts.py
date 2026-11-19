# Contrat d'alternance d'une candidature acceptée (JOB-045, REC-26) : dépôt et remplacement du
# PDF par le recruteur, téléchargement par le recruteur, l'étudiant et son école.
# Contrat avec le front end : docs/api/school.md, section « Contrats »
#
# Règles retenues (questions ouvertes de JOB-045) :
#   - un PDF de 10 Mo au plus, reconnu au contenu et non au nom ;
#   - la date de fin est après la date de début ;
#   - le remplacement est possible jusqu'à la veille de la date de début (heure de Paris)
#     et tant que le contrat n'est pas signé ; il ramène le contrat à « déposé », l'école
#     doit le valider de nouveau ;
#   - seule la dernière version est gardée.
import datetime
import os
from typing import Any
from uuid import uuid4

from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.db.models import Q
from django.http import FileResponse
from django.utils import timezone
from django.utils.datastructures import MultiValueDict
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .attachments import (
    ATTACHMENT_MAX_SIZE,
    EMPTY_ERROR,
    SIZE_ERROR,
    attachmentFormat,
    attachmentName,
)
from .models import Contract, ContractStage, JobApplication, Role, User

REQUIRED_ERROR = "Ce champ est obligatoire."
FORMAT_ERROR = "Le contrat doit être un fichier PDF."
DATE_ERROR = "Saisissez une date valide."
ORDER_ERROR = "La date de fin doit être après la date de début."
STARTED_ERROR = "L’alternance a commencé : le contrat ne peut plus être remplacé."
SIGNED_ERROR = "Le contrat est signé : il ne peut plus être remplacé."
STORAGE_ERROR = (
    "Le contrat n’a pas été enregistré : le fichier n’a pas pu être stocké. "
    "Réessayez dans un instant."
)


def parsedDate(value: Any) -> datetime.date | None:
    # Date au format AAAA-MM-JJ, None si absente ou impossible (30 février)
    if not isinstance(value, str):
        return None
    try:
        return datetime.date.fromisoformat(value.strip())
    except ValueError:
        return None


class ContractUpload:
    # Fichier et dates reçus, avec les erreurs par champ, en français
    def __init__(self, request: Request):
        self.errors: dict[str, list[str]] = {}
        files = request.FILES
        # Contrôlé pour le vérificateur de types : DRF ne type pas FILES
        upload = files.get("file") if isinstance(files, MultiValueDict) else None
        self.upload: UploadedFile | None = upload
        self.name = ""
        if upload is None:
            self.errors["file"] = [REQUIRED_ERROR]
        elif not upload.size:
            self.errors["file"] = [EMPTY_ERROR]
        elif upload.size > ATTACHMENT_MAX_SIZE:
            self.errors["file"] = [SIZE_ERROR]
        elif attachmentFormat(upload) != "pdf":
            self.errors["file"] = [FORMAT_ERROR]
        else:
            self.name = attachmentName(upload.name or "contrat", "pdf")
        self.start = self.date(request, "start_date")
        self.end = self.date(request, "end_date")
        if self.start and self.end and self.end <= self.start:
            self.errors["end_date"] = [ORDER_ERROR]

    def date(self, request: Request, field: str) -> datetime.date | None:
        value = request.data.get(field)
        if value in (None, ""):
            self.errors[field] = [REQUIRED_ERROR]
            return None
        parsed = parsedDate(value)
        if parsed is None:
            self.errors[field] = [DATE_ERROR]
        return parsed


def replacementRefusal(contract: Contract) -> dict[str, list[str]] | None:
    # Erreurs par champ quand le contrat ne peut plus être remplacé, None sinon
    if contract.stage == ContractStage.SIGNED:
        return {"file": [SIGNED_ERROR]}
    if contract.start_date is not None and timezone.localdate() >= contract.start_date:
        return {"file": [STARTED_ERROR]}
    return None


def storeContract(
    application: JobApplication, upload: ContractUpload, defaults: dict[str, Any]
) -> tuple[Contract, bool] | Response:
    # Crée ou remplace le contrat de la candidature. Le nouveau fichier est écrit avant la
    # base : en cas d'échec, l'ancien contrat et son fichier restent intacts.
    contract = Contract.objects.filter(application=application).first()
    storage = (contract or Contract()).file.storage
    try:
        # Nom nettoyé comme pour une pièce jointe (espaces remplacés par des soulignés)
        path = storage.generate_filename(f"contracts/{uuid4().hex}/{upload.name}")
        name = storage.save(path, upload.upload)
    except OSError:
        return Response({"errors": {"file": [STORAGE_ERROR]}}, status=503)
    try:
        with transaction.atomic():
            contract = (
                Contract.objects.select_for_update()
                .filter(application=application)
                .first()
            )
            created = contract is None
            if contract is None:
                contract = Contract(application=application, **defaults)
            else:
                refusal = replacementRefusal(contract)
                if refusal is not None:
                    Contract.discardFile(storage, name)
                    return Response({"errors": refusal}, status=409)
                previous = contract.file.name
                if previous:
                    transaction.on_commit(
                        lambda: Contract.discardFile(storage, previous), robust=True
                    )
                contract.version += 1
            contract.file.name = name
            contract.start_date, contract.end_date = upload.start, upload.end
            contract.stage = ContractStage.DEPOSITED
            contract.deposited_at = timezone.now()
            contract.validated_at = contract.signed_at = None
            contract.save()
    except Exception:
        Contract.discardFile(storage, name)
        raise
    return contract, created


def canDownload(user: User, contract: Contract) -> bool:
    # L'étudiant du contrat, le recruteur de l'offre, et l'école tant que l'étudiant y est
    # rattaché : un étudiant retiré de l'école ne lui laisse plus l'accès
    student = contract.student
    if student.user_id == user.pk:
        return True
    application = contract.application
    if application is not None and application.offer.recruiter.user_id == user.pk:
        return True
    return (
        student.school_id == contract.school_id
        and contract.school.managers.filter(user=user).exists()
    )


@api_view(["GET"])
def contract_file(request: Request, id: int) -> Response | FileResponse:
    # 404 pour qui n'y a pas accès, sans révéler que le contrat existe
    user: User = request.user
    contract = (
        Contract.objects.select_related(
            "student", "school", "application__offer__recruiter"
        )
        .filter(
            Q(student__user=user)
            | Q(application__offer__recruiter__user=user)
            | Q(school__managers__user=user),
            pk=id,
        )
        .distinct()
        .first()
    )
    if contract is None or not contract.file or not canDownload(user, contract):
        return Response({"error": "Contract not found"}, status=404)
    try:
        file = contract.file.open("rb")
    except FileNotFoundError:
        return Response({"error": "Contract not found"}, status=404)
    response = FileResponse(
        file,
        as_attachment=True,
        filename=os.path.basename(contract.file.name),
        content_type="application/pdf",
    )
    # Téléchargé, jamais affiché par le navigateur ; ni deviné, ni gardé en cache partagé
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, no-store"
    return response


@api_view(["GET"])
def student_contracts(request: Request) -> Response:
    # « Mon espace » étudiant (JOB-045) : ses contrats, les plus récents d'abord
    user: User = request.user
    if user.role != Role.STUDENT:
        return Response({"error": "Forbidden"}, status=403)
    contracts = (
        Contract.objects.filter(student__user=user)
        .select_related("company", "school", "application__offer")
        .order_by("-deposited_at", "-pk")
    )
    return Response(
        [
            {
                **contract.to_dict(),
                "company": contract.company.name,
                "school": contract.school.name,
                "offer_title": contract.application.offer.title
                if contract.application
                else "",
                "application_id": contract.application_id,
            }
            for contract in contracts
        ]
    )
