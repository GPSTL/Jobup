from datetime import datetime, timedelta

from django.utils import timezone

from .interviews import MAX_SLOTS
from .models import (
    ApplicationStatus,
    Company,
    Interview,
    InterviewSlot,
    JobApplication,
    NotificationKind,
    NotificationPreference,
    Offer,
    JobCategory,
    Recruiter,
    Role,
    Student,
)
from .notifications import frenchDateTime
from .test_login import USERS
from .test_school import SchoolTestCase

STUDENT_APPLICATIONS = "/api/applications"


def at(days: int, hour: int, minute: int = 0) -> datetime:
    # Heure ronde dans `days` jours, à l'heure de Paris
    day = timezone.localtime() + timedelta(days=days)
    return day.replace(hour=hour, minute=minute, second=0, microsecond=0)


def slot(start: datetime, minutes: int = 60) -> dict[str, str]:
    return {
        "starts_at": start.isoformat(),
        "ends_at": (start + timedelta(minutes=minutes)).isoformat(),
    }


def parse(value: str) -> datetime:
    return datetime.fromisoformat(value)


class InterviewTestCase(SchoolTestCase):
    def setUp(self):
        super().setUp()
        self.application = self.apply(self.alice, ApplicationStatus.IN_REVIEW)

    def proposeUrl(self, application: JobApplication) -> str:
        return f"/api/recruiter/applications/{application.pk}/interview"

    def chooseUrl(self, application: JobApplication) -> str:
        return f"{STUDENT_APPLICATIONS}/{application.pk}/interview"

    def propose(self, application=None, slots=None, recruiter=None, **fields):
        application = application or self.application
        self.login((recruiter or self.recruiter).user)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(
                self.proposeUrl(application),
                {"slots": slots or [slot(at(3, 10))], **fields},
                format="json",
            )

    def choose(self, slot_id: int, application=None, student=None):
        application = application or self.application
        self.login((student or self.alice).user)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(
                self.chooseUrl(application), {"slot": slot_id}, format="json"
            )

    def confirmed(self, application: JobApplication, start: datetime, minutes=60):
        # Entretien déjà confirmé, sans passer par l'API
        interview = Interview.objects.create(application=application)
        return InterviewSlot.objects.create(
            interview=interview,
            starts_at=start,
            ends_at=start + timedelta(minutes=minutes),
            chosen_at=timezone.now(),
        )

    def otherRecruiter(self) -> Recruiter:
        company = Company.objects.create(name="Capgemini", siret="98765432109876")
        return Recruiter.objects.create(
            user=self.user(USERS[3], email="rh@capgemini.fr", role=Role.RECRUITER),
            company=company,
        )

    def offerOf(self, recruiter: Recruiter) -> Offer:
        return Offer.objects.create(
            recruiter=recruiter,
            title="Data analyst",
            description="Description",
            category=JobCategory.DATA_AI,
        )

    def applicationTo(self, offer: Offer, student: Student):
        return JobApplication.objects.create(
            student=student,
            offer=offer,
            status=ApplicationStatus.IN_REVIEW,
            submitted_at=timezone.now(),
        )


