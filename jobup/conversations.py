# API de la liste des conversations (JOB-032, ETU-07).
# Tri : la conversation la plus récemment active en premier. L'activité est la date du dernier
# message, ou la date de création pour une conversation sans message. Le résumé est calculé
# à chaque requête : il reste à jour après un envoi ou une réception (JOB-034).
# Fil de messages et envoi (JOB-034, ETU-15), communs à tous les participants ; contrat réutilisé par JOB-039.
# Pièce jointe d'un message (JOB-043, REC-14) : envoi par le recruteur de la conversation,
# téléchargement par tous ses participants. Contrat : docs/api/message_attachments.md
# Liste des conversations du recruteur avec la présence des candidats (JOB-039, REC-05) :
# docs/api/recruiter-conversations.md
import os
import unicodedata
from typing import Any, Self

from django.core.files.uploadedfile import UploadedFile
from django.db.models import Exists, F, OuterRef, Q, QuerySet, Subquery
from django.db.models.functions import Coalesce
from django.http import FileResponse
from django.utils.datastructures import MultiValueDict
from pydantic import BaseModel, Field, ValidationError, model_validator
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .attachments import (
    ATTACHMENT_TYPES,
    STORAGE_ERROR,
    attachmentName,
    attachmentRefusal,
)
from .models import (
    Conversation,
    Message,
    MessageAttachment,
    MessageSerializer,
    Recruiter,
    Role,
    Student,
    User,
)
from .presence import secondsSinceSeen


class MessagePage(BaseModel):
    before: int | None = None
    after: int | None = None
    limit: int = Field(default=50, ge=1, le=100)

    @model_validator(mode="after")
    def exclusive_cursors(self) -> Self:
        if self.before is not None and self.after is not None:
            raise ValueError("before and after are exclusive")
        return self


def getConversation(user: User, id: int) -> Conversation | None:
    # Seuls l'étudiant, le recruteur ou l'employé d'école de la conversation y ont accès
    participant = (
        Q(student__user=user) | Q(recruiter__user=user) | Q(school_manager__user=user)
    )
    return Conversation.objects.filter(participant, pk=id).first()


def withLastMessage(conversations: QuerySet[Conversation]) -> QuerySet[Conversation]:
    # Dernier message de chaque conversation ; à réutiliser côté recruteur (JOB-041)
    last = Message.objects.filter(conversation=OuterRef("pk")).order_by(
        "-created_at", "-pk"
    )
    return (
        conversations.annotate(
            last_body=Subquery(last.values("body")[:1]),
            last_sender=Subquery(last.values("sender")[:1]),
            last_attachment=Subquery(last.values("attachment__file")[:1]),
            last_at=Subquery(last.values("created_at")[:1]),
        )
        .annotate(activity=Coalesce(F("last_at"), F("created_at")))
        .order_by("-activity", "-pk")
    )


def normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(
        char for char in decomposed if not unicodedata.combining(char)
    ).casefold()


def matchesName(conversation: Conversation, query: str) -> bool:
    person = interlocutor(conversation)
    haystack = normalize(
        f"{person['first_name']} {person['last_name']} {person['organization']}"
    )
    return all(normalize(word) in haystack for word in query.split())


def interlocutor(conversation: Conversation) -> dict[str, Any]:
    recruiter = conversation.recruiter
    if recruiter is not None:
        if recruiter.company is not None:
            organization_name = recruiter.company.name
        else:
            organization_name = "Recruteur"
        person, kind, organization = (
            recruiter.user,
            "recruiter",
            organization_name,
        )
    else:
        manager = conversation.school_manager
        person, kind, organization = manager.user, "school", manager.school.name
    return {
        "kind": kind,
        "first_name": person.first_name,
        "last_name": person.last_name,
        "organization": organization,
    }


def lastMessage(conversation: Conversation, viewer: User) -> dict[str, Any] | None:
    # Annoté par withLastMessage ; None pour une conversation sans message
    if conversation.last_at is None:
        return None
    return {
        "body": conversation.last_body,
        "created_at": conversation.last_at,
        "from_me": conversation.last_sender == viewer.pk,
        # Nom du fichier du dernier message, pour l'aperçu d'un message sans texte
        "attachment": (
            os.path.basename(conversation.last_attachment)
            if conversation.last_attachment
            else None
        ),
    }


def summary(conversation: Conversation, viewer: User) -> dict[str, Any]:
    return {
        "id": conversation.pk,
        "interlocutor": interlocutor(conversation),
        "last_message": lastMessage(conversation, viewer),
        "created_at": conversation.created_at,
    }


