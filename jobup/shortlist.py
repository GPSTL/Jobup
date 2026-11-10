# Présélection du recruteur (JOB-037, REC-03) : retenir un candidat avec ♥, le retirer,
# et retrouver la liste des candidats retenus. Contrat avec le front : docs/api/candidates.md
from typing import Any

from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .candidates import candidateCard, getCandidate, isRecruiter
from .models import Recruiter, Shortlist, User


def ownRecruiter(user: User) -> Recruiter | None:
    # Profil recruteur du compte connecté : chacun ne voit et ne modifie que sa présélection
    if not isRecruiter(user):
        return None
    return Recruiter.objects.filter(user=user).first()


def shortlistItem(entry: Shortlist) -> dict[str, Any]:
    offer = entry.offer
    return {
        **candidateCard(entry.student),
        "shortlisted_at": entry.created_at,
        # Toujours null tant qu'aucun écran ne permet de choisir l'offre (JOB-036)
        "offer": {"id": offer.pk, "title": offer.title} if offer else None,
    }


@api_view(["GET"])
def shortlist(request: Request) -> Response:
    recruiter = ownRecruiter(request.user)
    if recruiter is None:
        return Response({"error": "Forbidden"}, status=403)
    # Le plus récemment retenu en premier ; un compte étudiant désactivé n'apparaît plus
    entries = (
        Shortlist.objects.filter(recruiter=recruiter, student__user__is_active=True)
        .select_related("student__user", "student__school", "offer")
        .order_by("-created_at", "-pk")
    )
    return Response([shortlistItem(entry) for entry in entries])


@api_view(["POST", "DELETE"])
def shortlist_candidate(request: Request, id: int) -> Response:
    recruiter = ownRecruiter(request.user)
    if recruiter is None:
        return Response({"error": "Forbidden"}, status=403)

    if request.method == "DELETE":
        # « Retirer » : sans effet si le candidat n'était pas retenu, pour qu'un double clic ne soit pas une erreur
        Shortlist.objects.filter(recruiter=recruiter, student__user_id=id).delete()
        return Response(status=204)

    target = getCandidate(id)
    if target is None:
        return Response({"error": "Candidate not found"}, status=404)
    # ♥ répété : pas de doublon, la présélection existante est renvoyée
    entry, created = Shortlist.objects.get_or_create(
        recruiter=recruiter, student=target
    )
    return Response(shortlistItem(entry), status=201 if created else 200)
