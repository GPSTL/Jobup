# Notifications (JOB-042, ETU-28) : le socle commun (création sans doublon, préférences,
# e-mail) et son API, réutilisés par les recruteurs (JOB-046, REC-32) et les écoles (ECO-21).
# Les événements sont branchés dans models.py. Contrat : docs/api/notifications.md
import logging
from datetime import datetime
from typing import Any

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from pydantic import BaseModel, Field, ValidationError
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .conversations import interlocutor
from .models import (
    ApplicationStatus,
    Contract,
    ContractStage,
    JobApplication,
    Message,
    Notification,
    NotificationKind,
    NotificationPreference,
    Role,
    School,
    SchoolManager,
    SchoolRequest,
    SchoolRequestStatus,
    Student,
    User,
)

logger = logging.getLogger(__name__)

# Longueur de l'extrait du message cité dans la notification
PREVIEW_LENGTH = 120


def preferencesOf(user: User) -> NotificationPreference:
    # E-mail initial de la maquette de chaque rôle : désactivé pour l'étudiant,
    # activé pour le recruteur
    return NotificationPreference.objects.get_or_create(
        user=user, defaults={"email": user.role == Role.RECRUITER}
    )[0]


def sendEmail(notification: Notification) -> None:
    # L'e-mail double la notification, il ne la remplace pas : un échec d'envoi est
    # seulement journalisé, la notification reste dans l'application
    link = f"{settings.SITE_URL}{notification.link}" if notification.link else ""
    try:
        send_mail(
            f"JobUp — {notification.title}",
            "\n\n".join(part for part in (notification.body, link) if part),
            None,
            [notification.recipient.email],
        )
    except Exception:  # noqa: BLE001
        logger.exception("E-mail of notification %s not sent", notification.pk)


def notify(
    recipient: User,
    kind: NotificationKind,
    event: str,
    title: str,
    body: str = "",
    link: str = "",
) -> Notification | None:
    # Point d'entrée du socle. event identifie l'événement d'origine : le même événement ne
    # crée jamais deux notifications pour un même destinataire. None si elle existait déjà,
    # ou si le compte est désactivé : il n'a plus accès à l'application.
    if not recipient.is_active:
        return None
    notification, created = Notification.objects.get_or_create(
        recipient=recipient,
        event=event,
        defaults={"kind": kind, "title": title, "body": body, "link": link},
    )
    if not created:
        return None
    if preferencesOf(recipient).email:
        sendEmail(notification)
    return notification


def excerpt(text: str) -> str:
    text = " ".join(text.split())
    if len(text) <= PREVIEW_LENGTH:
        return text
    return text[: PREVIEW_LENGTH - 1].rstrip() + "…"


def messagePreview(message: Message) -> str:
    # Début du texte, ou le nom du fichier d'un message qui ne contient qu'une pièce jointe
    attachment = getattr(message, "attachment", None)
    if message.body:
        return f"« {excerpt(message.body)} »"
    if attachment is not None:
        return f"Pièce jointe : {attachment.name}"
    return ""


def notifyNewMessage(message_id: int) -> Notification | None:
    # Nouveau message pour l'autre participant de la conversation, le seul qui y a accès :
    # l'étudiant quand le recruteur ou l'école écrit (JOB-042), le recruteur ou l'employé
    # d'école de la conversation quand l'étudiant écrit (JOB-046).
    message = (
        Message.objects.select_related(
            "attachment",
            "conversation__student__user",
            "conversation__recruiter__user",
            "conversation__recruiter__company",
            "conversation__school_manager__user",
            "conversation__school_manager__school",
        )
        .filter(pk=message_id)
        .first()
    )
    if message is None:
        return None
    conversation = message.conversation
    student = conversation.student.user
    if message.sender_id == student.pk:
        if conversation.school_manager is not None:
            return notifyManagerOfMessage(message)
        return notifyRecruiterOfMessage(message)
    if not preferencesOf(student).messages:
        return None

    person = interlocutor(conversation)
    return notify(
        student,
        NotificationKind.MESSAGE,
        f"message:{message.pk}",
        f"Nouveau message de {person['first_name']} {person['last_name']} – {person['organization']}",
        messagePreview(message),
        f"/messages/{conversation.pk}",
    )


