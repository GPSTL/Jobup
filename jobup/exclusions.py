# Candidats écartés par le recruteur (JOB-038, REC-04) : 🚫 sur une carte retire le candidat de
# sa pile. Contrat avec le front : docs/api/candidates.md
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .candidates import getCandidate
from .models import Exclusion
from .shortlist import ownRecruiter


@api_view(["POST"])
def exclude_candidate(request: Request, id: int) -> Response:
    recruiter = ownRecruiter(request.user)
    if recruiter is None:
        return Response({"error": "Forbidden"}, status=403)

    target = getCandidate(id)
    if target is None:
        return Response({"error": "Candidate not found"}, status=404)
    # 🚫 répété (double clic, nouvel essai après une erreur réseau) : pas de doublon, pas d'erreur.
    # Seule la ligne Exclusion est écrite : les candidatures et la présélection ne changent pas.
    _, created = Exclusion.objects.get_or_create(recruiter=recruiter, student=target)
    return Response(
        {"id": target.user_id, "excluded": True}, status=201 if created else 200
    )
