# API de la liste des conversations (JOB-032, ETU-07).
# Tri : la conversation la plus récemment active en premier. L'activité est la date du dernier
# message, ou la date de création pour une conversation sans message. Le résumé est calculé
# à chaque requête : il reste à jour après un envoi ou une réception (JOB-034).
from typing import Any

from django.db.models import F, OuterRef, Q, QuerySet, Subquery
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


def matchesName(query: str) -> Q:
    # Chaque mot doit apparaître dans le prénom, le nom, l'entreprise ou l'école de l'interlocuteur :
    # « léa acme » trouve « Léa Martin – Acme »
    condition = Q()
    for word in query.split():
        condition &= (
            Q(recruiter__user__first_name__icontains=word)
            | Q(recruiter__user__last_name__icontains=word)
            | Q(recruiter__company__name__icontains=word)
            | Q(school_manager__user__first_name__icontains=word)
            | Q(school_manager__user__last_name__icontains=word)
            | Q(school_manager__school__name__icontains=word)
        )
    return condition


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
    if query:
        conversations = conversations.filter(matchesName(query))
    return Response(
        [summary(conversation, user) for conversation in withLastMessage(conversations)]
    )
