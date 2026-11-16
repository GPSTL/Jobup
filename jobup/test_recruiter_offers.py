from django.utils import timezone

from .models import ApplicationStatus, JobApplication, Role, User
from .test_candidates import COLLEAGUE, CandidateTestCase
from .test_login import USERS

LIST = "/api/recruiter/offers"


class RecruiterOfferTests(CandidateTestCase):
    def applicants(self, offer=None):
        return f"{LIST}/{(offer or self.offers[0]).pk}/applicants"

    def test_only_recruiters(self):
        for url in (LIST, self.applicants()):
            self.client.logout()
            self.assertOnlyRecruiters(url)
        manager = User.objects.create_user(
            **USERS[0].fork(email="school@mail.fr", role=Role.MANAGER)
        )
        self.client.force_authenticate(manager)
        for url in (LIST, self.applicants()):
            self.assertEqual(self.client.get(url).status_code, 403)

    def test_list_scoped_to_owner_and_counts_only_submitted_applications(self):
        self.sent(self.offers[0], 1)
        JobApplication.objects.create(student=self.bob, offer=self.offers[0])
        self.sent(self.colleague_offer, 1)
        USERS[3].login(self)
        response = self.client.get(LIST)
        self.assertEqual(response.status_code, 200)
        offers = response.json()
        self.assertEqual(
            [offer["id"] for offer in offers], [o.pk for o in reversed(self.offers)]
        )
        self.assertEqual([offer["applicant_count"] for offer in offers], [0, 0, 1])
        self.assertEqual(offers[-1]["title"], self.offers[0].title)
        self.assertEqual(offers[-1]["description"], "Description")
        self.assertTrue(offers[-1]["is_active"])
        self.assertIn("created_at", offers[-1])

    def test_other_offer_same_company_and_missing_offer_are_indistinguishable(self):
        USERS[3].login(self)
        foreign = self.client.get(self.applicants(self.colleague_offer))
        missing = self.client.get(f"{LIST}/999999/applicants")
        self.assertEqual(foreign.status_code, 404)
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(foreign.json(), missing.json())
        COLLEAGUE.login(self)
        self.assertEqual(self.client.get(self.applicants()).status_code, 404)

    def test_real_applicants_only_newest_first_and_read_does_not_change_status(self):
        older = self.sent(self.offers[0], 2)
        newer = JobApplication.objects.create(
            student=self.bob,
            offer=self.offers[0],
            status=ApplicationStatus.READ,
            submitted_at=timezone.now(),
        )
        self.sent(self.offers[1], 1)
        self.sent(self.colleague_offer, 0)
        USERS[3].login(self)
        response = self.client.get(self.applicants())
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["offer"]["id"], self.offers[0].pk)
        self.assertEqual([a["id"] for a in data["applications"]], [newer.pk, older.pk])
        candidate = data["applications"][1]["candidate"]
        self.assertEqual(candidate["id"], self.alice.user.pk)
        self.assertEqual(candidate["school"], self.alice.school.name)
        self.assertEqual(
            candidate["cv_url"], f"/api/recruiter/candidates/{self.alice.user.pk}/cv"
        )
        self.assertNotIn("email", candidate)
        self.assertIsNotNone(data["applications"][0]["submitted_at"])
        older.refresh_from_db()
        newer.refresh_from_db()
        self.assertEqual(older.status, ApplicationStatus.SUBMITTED)
        self.assertEqual(newer.status, ApplicationStatus.READ)

    def test_empty_offer_and_drafts_never_exposed(self):
        # Both conditions are required, including an inconsistent draft with a date.
        JobApplication.objects.create(student=self.alice, offer=self.offers[0])
        JobApplication.objects.create(
            student=self.bob, offer=self.offers[0], submitted_at=timezone.now()
        )
        USERS[3].login(self)
        for offer in self.offers:
            response = self.client.get(self.applicants(offer))
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["applications"], [])
        self.assertTrue(
            all(offer["applicant_count"] == 0 for offer in self.client.get(LIST).json())
        )

    def test_final_applications_and_closed_offers_stay_visible(self):
        application = self.sent(self.offers[0], 1)
        application.status = ApplicationStatus.ACCEPTED
        application.save()
        self.offers[0].is_active = False
        self.offers[0].save()
        USERS[3].login(self)
        data = self.client.get(self.applicants()).json()
        self.assertFalse(data["offer"]["is_active"])
        self.assertEqual(data["applications"][0]["status"], ApplicationStatus.ACCEPTED)
        self.assertEqual(self.client.get(LIST).json()[-1]["applicant_count"], 1)
        application.status = ApplicationStatus.REFUSED
        application.save()
        self.assertEqual(
            self.client.get(self.applicants()).json()["applications"][0]["status"],
            ApplicationStatus.REFUSED,
        )

    def test_recruiter_without_profile_has_no_offers(self):
        user = User.objects.create_user(**USERS[3].fork(email="new@recruiter.fr"))
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get(LIST).json(), [])
        self.assertEqual(self.client.get(self.applicants()).status_code, 404)

    def test_no_writes(self):
        USERS[3].login(self)
        for url in (LIST, self.applicants()):
            self.assertEqual(self.client.post(url, {}).status_code, 405)
