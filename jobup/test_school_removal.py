# Retrait d'un étudiant de l'effectif suivi par l'école (JOB-049, ECO-15)
from .models import (
    Contract,
    ContractStage,
    JobApplication,
    NotificationKind,
    NotificationPreference,
    SchoolRequest,
    SchoolRequestStatus,
    Student,
)
from .test_school import SCHOOL, SchoolTestCase


class SchoolRemovalTests(SchoolTestCase):
    def setUp(self):
        super().setUp()
        SchoolRequest.objects.create(
            student=self.alice, school=self.school, status=SchoolRequestStatus.ACCEPTED
        )
        self.alice_contract = self.contract(self.alice)
        self.url = f"{SCHOOL}/students/{self.alice.user_id}"

    def remove(self, url=None):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.delete(url or self.url)

    def test_removal_cuts_the_school_access_and_keeps_the_student_data(self):
        self.login(self.manager.user)
        self.assertEqual(
            self.client.get(f"{SCHOOL}/contracts").json()[0]["id"],
            self.alice_contract.pk,
        )
        self.assertEqual(self.remove().status_code, 204)
        alice = Student.objects.get(pk=self.alice.pk)
        self.assertIsNone(alice.school)
        # Plus dans la liste, ni sa fiche, ni ses contrats, ni les chiffres du tableau de bord
        self.assertEqual(self.client.get(f"{SCHOOL}/students").json(), [])
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertEqual(self.client.get(f"{SCHOOL}/contracts").json(), [])
        stats = self.client.get(SCHOOL).json()["stats"]
        self.assertEqual((stats["students"], stats["contracts_to_validate"]), (0, 0))
        self.assertEqual(
            self.client.patch(
                f"{SCHOOL}/contracts/{self.alice_contract.pk}",
                {"stage": 2},
                format="json",
            ).status_code,
            404,
        )
        # Le compte, ses candidatures et son contrat existent toujours
        self.assertTrue(alice.user.is_active)
        self.assertTrue(JobApplication.objects.filter(student=alice).exists())
        self.assertEqual(Contract.objects.get().stage, ContractStage.DEPOSITED)

    def test_the_student_is_notified_and_can_ask_again(self):
        self.login(self.manager.user)
        self.remove()
        (notification,) = self.notificationsOf(self.alice.user)
        self.assertEqual(notification.kind, NotificationKind.SCHOOL_REQUEST)
        self.assertEqual(notification.link, "/student#school")
        self.assertIn(self.school.name, notification.body)
        self.login(self.alice.user)
        state = self.client.get("/api/student/school").json()
        self.assertIsNone(state["school"])
        self.assertIsNone(state["request"])
        response = self.client.post(
            "/api/student/school-request", {"school_id": self.school.pk}, format="json"
        )
        self.assertEqual(response.status_code, 201)

    def test_no_notification_when_the_student_turned_them_off(self):
        NotificationPreference.objects.create(
            user=self.alice.user, school_updates=False
        )
        self.login(self.manager.user)
        self.remove()
        self.assertEqual(self.notificationsOf(self.alice.user), [])

    def test_only_the_school_of_the_student_removes_them(self):
        self.login(self.other_manager.user)
        self.assertEqual(self.remove().status_code, 404)
        self.assertEqual(
            self.remove(f"{SCHOOL}/students/{self.bob.user_id}").status_code, 404
        )
        for user in (self.alice.user, self.recruiter.user):
            self.login(user)
            self.assertEqual(self.remove().status_code, 403)
        self.assertEqual(Student.objects.get(pk=self.alice.pk).school, self.school)

    def test_removing_twice_is_a_404(self):
        self.login(self.manager.user)
        self.assertEqual(self.remove().status_code, 204)
        self.assertEqual(self.remove().status_code, 404)
        self.assertEqual(len(self.notificationsOf(self.alice.user)), 1)

    def test_a_suspended_student_can_be_removed(self):
        user = self.alice.user
        user.is_active = False
        user.save(update_fields=["is_active"])
        self.login(self.manager.user)
        self.assertEqual(self.remove().status_code, 204)
        self.assertIsNone(Student.objects.get(pk=self.alice.pk).school)

    def test_the_accepted_request_is_cleared(self):
        # Sans demande acceptée restante, l'étudiant repart de zéro dans « Mon école »
        self.login(self.manager.user)
        self.remove()
        self.assertFalse(SchoolRequest.objects.filter(student=self.alice).exists())