def notifyRecruiterOfMessage(message: Message) -> Notification | None:
    # Message de l'étudiant : seul le recruteur de la conversation la voit (JOB-039), jamais
    # ses collègues de l'entreprise
    conversation = message.conversation
    if conversation.recruiter is None:
        return None
    recruiter = conversation.recruiter.user
    if not preferencesOf(recruiter).messages:
        return None
    student = conversation.student.user
    return notify(
        recruiter,
        NotificationKind.MESSAGE,
        f"message:{message.pk}",
        f"Nouveau message de {student.first_name} {student.last_name}",
        messagePreview(message),
        f"/recruiter/messages/{conversation.pk}",
    )


def notifyManagerOfMessage(message: Message) -> Notification | None:
    # Message de l'étudiant : seul l'employé d'école de la conversation le voit
    manager = message.conversation.school_manager
    if manager is None or not preferencesOf(manager.user).messages:
        return None
    student = message.conversation.student.user
    return notify(
        manager.user,
        NotificationKind.MESSAGE,
        f"message:{message.pk}",
        f"Nouveau message de {student.first_name} {student.last_name}",
        messagePreview(message),
        f"/school/messages/{message.conversation_id}",
    )


def notifyStatusChange(application_id: int, status: int) -> Notification | None:
    # L'envoi (SUBMITTED) est l'action de l'étudiant : il notifie le recruteur (JOB-046).
    # Les statuts suivants sont décidés côté entreprise : ils notifient l'étudiant (JOB-042).
    # « Lue » et « en cours d'étude » s'affichent tous deux « En cours d'étude » : le même
    # événement, donc une seule notification.
    application = (
        JobApplication.objects.select_related(
            "student__user", "offer__recruiter__user", "offer__recruiter__company"
        )
        .filter(pk=application_id)
        .first()
    )
    if application is None:
        return None
    if status == ApplicationStatus.SUBMITTED:
        return notifyNewApplication(application)
    student = application.student.user
    if not preferencesOf(student).application_status:
        return None

    title = application.offer.title
    company = application.offer.recruiter.company.name
    if status in (ApplicationStatus.READ, ApplicationStatus.IN_REVIEW):
        kind, step = NotificationKind.APPLICATION_UPDATE, "review"
        heading = "Candidature mise à jour"
        body = f"« {title} » chez {company} est passée en « En cours d’étude »."
    elif status == ApplicationStatus.ACCEPTED:
        kind, step = NotificationKind.APPLICATION_ACCEPTED, "accepted"
        heading = "Candidature acceptée !"
        body = f"{company} a accepté votre candidature « {title} »."
    elif status == ApplicationStatus.REFUSED:
        kind, step = NotificationKind.APPLICATION_REFUSED, "refused"
        heading = "Candidature refusée"
        body = f"{company} n’a pas retenu votre candidature « {title} »."
    else:
        return None
    if (
        status in (ApplicationStatus.ACCEPTED, ApplicationStatus.REFUSED)
        and application.decision_message
    ):
        body = (
            f"{body}\n\nMessage du recruteur : " + excerpt(application.decision_message)
        )[:300]
    return notify(
        student,
        kind,
        f"application:{application.pk}:{step}",
        heading,
        body,
        f"/applications/{application.pk}",
    )