def candidateSummary(conversation: Conversation, viewer: User) -> dict[str, Any]:
    candidate = conversation.student.user
    return {
        "id": conversation.pk,
        # Id du compte, comme /api/recruiter/candidates/<id> : le profil ouvre la
        # conversation avec ?candidate=<id>
        "candidate": {
            "id": candidate.pk,
            "first_name": candidate.first_name,
            "last_name": candidate.last_name,
        },
        "last_message": lastMessage(conversation, viewer),
        "seen_seconds_ago": secondsSinceSeen(candidate),
    }


@api_view(["GET"])
def student_conversations(request: Request) -> Response:
    user: User = request.user
    # Réservé aux étudiants : chacun ne voit que ses propres conversations
    if user.role != Role.STUDENT or not hasattr(user, "student"):
        return Response({"error": "Forbidden"}, status=403)

    conversations = Conversation.objects.filter(student=user.student).select_related(
        "recruiter__user",
        "recruiter__company",
        "school_manager__user",
        "school_manager__school",
    )
    query = request.query_params.get("q", "").strip()
    results = withLastMessage(conversations)
    if query:
        results = [
            conversation for conversation in results if matchesName(conversation, query)
        ]
    return Response([summary(conversation, user) for conversation in results])


@api_view(["GET", "POST"])
def recruiter_conversations(request: Request) -> Response:
    if request.method == "POST":
        return create_recruiter_conversation(request)
    user: User = request.user
    # Réservé aux recruteurs : chacun ne voit que ses conversations, pas celles de ses
    # collègues de la même entreprise. Recherche et démarrage d'une conversation : JOB-041
    if user.role != Role.RECRUITER:
        return Response({"error": "Forbidden"}, status=403)

    conversations = Conversation.objects.filter(recruiter__user=user).select_related(
        "student__user"
    )
    query = request.query_params.get("q", "").strip()
    results = withLastMessage(conversations)
    if query:
        # Même normalisation que la recherche des conversations côté étudiant.
        results = [
            conversation
            for conversation in results
            if all(
                normalize(word)
                in normalize(
                    f"{conversation.student.user.first_name} {conversation.student.user.last_name}"
                )
                for word in query.split()
            )
        ]
    return Response([candidateSummary(conversation, user) for conversation in results])


@api_view(["GET"])
def recruiter_conversation_recipients(request: Request) -> Response:
    user: User = request.user
    if user.role != Role.RECRUITER or not Recruiter.objects.filter(user=user).exists():
        return Response({"error": "Forbidden"}, status=403)

    query = request.query_params.get("q", "").strip()
    if len(query) < 2:
        return Response([])

    # visibleStudents() is the project's existing access boundary for recruiter
    # candidate profiles: active student accounts only. Do not broaden this to
    # inactive accounts or users without a Student profile.
    students = (
        Student.objects.filter(user__is_active=True, user__role=Role.STUDENT)
        .select_related("user")
        .annotate(
            has_conversation=Exists(
                Conversation.objects.filter(
                    student_id=OuterRef("pk"), recruiter__user=user
                )
            )
        )
        .order_by("user__first_name", "user__last_name", "user_id")
    )

    words = [normalize(word) for word in query.split()]
    recipients = []
    for student in students:
        name = normalize(f"{student.user.first_name} {student.user.last_name}")
        if all(word in name for word in words):
            recipients.append(
                {
                    "id": student.user_id,
                    "first_name": student.user.first_name,
                    "last_name": student.user.last_name,
                    "has_conversation": student.has_conversation,
                }
            )
            if len(recipients) == 20:
                break
    return Response(recipients)


def create_recruiter_conversation(request: Request) -> Response:
    user: User = request.user
    if user.role != Role.RECRUITER:
        return Response({"error": "Forbidden"}, status=403)
    recruiter = Recruiter.objects.filter(user=user).first()
    if recruiter is None:
        return Response({"error": "Forbidden"}, status=403)

    candidate_id = request.data.get("candidate_id")
    # bool is an int subclass in Python; reject it explicitly.
    if (
        isinstance(candidate_id, bool)
        or not isinstance(candidate_id, int)
        or candidate_id <= 0
    ):
        return Response({"error": "Invalid candidate_id"}, status=400)

    student = (
        Student.objects.filter(
            user_id=candidate_id, user__is_active=True, user__role=Role.STUDENT
        )
        .select_related("user")
        .first()
    )
    if student is None:
        # Same response for missing and inaccessible candidates to avoid enumeration.
        return Response({"error": "Candidate not found"}, status=404)

    # get_or_create uses an atomic insert and retries the lookup after a unique-key
    # collision, so concurrent requests converge on the same conversation.
    conversation, created = Conversation.objects.get_or_create(
        student=student, recruiter=recruiter
    )

    return Response(
        {
            "id": conversation.pk,
            "created": created,
            "candidate": {
                "id": student.user_id,
                "first_name": student.user.first_name,
                "last_name": student.user.last_name,
            },
        },
        status=201 if created else 200,
    )