class ProposeInterviewTests(InterviewTestCase):
    def test_the_recruiter_proposes_slots_and_the_student_is_notified(self):
        late, early = at(3, 14), at(2, 9, 30)
        response = self.propose(
            slots=[slot(late), slot(early, 45)],
            location="Visio : lien envoyé par message",
            message="Prévoir 45 minutes.",
        )
        self.assertEqual(response.status_code, 201)
        interview = response.json()["interview"]
        self.assertEqual(interview["status"], "proposed")
        self.assertEqual(interview["location"], "Visio : lien envoyé par message")
        self.assertEqual(interview["message"], "Prévoir 45 minutes.")
        self.assertIsNone(interview["confirmed_slot"])
        self.assertEqual(interview["available_count"], 2)
        # Du plus proche au plus lointain
        self.assertEqual(
            [parse(item["starts_at"]) for item in interview["slots"]], [early, late]
        )
        self.assertEqual(
            parse(interview["slots"][0]["ends_at"]), early + timedelta(minutes=45)
        )
        self.assertEqual(
            {(item["chosen"], item["unavailable"]) for item in interview["slots"]},
            {(False, None)},
        )
        [notification] = self.notificationsOf(self.alice.user)
        self.assertEqual(notification.kind, NotificationKind.INTERVIEW)
        self.assertEqual(notification.title, "Entretien proposé")
        self.assertEqual(
            notification.body,
            "Thales vous propose 2 créneaux d’entretien pour « Développeur Java ». "
            "Choisissez celui qui vous convient.",
        )
        self.assertEqual(notification.link, f"/applications/{self.application.pk}")

    def test_the_student_sees_the_proposal_apart_from_the_other_applications(self):
        other = self.apply(self.alice, ApplicationStatus.SUBMITTED)
        self.propose()
        self.login(self.alice.user)
        body = self.client.get(STUDENT_APPLICATIONS).json()
        self.assertEqual(
            [item["id"] for item in body["interviews"]], [self.application.pk]
        )
        self.assertEqual(body["interviews"][0]["interview"]["available_count"], 1)
        # Toujours dans in_progress, pour les écrans qui ne connaissent pas les entretiens
        self.assertCountEqual(
            [item["id"] for item in body["in_progress"]],
            [self.application.pk, other.pk],
        )
        detail = self.client.get(f"{STUDENT_APPLICATIONS}/{self.application.pk}")
        self.assertEqual(detail.json()["interview"]["status"], "proposed")
        self.assertIsNone(
            self.client.get(f"{STUDENT_APPLICATIONS}/{other.pk}").json()["interview"]
        )

    def test_a_decided_application_leaves_the_interviews_list(self):
        self.propose()
        JobApplication.objects.filter(pk=self.application.pk).update(
            status=ApplicationStatus.REFUSED
        )
        self.login(self.alice.user)
        self.assertEqual(self.client.get(STUDENT_APPLICATIONS).json()["interviews"], [])

    def test_only_the_author_of_the_offer_proposes(self):
        self.assertEqual(self.propose(recruiter=self.otherRecruiter()).status_code, 404)
        self.login(self.alice.user)
        response = self.client.post(
            self.proposeUrl(self.application),
            {"slots": [slot(at(3, 10))]},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Interview.objects.exists())

    def test_only_an_application_under_review(self):
        for status in (ApplicationStatus.SUBMITTED, ApplicationStatus.ACCEPTED):
            application = self.apply(self.bob, status)
            response = self.propose(application)
            self.assertEqual(response.status_code, 409, status)
            self.assertEqual(response.json(), {"error": "Application not in review"})
        draft = self.apply(self.bob, ApplicationStatus.DRAFT)
        JobApplication.objects.filter(pk=draft.pk).update(submitted_at=None)
        self.assertEqual(self.propose(draft).status_code, 404)

    def test_an_invalid_payload_is_refused(self):
        start = at(3, 10)
        naive = {"starts_at": "2030-01-01T10:00:00", "ends_at": "2030-01-01T11:00:00"}
        for payload in (
            {"slots": []},
            {"slots": [slot(start)] * (MAX_SLOTS + 1)},
            {"slots": [naive]},
            {"slots": [slot(start)], "recruiter": 1},
            {"slots": [slot(start)], "location": "x" * 201},
            {"slots": "demain"},
        ):
            self.login(self.recruiter.user)
            response = self.client.post(
                self.proposeUrl(self.application), payload, format="json"
            )
            self.assertEqual(response.status_code, 400, payload)
            self.assertEqual(response.json(), {"error": "Invalid payload"})

    def test_each_slot_is_checked(self):
        start = at(3, 10)
        cases = [
            ([slot(start, 10)], "Invalid duration", 0),
            ([slot(start), slot(at(4, 10), 5 * 60)], "Invalid duration", 1),
            ([slot(start, -30)], "Invalid duration", 0),
            ([slot(at(-1, 10))], "Slot in the past", 0),
            ([slot(at(400, 10))], "Slot too far", 0),
            ([slot(start), slot(start + timedelta(minutes=30))], "Slots overlap", 1),
            ([slot(start), slot(at(5, 9)), slot(start)], "Slots overlap", 2),
        ]
        for slots, error, index in cases:
            response = self.propose(slots=slots)
            self.assertEqual(response.status_code, 400, error)
            self.assertEqual(response.json(), {"error": error, "slot": index})
        self.assertFalse(Interview.objects.exists())

    def test_slots_that_only_touch_do_not_overlap(self):
        start = at(3, 10)
        response = self.propose(slots=[slot(start), slot(start + timedelta(hours=1))])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.json()["interview"]["slots"]), 2)

    def test_never_over_a_confirmed_interview_of_the_recruiter(self):
        start = at(3, 10)
        self.confirmed(self.apply(self.bob, ApplicationStatus.IN_REVIEW), start)
        response = self.propose(
            slots=[slot(at(4, 10)), slot(start + timedelta(minutes=30))]
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json(), {"error": "Recruiter busy", "slot": 1})
        # Juste après, ou chez un autre recruteur : rien ne se chevauche
        self.assertEqual(
            self.propose(slots=[slot(start + timedelta(hours=1))]).status_code, 201
        )
        other = self.otherRecruiter()
        elsewhere = self.applicationTo(self.offerOf(other), self.alice)
        response = self.propose(elsewhere, slots=[slot(start)], recruiter=other)
        self.assertEqual(response.status_code, 201)

    def test_a_refused_application_frees_its_slot(self):
        start = at(3, 10)
        self.confirmed(self.apply(self.bob, ApplicationStatus.REFUSED), start)
        self.assertEqual(self.propose(slots=[slot(start)]).status_code, 201)

    def test_new_slots_replace_a_proposal_without_answer(self):
        first = self.propose().json()["interview"]
        response = self.propose(slots=[slot(at(5, 11)), slot(at(6, 11))])
        self.assertEqual(response.status_code, 201)
        second = response.json()["interview"]
        self.assertNotEqual(first["id"], second["id"])
        self.assertEqual(InterviewSlot.objects.count(), 2)
        # Chaque proposition est notifiée
        self.assertEqual(
            [n.title for n in self.notificationsOf(self.alice.user)],
            ["Entretien proposé", "Entretien proposé"],
        )

    def test_a_confirmed_interview_is_not_replaced(self):
        interview = self.propose().json()["interview"]
        self.choose(interview["slots"][0]["id"])
        response = self.propose(slots=[slot(at(5, 11))])
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json(), {"error": "Interview already confirmed"})

    def test_the_recruiter_sees_the_interviews_in_the_applicants_list(self):
        bob = self.apply(self.bob, ApplicationStatus.IN_REVIEW)
        start = at(3, 10)
        self.propose()
        interview = self.propose(bob, slots=[slot(start, 30)]).json()["interview"]
        self.choose(interview["slots"][0]["id"], bob, self.bob)
        self.login(self.recruiter.user)
        response = self.client.get(f"/api/recruiter/offers/{self.offer.pk}/applicants")
        states = {
            item["id"]: item["interview"] for item in response.json()["applications"]
        }
        self.assertEqual(states[self.application.pk]["status"], "proposed")
        self.assertEqual(states[self.application.pk]["slot_count"], 1)
        self.assertIsNone(states[self.application.pk]["confirmed_slot"])
        self.assertEqual(states[bob.pk]["status"], "confirmed")
        self.assertEqual(parse(states[bob.pk]["confirmed_slot"]["starts_at"]), start)
        # Le détail de la candidature d'Alice rappelle l'entretien prévu avec Bob
        detail = self.client.get(f"/api/recruiter/applications/{self.application.pk}")
        [upcoming] = detail.json()["upcoming_interviews"]
        self.assertEqual(upcoming["candidate"], "Bob Ni")
        self.assertEqual(upcoming["application_id"], bob.pk)
        self.assertEqual(parse(upcoming["ends_at"]), start + timedelta(minutes=30))
        carol = self.apply(self.carol, ApplicationStatus.SUBMITTED)
        response = self.client.get(f"/api/recruiter/offers/{self.offer.pk}/applicants")
        states = {
            item["id"]: item["interview"] for item in response.json()["applications"]
        }
        self.assertIsNone(states[carol.pk])


