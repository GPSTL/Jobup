from rest_framework.test import APIClient

from .models import Shortlist
from .test_candidates import COLLEAGUE, LIST, CandidateTestCase, detail
from .test_login import USERS

SHORTLIST = "/api/recruiter/shortlist"


def keep(student) -> str:
    return f"{detail(student)}/shortlist"


class ShortlistTests(CandidateTestCase):
    def ids(self, url: str) -> list[int]:
        return [card["id"] for card in self.client.get(url).json()]

    def test_only_recruiters(self):
        self.assertOnlyRecruiters(SHORTLIST)
        for method in (self.client.post, self.client.delete):
            self.client.logout()
            self.assertEqual(method(keep(self.alice)).status_code, 403)
            USERS[0].login(self)
            self.assertEqual(method(keep(self.alice)).status_code, 403)
        self.assertFalse(Shortlist.objects.exists())

    def test_keep_adds_the_candidate_to_the_shortlist(self):
        USERS[3].login(self)
        response = self.client.post(keep(self.alice))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["id"], self.alice.user.pk)
        self.assertIsNone(response.json()["offer"])
        shortlisted = self.client.get(SHORTLIST).json()
        self.assertEqual([card["id"] for card in shortlisted], [self.alice.user.pk])
        # Même contenu qu'une carte, plus la date
        self.assertEqual(shortlisted[0]["school"], "Université Paris Nanterre")
        self.assertIn("shortlisted_at", shortlisted[0])

    def test_keeping_twice_creates_no_duplicate(self):
        USERS[3].login(self)
        self.assertEqual(self.client.post(keep(self.alice)).status_code, 201)
        self.assertEqual(self.client.post(keep(self.alice)).status_code, 200)
        self.assertEqual(Shortlist.objects.count(), 1)

    def test_most_recently_kept_first(self):
        USERS[3].login(self)
        self.client.post(keep(self.alice))
        self.client.post(keep(self.bob))
        self.assertEqual(self.ids(SHORTLIST), [self.bob.user.pk, self.alice.user.pk])

    def test_kept_candidate_leaves_the_deck_but_keeps_a_profile(self):
        USERS[3].login(self)
        self.client.post(keep(self.alice))
        self.assertEqual(self.ids(LIST), [self.bob.user.pk])
        # « Voir le profil » depuis les candidats retenus
        self.assertEqual(self.client.get(detail(self.alice)).status_code, 200)

    def test_keeping_the_last_card_empties_the_deck(self):
        USERS[3].login(self)
        self.client.post(keep(self.bob))
        self.client.post(keep(self.alice))
        self.assertEqual(self.client.get(LIST).json(), [])
        self.assertEqual(len(self.client.get(SHORTLIST).json()), 2)

    def test_shortlist_is_private_to_each_recruiter(self):
        USERS[3].login(self)
        self.client.post(keep(self.alice))
        self.client.logout()
        # Collègue de la même entreprise : ni ses favoris, ni sa pile ne sont touchés
        COLLEAGUE.login(self)
        self.assertEqual(self.client.get(SHORTLIST).json(), [])
        self.assertIn(self.alice.user.pk, self.ids(LIST))
        # Retirer ne touche que sa propre présélection
        self.assertEqual(self.client.delete(keep(self.alice)).status_code, 204)
        self.assertEqual(Shortlist.objects.count(), 1)

    def test_remove_from_the_shortlist(self):
        USERS[3].login(self)
        self.client.post(keep(self.alice))
        self.assertEqual(self.client.delete(keep(self.alice)).status_code, 204)
        self.assertEqual(self.client.get(SHORTLIST).json(), [])
        # De retour dans la pile de cartes
        self.assertIn(self.alice.user.pk, self.ids(LIST))
        # Retirer un candidat déjà retiré n'est pas une erreur
        self.assertEqual(self.client.delete(keep(self.alice)).status_code, 204)

    def test_unknown_or_inactive_candidate(self):
        USERS[3].login(self)
        self.assertEqual(self.client.post(f"{LIST}/999999/shortlist").status_code, 404)
        self.assertEqual(self.client.post(keep(self.carol)).status_code, 404)
        # Un compte qui n'est pas étudiant
        recruiter_id = self.client.get("/api/me").json()["id"]
        self.assertEqual(
            self.client.post(f"{LIST}/{recruiter_id}/shortlist").status_code, 404
        )
        self.assertFalse(Shortlist.objects.exists())

    def test_deactivated_student_leaves_the_shortlist(self):
        USERS[3].login(self)
        self.client.post(keep(self.alice))
        self.alice.user.is_active = False
        self.alice.user.save()
        self.assertEqual(self.client.get(SHORTLIST).json(), [])

    def test_csrf_token_is_required(self):
        # Comme dans le navigateur : la session est ouverte, le jeton est exigé
        client = APIClient(enforce_csrf_checks=True)
        token = client.get("/api/csrf").json()["csrfToken"]
        client.post(
            "/api/login",
            {"email": USERS[3].email, "password": USERS[3].password},
            format="json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(client.post(keep(self.alice)).status_code, 403)
        token = client.get("/api/csrf").json()["csrfToken"]
        response = client.post(keep(self.alice), HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 201)