def attachmentDict(message: Message) -> dict[str, Any] | None:
    # Jamais le chemin de stockage : seulement l'adresse de l'API qui contrôle l'accès
    attachment: MessageAttachment | None = getattr(message, "attachment", None)
    if attachment is None:
        return None
    return {
        "name": attachment.name,
        "size": attachment.size,
        "extension": os.path.splitext(attachment.name)[1].removeprefix(".").lower(),
        "url": f"/api/conversations/{message.conversation_id}/messages/{message.pk}/attachment",
    }


def messageDict(message: Message, viewer: User) -> dict[str, Any]:
    return {
        "id": message.pk,
        "body": message.body,
        "created_at": message.created_at,
        "from_me": message.sender_id == viewer.pk,
        "attachment": attachmentDict(message),
    }


def canAttach(conversation: Conversation, user: User) -> bool:
    # Seul le recruteur de la conversation joint des fichiers : ni l'étudiant ni l'école
    return (
        user.role == Role.RECRUITER
        and conversation.recruiter is not None
        and conversation.recruiter.user_id == user.pk
    )


def messagesPage(
    conversation: Conversation, page: MessagePage
) -> tuple[list[Message], bool]:
    messages = Message.objects.filter(conversation=conversation).select_related(
        "attachment"
    )
    if page.after is not None:
        found = list(
            messages.filter(pk__gt=page.after).order_by("pk")[: page.limit + 1]
        )
        return found[: page.limit], len(found) > page.limit
    if page.before is not None:
        messages = messages.filter(pk__lt=page.before)
    found = list(messages.order_by("-pk")[: page.limit + 1])
    return found[: page.limit][::-1], len(found) > page.limit


@api_view(["GET", "POST"])
def conversation_messages(request: Request, id: int) -> Response:
    user: User = request.user
    conversation = getConversation(user, id)
    if conversation is None:
        return Response({"error": "Conversation not found"}, status=404)

    if request.method == "POST":
        files = request.FILES
        # Contrôlé pour le vérificateur de types : DRF ne type pas FILES
        upload = files.get("file") if isinstance(files, MultiValueDict) else None
        if not isinstance(upload, UploadedFile):
            upload = None
        if upload is not None and not canAttach(conversation, user):
            return Response({"error": "Forbidden"}, status=403)

        serializer: MessageSerializer = MessageSerializer(  # type: ignore
            data=request.data, context={"has_file": upload is not None}
        )
        serializer.is_valid(raise_exception=True)
        attachment = None
        if upload is not None:
            extension, refusal = attachmentRefusal(upload)
            if extension is None:
                return Response({"errors": {"file": refusal}}, status=400)
            attachment = (upload, attachmentName(upload.name or "", extension))
        try:
            message = serializer.save_message(conversation, user, attachment)
        except OSError:
            # Disque plein, droits : le message n'est pas enregistré, le recruteur peut réessayer
            return Response({"errors": {"file": STORAGE_ERROR}}, status=500)
        return Response(messageDict(message, user), status=201)

    try:
        page = MessagePage.model_validate(request.query_params.dict())
    except ValidationError:
        return Response({"error": "Invalid query"}, status=400)
    messages, has_more = messagesPage(conversation, page)
    return Response(
        {"messages": [messageDict(m, user) for m in messages], "has_more": has_more}
    )


@api_view(["GET"])
def message_attachment(
    request: Request, id: int, message_id: int
) -> Response | FileResponse:
    # Même règle que le fil : 404 pour qui ne participe pas à la conversation, sans révéler
    # qu'elle existe. Le message doit appartenir à cette conversation.
    conversation = getConversation(request.user, id)
    if conversation is None:
        return Response({"error": "Conversation not found"}, status=404)
    attachment = MessageAttachment.objects.filter(
        message_id=message_id, message__conversation=conversation
    ).first()
    if attachment is None:
        return Response({"error": "Attachment not found"}, status=404)
    try:
        file = attachment.file.open("rb")
    except FileNotFoundError:
        return Response({"error": "Attachment not found"}, status=404)

    extension = os.path.splitext(attachment.name)[1].removeprefix(".")
    response = FileResponse(
        file,
        as_attachment=True,
        filename=attachment.name,
        content_type=ATTACHMENT_TYPES.get(extension, "application/octet-stream"),
    )
    # Téléchargé, jamais affiché par le navigateur ; ni deviné, ni gardé en cache partagé
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, no-store"
    return response