def notifyNewApplication(application: JobApplication) -> Notification | None:
    # Candidature reçue : seul l'auteur de l'offre la voit (JOB-040), jamais ses collègues de
    # l'entreprise. Le lien ouvre le profil du candidat pour cette offre, comme « Voir » dans
    # la liste des candidatures de l'offre.
    recruiter = application.offer.recruiter.user
    if not preferencesOf(recruiter).new_applications:
        return None
    candidate = application.student.user
    return notify(
        recruiter,
        NotificationKind.NEW_APPLICATION,
        f"application:{application.pk}:submitted",
        "Nouvelle candidature",
        f"{candidate.first_name} {candidate.last_name} a postulé à « {application.offer.title} ».",
        f"/recruiter/candidates/{candidate.pk}?offer={application.offer.pk}",
    )


def notifySchoolRequest(request_id: int) -> None:
    # Demande de rattachement : tous les employés de l'école la voient
    request = (
        SchoolRequest.objects.select_related("student__user", "school")
        .filter(pk=request_id)
        .first()
    )
    if request is None:
        return
    student = request.student.user
    for manager in SchoolManager.objects.filter(school=request.school).select_related(
        "user"
    ):
        if preferencesOf(manager.user).school_updates:
            notify(
                manager.user,
                NotificationKind.SCHOOL_REQUEST,
                f"school-request:{request.pk}",
                "Nouvelle demande de rattachement",
                f"{student.first_name} {student.last_name} souhaite être rattaché(e) à {request.school.name}.",
                "/school/students",
            )


def notifySchoolRequestDecision(request_id: int) -> Notification | None:
    request = (
        SchoolRequest.objects.select_related("student__user", "school")
        .filter(pk=request_id)
        .first()
    )
    if request is None or request.status == SchoolRequestStatus.PENDING:
        return None
    student = request.student.user
    if not preferencesOf(student).school_updates:
        return None
    accepted = request.status == SchoolRequestStatus.ACCEPTED
    return notify(
        student,
        NotificationKind.SCHOOL_REQUEST,
        f"school-request:{request.pk}:{'accepted' if accepted else 'refused'}",
        "Rattachement accepté" if accepted else "Rattachement refusé",
        (
            f"{request.school.name} a accepté votre demande."
            if accepted
            else f"{request.school.name} n’a pas accepté votre demande."
        ),
        "/student#school",
    )


def notifySchoolRemoval(
    student_id: int, school_id: int, removed_at: datetime
) -> Notification | None:
    # Retrait par l'école (JOB-049) : l'étudiant l'apprend et peut choisir une autre école
    student = Student.objects.select_related("user").filter(pk=student_id).first()
    school = School.objects.filter(pk=school_id).first()
    if student is None or school is None:
        return None
    if not preferencesOf(student.user).school_updates:
        return None
    return notify(
        student.user,
        NotificationKind.SCHOOL_REQUEST,
        f"school-removal:{school.pk}:{student.pk}:{removed_at.isoformat()}",
        "Retiré du suivi de votre école",
        f"{school.name} ne suit plus votre recherche d’alternance. Vous pouvez demander un nouveau rattachement depuis Mon espace.",
        "/student#school",
    )


def notifyContract(contract_id: int, stage: int) -> None:
    # Contrat déposé : l'étudiant le suit, l'école doit le valider. Validé puis signé :
    # l'étudiant en est informé, l'école étant celle qui l'a fait avancer.
    contract = (
        Contract.objects.select_related(
            "student__user", "company", "school", "application__offer"
        )
        .filter(pk=contract_id)
        .first()
    )
    if contract is None or contract.application is None:
        return
    student = contract.student.user
    title = contract.application.offer.title
    event = f"contract:{contract.pk}:{stage}"
    link = f"/applications/{contract.application.pk}"
    if stage == ContractStage.DEPOSITED:
        for manager in SchoolManager.objects.filter(
            school=contract.school
        ).select_related("user"):
            if preferencesOf(manager.user).school_updates:
                notify(
                    manager.user,
                    NotificationKind.CONTRACT_UPDATE,
                    event,
                    "Nouveau contrat à valider",
                    f"{contract.company.name} a déposé le contrat de {student.first_name} {student.last_name} (« {title} »).",
                    "/school/contracts",
                )
        heading = "Contrat déposé"
        body = f"{contract.company.name} a déposé votre contrat « {title} » : {contract.school.name} doit maintenant le valider."
    elif stage == ContractStage.VALIDATED:
        heading = "Contrat validé par votre école"
        body = f"{contract.school.name} a validé votre contrat « {title} » : il ne reste que la signature."
    else:
        heading = "Contrat signé !"
        body = f"Votre contrat « {title} » chez {contract.company.name} est signé."
    if preferencesOf(student).school_updates:
        notify(student, NotificationKind.CONTRACT_UPDATE, event, heading, body, link)


