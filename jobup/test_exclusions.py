from rest_framework.test import APIClient

from .models import ApplicationStatus, Exclusion, JobApplication, Shortlist
from .test_candidates import COLLEAGUE, LIST, CandidateTestCase, detail
from .test_login import USERS


def exclude(student) -> str:
    return f"{detail(student)}/exclusion"


class ExclusionTests(CandidateTestCase):
    def ids(self) -> list[int]:
        return [card["id"] for card in self.client.get(LIST).json()]

    def test_only_recruiters(self):
        self.assertEqual(self.client.post(exclude(self.alice)).status_code, 403)
        USERS[0].login(self)
        self.assertEqual(self.client.post(exclude(self.alice)).status_code, 403)
        self.client.logout()
        USERS[2].login(self)
        self.assertEqual(self.client.post(exclude(self.alice)).status_code, 403)
        self.assertFalse(Exclusion.objects.exists())

    def test_excluded_candidate_leaves_the_deck_and_stays_out_after_reload(self):
        USERS[3].login(self)
        response = self.client.post(exclude(self.alice))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json(), {"id": self.alice.user.pk, "excluded": True})
        self.assertEqual(self.ids(), [self.bob.user.pk])
        # Après rechargement : nouvelle session du même recruteur
        self.client.logout()
        USERS[3].login(self)
        self.assertEqual(self.ids(), [self.bob.user.pk])

    def test_excluding_twice_creates_no_duplicate(self):
        USERS[3].login(self)
        self.assertEqual(self.client.post(exclude(self.alice)).status_code, 201)
        response = self.client.post(exclude(self.alice))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["excluded"])
        self.assertEqual(Exclusion.objects.count(), 1)

    def test_excluding_the_last_card_empties_the_deck(self):
        USERS[3].login(self)
        self.client.post(exclude(self.alice))
        self.client.post(exclude(self.bob))
        self.assertEqual(self.client.get(LIST).json(), [])

    def test_exclusion_is_private_to_each_recruiter(self):
        USERS[3].login(self)
        self.client.post(exclude(self.alice))
        self.client.logout()
        # Collègue de la même entreprise : sa pile n'est pas modifiée
        COLLEAGUE.login(self)
        self.assertIn(self.alice.user.pk, self.ids())
        # Et son propre 🚫 n'écarte rien pour le premier
        self.client.post(exclude(self.bob))
        self.client.logout()
        USERS[3].login(self)
        self.assertEqual(self.ids(), [self.bob.user.pk])
        self.assertEqual(Exclusion.objects.count(), 2)

    def test_unknown_or_inactive_candidate(self):
        USERS[3].login(self)
        self.assertEqual(self.client.post(f"{LIST}/999999/exclusion").status_code, 404)
        self.assertEqual(self.client.post(exclude(self.carol)).status_code, 404)
        recruiter_id = self.client.get("/api/me").json()["id"]
        self.assertEqual(
            self.client.post(f"{LIST}/{recruiter_id}/exclusion").status_code, 404
        )
        self.assertFalse(Exclusion.objects.exists())

    def test_only_post_is_allowed(self):
        USERS[3].login(self)
        for method in (self.client.get, self.client.put, self.client.delete):
            self.assertEqual(method(exclude(self.alice)).status_code, 405)

    def test_application_status_is_not_modified(self):
        application = JobApplication.objects.create(
            student=self.alice,
            offer=self.offers[0],
            status=ApplicationStatus.IN_REVIEW,
            submitted_at="2026-10-15T09:00:00Z",
        )
        USERS[3].login(self)
        self.client.post(exclude(self.alice))
        application.refresh_from_db()
        self.assertEqual(application.status, ApplicationStatus.IN_REVIEW)
        # Le profil et l'historique restent consultables
        profile = self.client.get(detail(self.alice)).json()
        self.assertEqual(len(profile["exchanges"]), 1)

    def test_shortlist_is_not_modified(self):
        USERS[3].login(self)
        self.client.post(f"{detail(self.alice)}/shortlist")
        self.assertEqual(self.client.post(exclude(self.alice)).status_code, 201)
        self.assertEqual(Shortlist.objects.count(), 1)
        self.assertEqual(len(self.client.get("/api/recruiter/shortlist").json()), 1)

    def test_csrf_token_is_required(self):
        client = APIClient(enforce_csrf_checks=True)
        token = client.get("/api/csrf").json()["csrfToken"]
        client.post(
            "/api/login",
            {"email": USERS[3].email, "password": USERS[3].password},
            format="json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(client.post(exclude(self.alice)).status_code, 403)
        token = client.get("/api/csrf").json()["csrfToken"]
        response = client.post(exclude(self.alice), HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 201)
