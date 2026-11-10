# API de la liste des conversations (JOB-032, ETU-07).
# Tri : la conversation la plus récemment active en premier. L'activité est la date du dernier
# message, ou la date de création pour une conversation sans message. Le résumé est calculé
# à chaque requête : il reste à jour après un envoi ou une réception (JOB-034).
# Fil de messages et envoi (JOB-034, ETU-15), communs à tous les participants ; contrat réutilisé par JOB-039.
# Liste des conversations du recruteur avec la présence des candidats (JOB-039, REC-05) :
# docs/api/recruiter-conversations.md
import unicodedata
from typing import Any, Self

from django.db.models import F, OuterRef, Q, QuerySet, Subquery
from django.db.models.functions import Coalesce
from pydantic import BaseModel, Field, ValidationError, model_validator
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .models import Conversation, Message, MessageSerializer, Role, User
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
    if conversation.recruiter is not None:
        person, kind, organization = (
            conversation.recruiter.user,
            "recruiter",
            conversation.recruiter.company.name,
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


@api_view(["GET"])
def recruiter_conversations(request: Request) -> Response:
    user: User = request.user
    # Réservé aux recruteurs : chacun ne voit que ses conversations, pas celles de ses
    # collègues de la même entreprise. Recherche et démarrage d'une conversation : JOB-041
    if user.role != Role.RECRUITER:
        return Response({"error": "Forbidden"}, status=403)

    conversations = Conversation.objects.filter(recruiter__user=user).select_related(
        "student__user"
    )
    return Response(
        [
            candidateSummary(conversation, user)
            for conversation in withLastMessage(conversations)
        ]
    )


def messageDict(message: Message, viewer: User) -> dict[str, Any]:
    return {
        "id": message.pk,
        "body": message.body,
        "created_at": message.created_at,
        "from_me": message.sender_id == viewer.pk,
    }


def messagesPage(
    conversation: Conversation, page: MessagePage
) -> tuple[list[Message], bool]:
    messages = Message.objects.filter(conversation=conversation)
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
        serializer: MessageSerializer = MessageSerializer(data=request.data)  # type: ignore
        serializer.is_valid(raise_exception=True)
        return Response(
            messageDict(serializer.save_message(conversation, user), user), status=201
        )

    try:
        page = MessagePage.model_validate(request.query_params.dict())
    except ValidationError:
        return Response({"error": "Invalid query"}, status=400)
    messages, has_more = messagesPage(conversation, page)
    return Response(
        {"messages": [messageDict(m, user) for m in messages], "has_more": has_more}
    )