class ChooseSlotTests(InterviewTestCase):
    def setUp(self):
        super().setUp()
        self.start = at(3, 10)
        self.interview = self.propose(slots=[slot(self.start), slot(at(4, 15))]).json()[
            "interview"
        ]
        self.first, self.second = (item["id"] for item in self.interview["slots"])

    def test_the_student_chooses_a_slot_and_the_recruiter_is_notified(self):
        response = self.choose(self.second)
        self.assertEqual(response.status_code, 200)
        interview = response.json()["interview"]
        self.assertEqual(interview["status"], "confirmed")
        self.assertEqual(interview["confirmed_slot"]["id"], self.second)
        self.assertTrue(interview["confirmed_slot"]["chosen"])
        self.assertEqual(interview["available_count"], 0)
        [notification] = self.notificationsOf(self.recruiter.user)
        self.assertEqual(notification.kind, NotificationKind.INTERVIEW)
        self.assertEqual(notification.title, "Entretien confirmé")
        self.assertEqual(
            notification.body,
            f"Alice Plancher a choisi le créneau du {frenchDateTime(at(4, 15))} "
            "pour « Développeur Java ».",
        )
        self.assertEqual(
            notification.link, f"/recruiter/applications/{self.application.pk}"
        )
        self.login(self.recruiter.user)
        detail = self.client.get(f"/api/recruiter/applications/{self.application.pk}")
        self.assertEqual(
            detail.json()["interview"]["confirmed_slot"]["id"], self.second
        )

    def test_the_choice_is_final(self):
        self.choose(self.first)
        # Le même choix renvoyé ne change rien et ne notifie pas une seconde fois
        self.assertEqual(self.choose(self.first).status_code, 200)
        self.assertEqual(len(self.notificationsOf(self.recruiter.user)), 1)
        response = self.choose(self.second)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json(), {"error": "Interview already confirmed"})

    def test_a_slot_taken_by_another_candidate_is_no_longer_available(self):
        # Le même horaire proposé à Bob, qui le prend le premier
        bob = self.apply(self.bob, ApplicationStatus.IN_REVIEW)
        proposed = self.propose(bob, slots=[slot(self.start + timedelta(minutes=30))])
        self.choose(proposed.json()["interview"]["slots"][0]["id"], bob, self.bob)
        self.login(self.alice.user)
        interview = self.client.get(
            f"{STUDENT_APPLICATIONS}/{self.application.pk}"
        ).json()["interview"]
        self.assertEqual(
            [item["unavailable"] for item in interview["slots"]], ["taken", None]
        )
        self.assertEqual(interview["available_count"], 1)
        response = self.choose(self.first)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json(), {"error": "Slot taken"})
        self.assertEqual(self.choose(self.second).status_code, 200)

    def test_the_student_cannot_be_in_two_interviews_at_once(self):
        other = self.otherRecruiter()
        elsewhere = self.applicationTo(self.offerOf(other), self.alice)
        proposed = self.propose(
            elsewhere, slots=[slot(self.start - timedelta(minutes=30))], recruiter=other
        )
        self.assertEqual(proposed.status_code, 201)
        self.choose(self.first)
        # Le recruteur ne voit jamais les entretiens de l'étudiant ailleurs
        self.login(other.user)
        seen = self.client.get(f"/api/recruiter/applications/{elsewhere.pk}").json()
        self.assertIsNone(seen["interview"]["slots"][0]["unavailable"])
        self.assertEqual(seen["upcoming_interviews"], [])
        self.login(self.alice.user)
        interview = self.client.get(f"{STUDENT_APPLICATIONS}/{elsewhere.pk}").json()[
            "interview"
        ]
        self.assertEqual(interview["slots"][0]["unavailable"], "busy")
        response = self.choose(interview["slots"][0]["id"], elsewhere)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json(), {"error": "Student busy"})

    def test_a_past_slot_cannot_be_chosen(self):
        InterviewSlot.objects.filter(pk=self.first).update(
            starts_at=at(-1, 10), ends_at=at(-1, 11)
        )
        self.login(self.alice.user)
        interview = self.client.get(
            f"{STUDENT_APPLICATIONS}/{self.application.pk}"
        ).json()["interview"]
        self.assertEqual(interview["slots"][0]["unavailable"], "passed")
        response = self.choose(self.first)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json(), {"error": "Slot passed"})

    def test_errors(self):
        foreign = Interview.objects.create(
            application=self.apply(self.bob, ApplicationStatus.IN_REVIEW)
        )
        foreign_slot = InterviewSlot.objects.create(
            interview=foreign, starts_at=at(5, 10), ends_at=at(5, 11)
        )
        response = self.choose(foreign_slot.pk)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "Slot not found"})
        # Candidature d'un autre étudiant, ou sans entretien
        self.assertEqual(
            self.choose(foreign_slot.pk, foreign.application).status_code, 404
        )
        without = self.apply(self.alice, ApplicationStatus.IN_REVIEW)
        response = self.choose(self.first, without)
        self.assertEqual(response.json(), {"error": "Interview not found"})
        self.assertEqual(response.status_code, 404)
        self.login(self.alice.user)
        for payload in ({}, {"slot": "a"}, {"slot": 0}, {"slot": 1, "other": 2}):
            response = self.client.post(
                self.chooseUrl(self.application), payload, format="json"
            )
            self.assertEqual(response.status_code, 400, payload)
        self.login(self.recruiter.user)
        response = self.client.post(
            self.chooseUrl(self.application), {"slot": self.first}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_a_decided_application_is_closed(self):
        JobApplication.objects.filter(pk=self.application.pk).update(
            status=ApplicationStatus.ACCEPTED
        )
        response = self.choose(self.first)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json(), {"error": "Application closed"})

    def test_the_recruiter_cancels_and_the_student_is_notified(self):
        self.choose(self.first)
        self.login(self.recruiter.user)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(self.proposeUrl(self.application))
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["interview"])
        self.assertFalse(InterviewSlot.objects.exists())
        notification = self.notificationsOf(self.alice.user)[-1]
        self.assertEqual(notification.title, "Entretien annulé")
        self.assertEqual(
            notification.body,
            "Thales a annulé l’entretien prévu pour « Développeur Java ».",
        )
        self.assertEqual(
            self.client.delete(self.proposeUrl(self.application)).status_code, 404
        )
        # Le créneau est de nouveau libre pour un autre candidat
        bob = self.apply(self.bob, ApplicationStatus.IN_REVIEW)
        self.assertEqual(self.propose(bob, slots=[slot(self.start)]).status_code, 201)

    def test_notifications_follow_the_preferences(self):
        for user, field in (
            (self.alice.user, "application_status"),
            (self.recruiter.user, "new_applications"),
        ):
            NotificationPreference.objects.update_or_create(
                user=user, defaults={field: False}
            )
        before = len(self.notificationsOf(self.alice.user))
        self.choose(self.first)
        self.propose(self.apply(self.alice, ApplicationStatus.IN_REVIEW))
        self.login(self.recruiter.user)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.delete(self.proposeUrl(self.application))
        self.assertEqual(len(self.notificationsOf(self.alice.user)), before)
        self.assertEqual(self.notificationsOf(self.recruiter.user), [])


class FrenchDateTests(InterviewTestCase):
    def test_first_day_of_the_month(self):
        value = timezone.make_aware(datetime(2026, 12, 1, 14, 5))
        self.assertEqual(frenchDateTime(value), "mardi 1er décembre 2026 à 14:05")
        value = timezone.make_aware(datetime(2027, 2, 13, 9, 0))
        self.assertEqual(frenchDateTime(value), "samedi 13 février 2027 à 09:00")