# ----- API ----- #


class NotificationPage(BaseModel):
    before: int | None = None
    limit: int = Field(default=20, ge=1, le=50)


class PreferencesSerializer(serializers.Serializer):
    # Modification partielle : seuls les champs envoyés changent
    messages = serializers.BooleanField(required=False)
    application_status = serializers.BooleanField(required=False)
    new_applications = serializers.BooleanField(required=False)
    school_updates = serializers.BooleanField(required=False)
    email = serializers.BooleanField(required=False)


def notificationDict(notification: Notification) -> dict[str, Any]:
    return {
        "id": notification.pk,
        "kind": notification.kind,
        "title": notification.title,
        "body": notification.body,
        "link": notification.link,
        "created_at": notification.created_at,
        "read": notification.read_at is not None,
    }


def preferencesDict(preferences: NotificationPreference) -> dict[str, bool]:
    return {
        "messages": preferences.messages,
        "application_status": preferences.application_status,
        "new_applications": preferences.new_applications,
        "school_updates": preferences.school_updates,
        "email": preferences.email,
    }


def unreadCount(user: User) -> int:
    return Notification.objects.filter(recipient=user, read_at__isnull=True).count()


@api_view(["GET"])
def notification_list(request: Request) -> Response:
    # Chaque utilisateur ne lit que les siennes, de la plus récente à la plus ancienne
    user: User = request.user
    try:
        page = NotificationPage.model_validate(request.query_params.dict())
    except ValidationError:
        return Response({"error": "Invalid query"}, status=400)
    notifications = Notification.objects.filter(recipient=user).order_by("-pk")
    if page.before is not None:
        notifications = notifications.filter(pk__lt=page.before)
    found = list(notifications[: page.limit + 1])
    return Response(
        {
            "notifications": [notificationDict(n) for n in found[: page.limit]],
            "has_more": len(found) > page.limit,
            "unread_count": unreadCount(user),
        }
    )


@api_view(["GET"])
def notification_unread_count(request: Request) -> Response:
    # Pour la pastille de la barre de navigation, interrogée régulièrement
    return Response({"unread_count": unreadCount(request.user)})


@api_view(["POST"])
def notification_read(request: Request, id: int) -> Response:
    # 404 pour la notification d'un autre utilisateur, sans révéler qu'elle existe
    user: User = request.user
    notification = Notification.objects.filter(pk=id, recipient=user).first()
    if notification is None:
        return Response({"error": "Notification not found"}, status=404)
    if notification.read_at is None:
        notification.read_at = timezone.now()
        notification.save(update_fields=["read_at"])
    return Response(
        {
            "notification": notificationDict(notification),
            "unread_count": unreadCount(user),
        }
    )


@api_view(["POST"])
def notification_read_all(request: Request) -> Response:
    user: User = request.user
    Notification.objects.filter(recipient=user, read_at__isnull=True).update(
        read_at=timezone.now()
    )
    return Response({"unread_count": 0})


@api_view(["GET", "PUT"])
def notification_preferences(request: Request) -> Response:
    preferences = preferencesOf(request.user)
    if request.method == "PUT":
        serializer = PreferencesSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"errors": serializer.errors}, status=400)
        for field, value in serializer.validated_data.items():  # type: ignore[union-attr]
            setattr(preferences, field, value)
        preferences.save()
    return Response(preferencesDict(preferences))
