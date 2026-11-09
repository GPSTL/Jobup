# API de la liste des conversations (JOB-032, ETU-07).
# Tri : la conversation la plus récemment active en premier. L'activité est la date du dernier
# message, ou la date de création pour une conversation sans message. Le résumé est calculé
# à chaque requête : il reste à jour après un envoi ou une réception (JOB-034).
import unicodedata
from typing import Any

from django.db.models import F, OuterRef, QuerySet, Subquery
from django.db.models.functions import Coalesce
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .models import Conversation, Message, Role, User


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


def summary(conversation: Conversation, viewer: User) -> dict[str, Any]:
    last = None
    if conversation.last_at is not None:
        last = {
            "body": conversation.last_body,
            "created_at": conversation.last_at,
            "from_me": conversation.last_sender == viewer.pk,
        }
    return {
        "id": conversation.pk,
        "interlocutor": interlocutor(conversation),
        "last_message": last,
        "created_at": conversation.created_at,
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
