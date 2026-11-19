import tempfile
from datetime import datetime, timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import (
    ApplicationStatus,
    Company,
    Contract,
    ContractStage,
    Conversation,
    JobApplication,
    JobCategory,
    Message,
    Notification,
    NotificationKind,
    NotificationPreference,
    Offer,
    Recruiter,
    Role,
    School,
    SchoolManager,
    SchoolRequest,
    SchoolRequestStatus,
    Student,
    User,
)
from .test_login import USERS

SCHOOL = "/api/school"
RECRUITER_APPLICATION = "/api/recruiter/applications"


class SchoolTestCase(APITestCase):
    def user(self, template, **fields) -> User:
        return User.objects.create_user(**template.fork(**fields))

    def setUp(self):
        self.school = School.objects.create(name="Université Paris Nanterre")
        self.other_school = School.objects.create(name="IUT Montreuil")
        self.manager = SchoolManager.objects.create(
            user=self.user(
                USERS[0], email="ines@ecole.fr", first_name="Inès", role=Role.MANAGER
            ),
            school=self.school,
        )
        self.other_manager = SchoolManager.objects.create(
            user=self.user(USERS[0], email="paul@iut.fr", role=Role.MANAGER),
            school=self.other_school,
        )
        self.alice = Student.objects.create(
            user=self.user(USERS[0]), school=self.school
        )
        self.bob = Student.objects.create(user=self.user(USERS[1]))
        self.carol = Student.objects.create(
            user=self.user(USERS[1], email="carol@mail.fr", first_name="Carol"),
            school=self.other_school,
        )
        company = Company.objects.create(name="Thales", siret="12345678901234")
        self.recruiter = Recruiter.objects.create(
            user=self.user(USERS[3]), company=company
        )
        self.offer = Offer.objects.create(
            recruiter=self.recruiter,
            title="Développeur Java",
            description="Description",
            category=JobCategory.COMPUTER_SCIENCE,
        )

    def login(self, user: User):
        self.client.force_authenticate(user)

    def newOffer(self) -> Offer:
        return Offer.objects.create(
            recruiter=self.recruiter,
            title="Développeur Java",
            description="Description",
            category=JobCategory.COMPUTER_SCIENCE,
        )

    def apply(self, student: Student, status=ApplicationStatus.SUBMITTED):
        # Une seule candidature par offre et par étudiant
        taken = JobApplication.objects.filter(student=student, offer=self.offer)
        return JobApplication.objects.create(
            student=student,
            offer=self.newOffer() if taken.exists() else self.offer,
            status=status,
            submitted_at=timezone.now(),
        )

    def contract(self, student: Student | None = None, stage=ContractStage.DEPOSITED):
        student = student or self.alice
        return Contract.objects.create(
            school=student.school,
            company=self.recruiter.company,
            student=student,
            application=self.apply(student, ApplicationStatus.ACCEPTED),
            stage=stage,
        )

    def notificationsOf(self, user: User):
        return list(Notification.objects.filter(recipient=user).order_by("pk"))


class SchoolAccountTests(SchoolTestCase):
    def test_only_a_school_account_reads_the_school(self):
        for user in (self.alice.user, self.recruiter.user):
            self.login(user)
            for url in (SCHOOL, f"{SCHOOL}/students", f"{SCHOOL}/contracts"):
                self.assertEqual(self.client.get(url).status_code, 403, url)

    def test_without_a_school_the_account_is_asked_for_one(self):
        manager = SchoolManager.objects.create(
            user=self.user(USERS[0], email="sans@ecole.fr", role=Role.MANAGER)
        )
        self.login(manager.user)
        self.assertEqual(self.client.get(SCHOOL).json(), {"school": None})
        self.assertEqual(self.client.get(f"{SCHOOL}/students").status_code, 409)

    def test_the_account_names_its_school_once(self):
        manager = SchoolManager.objects.create(
            user=self.user(USERS[0], email="sans@ecole.fr", role=Role.MANAGER)
        )
        self.login(manager.user)
        response = self.client.post(SCHOOL, {"name": "  ISEG  "}, format="json")
        self.assertEqual(response.status_code, 201)
        manager.refresh_from_db()
        assert manager.school is not None
        self.assertEqual(manager.school.name, "ISEG")
        again = self.client.post(SCHOOL, {"name": "Autre"}, format="json")
        self.assertEqual(again.status_code, 409)

    def test_invalid_school_names(self):
        manager = SchoolManager.objects.create(
            user=self.user(USERS[0], email="sans@ecole.fr", role=Role.MANAGER)
        )
        self.login(manager.user)
        for body in ({"name": "   "}, {"name": "x" * 129}, {}, {"name": 4}):
            response = self.client.post(SCHOOL, body, format="json")
            self.assertEqual(response.status_code, 400, body)
            self.assertIn("name", response.json()["errors"])

    def test_a_school_that_has_an_account_is_not_taken_by_another(self):
        manager = SchoolManager.objects.create(
            user=self.user(USERS[0], email="sans@ecole.fr", role=Role.MANAGER)
        )
        self.login(manager.user)
        response = self.client.post(SCHOOL, {"name": self.school.name}, format="json")
        self.assertEqual(response.status_code, 409)
        manager.refresh_from_db()
        self.assertIsNone(manager.school)
        # Un établissement déjà connu des étudiants mais sans compte école est repris
        orphan = School.objects.create(name="CFA du Nord")
        response = self.client.post(SCHOOL, {"name": orphan.name}, format="json")
        self.assertEqual(response.status_code, 201)

    def test_dashboard_counts_the_students_of_the_school_only(self):
        self.apply(self.alice)
        self.contract(self.carol, ContractStage.SIGNED)
        SchoolRequest.objects.create(student=self.bob, school=self.school)
        self.login(self.manager.user)
        data = self.client.get(SCHOOL).json()
        self.assertEqual(
            data["school"], {"id": self.school.pk, "name": self.school.name}
        )
        self.assertEqual(
            data["stats"],
            {
                "students": 1,
                "searching": 0,
                "signed": 0,
                "found": 0,
                "pending_requests": 1,
                "contracts_to_validate": 0,
            },
        )
        self.contract(self.alice)
        stats = self.client.get(SCHOOL).json()["stats"]
        self.assertEqual(stats["contracts_to_validate"], 1)
        # JOB-047 : une candidature acceptée suffit pour avoir trouvé son alternance
        self.assertEqual(stats["found"], 1)


class SchoolStudentTests(SchoolTestCase):
    def statuses(self):
        self.login(self.manager.user)
        return {
            student["id"]: student["status"]
            for student in self.client.get(f"{SCHOOL}/students").json()
        }

    def test_list_shows_only_active_students_of_the_school(self):
        self.login(self.manager.user)
        students = self.client.get(f"{SCHOOL}/students").json()
        self.assertEqual([s["id"] for s in students], [self.alice.user.pk])
        self.alice.user.is_active = False
        self.alice.user.save()
        self.assertEqual(self.client.get(f"{SCHOOL}/students").json(), [])

    def test_progress_follows_the_most_advanced_step(self):
        key = self.alice.user.pk
        self.assertEqual(self.statuses()[key], "searching")
        # Un brouillon n'est pas une candidature envoyée
        draft = JobApplication.objects.create(student=self.alice, offer=self.offer)
        self.assertEqual(self.statuses()[key], "searching")
        draft.delete()
        application = self.apply(self.alice)
        self.assertEqual(self.statuses()[key], "applying")
        application.status = ApplicationStatus.ACCEPTED
        application.save()
        self.assertEqual(self.statuses()[key], "accepted")
        contract = Contract.objects.create(
            school=self.school,
            company=self.recruiter.company,
            student=self.alice,
            application=application,
        )
        self.assertEqual(self.statuses()[key], "contract")
        contract.stage = ContractStage.SIGNED
        contract.save()
        self.assertEqual(self.statuses()[key], "signed")
        self.assertEqual(
            self.client.get(f"{SCHOOL}/students").json()[0]["application_count"], 1
        )

    def test_last_application_date(self):
        # JOB-047 : date de la candidature envoyée la plus récente, rien sans candidature
        self.login(self.manager.user)
        self.assertIsNone(
            self.client.get(f"{SCHOOL}/students").json()[0]["last_application_at"]
        )
        older = self.apply(self.alice)
        JobApplication.objects.filter(pk=older.pk).update(
            submitted_at=timezone.now() - timedelta(days=10)
        )
        newer = self.apply(self.alice)
        # Un brouillon ne compte pas
        JobApplication.objects.create(student=self.alice, offer=self.newOffer())
        shown = self.client.get(f"{SCHOOL}/students").json()[0]
        self.assertEqual(shown["application_count"], 2)
        self.assertEqual(
            datetime.fromisoformat(shown["last_application_at"]), newer.submitted_at
        )

    def test_detail(self):
        contract = self.contract()
        self.apply(self.alice)
        conversation = Conversation.objects.create(
            student=self.alice, school_manager=self.manager
        )
        self.login(self.manager.user)
        data = self.client.get(f"{SCHOOL}/students/{self.alice.user.pk}").json()
        self.assertEqual(data["status"], "contract")
        self.assertEqual(len(data["applications"]), 2)
        self.assertEqual(data["applications"][0]["company"], "Thales")
        self.assertEqual(data["contracts"][0]["id"], contract.pk)
        self.assertEqual(data["contracts"][0]["offer_title"], "Développeur Java")
        self.assertEqual(data["conversation_id"], conversation.pk)

    def test_detail_hides_unknown_and_foreign_students(self):
        self.login(self.manager.user)
        for student in (self.bob, self.carol):
            response = self.client.get(f"{SCHOOL}/students/{student.user.pk}")
            self.assertEqual(response.status_code, 404)
        self.assertEqual(self.client.get(f"{SCHOOL}/students/9999").status_code, 404)


class SchoolRequestTests(SchoolTestCase):
    STUDENT_SCHOOL = "/api/student/school"
    REQUEST = "/api/student/school-request"

    def test_only_a_student_chooses_a_school(self):
        for user in (self.manager.user, self.recruiter.user):
            self.login(user)
            self.assertEqual(self.client.get(self.STUDENT_SCHOOL).status_code, 403)
            response = self.client.post(self.REQUEST, {"school_id": 1}, format="json")
            self.assertEqual(response.status_code, 403)
            self.assertEqual(self.client.delete(self.REQUEST).status_code, 403)

    def test_student_without_school_is_offered_the_schools_with_an_account(self):
        School.objects.create(name="Sans compte")
        self.login(self.bob.user)
        data = self.client.get(self.STUDENT_SCHOOL).json()
        self.assertIsNone(data["school"])
        self.assertIsNone(data["request"])
        self.assertEqual(
            [school["name"] for school in data["schools"]],
            ["IUT Montreuil", "Université Paris Nanterre"],
        )
        self.login(self.alice.user)
        data = self.client.get(self.STUDENT_SCHOOL).json()
        self.assertEqual(data["school"]["name"], self.school.name)
        self.assertEqual(data["schools"], [])

    def test_request_then_acceptance(self):
        self.login(self.bob.user)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                self.REQUEST, {"school_id": self.school.pk}, format="json"
            )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["request"]["status"], "pending")
        self.assertEqual(response.json()["schools"], [])
        # L'école n'est pas encore sur le profil de l'étudiant
        self.bob.refresh_from_db()
        self.assertIsNone(self.bob.school)
        (notification,) = self.notificationsOf(self.manager.user)
        self.assertEqual(notification.kind, NotificationKind.SCHOOL_REQUEST)
        self.assertEqual(self.notificationsOf(self.other_manager.user), [])

        self.login(self.manager.user)
        pending = self.client.get(f"{SCHOOL}/requests").json()
        self.assertEqual(pending[0]["student"]["id"], self.bob.user.pk)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                f"{SCHOOL}/requests/{pending[0]['id']}",
                {"status": "accepted"},
                format="json",
            )
        self.assertEqual(response.status_code, 200)
        self.bob.refresh_from_db()
        self.assertEqual(self.bob.school, self.school)
        self.assertEqual(self.client.get(f"{SCHOOL}/requests").json(), [])
        (notification,) = self.notificationsOf(self.bob.user)
        self.assertEqual(notification.title, "Rattachement accepté")
        self.login(self.bob.user)
        data = self.client.get(self.STUDENT_SCHOOL).json()
        self.assertEqual(data["school"]["id"], self.school.pk)
        self.assertIsNone(data["request"])

    def test_refusal_lets_the_student_ask_again(self):
        request = SchoolRequest.objects.create(student=self.bob, school=self.school)
        self.login(self.manager.user)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.patch(
                f"{SCHOOL}/requests/{request.pk}", {"status": "refused"}, format="json"
            )
        self.bob.refresh_from_db()
        self.assertIsNone(self.bob.school)
        (notification,) = self.notificationsOf(self.bob.user)
        self.assertEqual(notification.title, "Rattachement refusé")
        self.login(self.bob.user)
        shown = self.client.get(self.STUDENT_SCHOOL).json()
        self.assertEqual(shown["request"]["status"], "refused")
        self.assertEqual(len(shown["schools"]), 2)
        response = self.client.post(
            self.REQUEST, {"school_id": self.other_school.pk}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(SchoolRequest.objects.get().school, self.other_school)

    def test_a_decision_is_final_and_limited_to_the_school(self):
        request = SchoolRequest.objects.create(student=self.bob, school=self.school)
        self.login(self.other_manager.user)
        url = f"{SCHOOL}/requests/{request.pk}"
        self.assertEqual(
            self.client.patch(url, {"status": "accepted"}, format="json").status_code,
            404,
        )
        self.login(self.manager.user)
        self.assertEqual(
            self.client.patch(url, {"status": "maybe"}, format="json").status_code, 400
        )
        self.assertEqual(
            self.client.patch(url, {"status": "refused"}, format="json").status_code,
            200,
        )
        self.assertEqual(
            self.client.patch(url, {"status": "accepted"}, format="json").status_code,
            409,
        )
        request.refresh_from_db()
        self.assertEqual(request.status, SchoolRequestStatus.REFUSED)

    def test_cannot_ask_twice_nor_when_attached_nor_for_an_unknown_school(self):
        self.login(self.alice.user)
        response = self.client.post(
            self.REQUEST, {"school_id": self.other_school.pk}, format="json"
        )
        self.assertEqual(response.status_code, 409)
        self.login(self.bob.user)
        body = {"school_id": self.school.pk}
        self.assertEqual(
            self.client.post(self.REQUEST, body, format="json").status_code, 201
        )
        self.assertEqual(
            self.client.post(self.REQUEST, body, format="json").status_code, 409
        )
        self.client.delete(self.REQUEST)
        orphan = School.objects.create(name="Sans compte")
        for body, status in (
            ({"school_id": orphan.pk}, 404),
            ({"school_id": 9999}, 404),
            ({"school_id": "x"}, 400),
            ({}, 400),
        ):
            response = self.client.post(self.REQUEST, body, format="json")
            self.assertEqual(response.status_code, status, body)

    def test_a_pending_request_can_be_cancelled(self):
        self.login(self.bob.user)
        self.assertEqual(self.client.delete(self.REQUEST).status_code, 404)
        self.client.post(self.REQUEST, {"school_id": self.school.pk}, format="json")
        response = self.client.delete(self.REQUEST)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["request"])
        self.assertEqual(SchoolRequest.objects.count(), 0)
        # Une demande refusée ne s'annule pas : elle disparaît avec la suivante
        SchoolRequest.objects.create(
            student=self.bob, school=self.school, status=SchoolRequestStatus.REFUSED
        )
        self.assertEqual(self.client.delete(self.REQUEST).status_code, 404)

    def test_notification_preference_turns_the_school_notifications_off(self):
        NotificationPreference.objects.create(
            user=self.manager.user, school_updates=False
        )
        self.login(self.bob.user)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(self.REQUEST, {"school_id": self.school.pk}, format="json")
        self.assertEqual(self.notificationsOf(self.manager.user), [])


class ContractDepositTests(SchoolTestCase):
    def setUp(self):
        super().setUp()
        # Les PDF déposés (JOB-045) vont dans un dossier temporaire, supprimé après le test
        private = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(self.settings(PRIVATE_MEDIA_ROOT=private))

    def url(self, application):
        return f"{RECRUITER_APPLICATION}/{application.pk}/contract"

    def deposit(self, url):
        # Depuis JOB-045, le dépôt envoie le PDF et les dates de l'alternance
        return self.client.post(
            url,
            {
                "file": SimpleUploadedFile("contrat.pdf", b"%PDF-1.4 contrat"),
                "start_date": "2099-09-01",
                "end_date": "2100-08-31",
            },
            format="multipart",
        )

    def test_deposit_after_acceptance_notifies_the_school_and_the_student(self):
        application = self.apply(self.alice, ApplicationStatus.ACCEPTED)
        self.login(self.recruiter.user)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.deposit(self.url(application))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["contract"]["stage"], ContractStage.DEPOSITED)
        contract = Contract.objects.get()
        self.assertEqual(
            (contract.school, contract.company, contract.student),
            (self.school, self.recruiter.company, self.alice),
        )
        (for_school,) = self.notificationsOf(self.manager.user)
        self.assertEqual(for_school.title, "Nouveau contrat à valider")
        self.assertEqual(for_school.link, "/school/contracts")
        (for_student,) = self.notificationsOf(self.alice.user)
        self.assertEqual(for_student.kind, NotificationKind.CONTRACT_UPDATE)
        self.assertEqual(for_student.link, f"/applications/{application.pk}")
        self.assertEqual(self.notificationsOf(self.other_manager.user), [])

    def test_deposit_twice_replaces_the_contract(self):
        # JOB-045 : un second dépôt remplace le PDF, sans créer un autre contrat
        application = self.apply(self.alice, ApplicationStatus.ACCEPTED)
        self.login(self.recruiter.user)
        self.deposit(self.url(application))
        response = self.deposit(self.url(application))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Contract.objects.count(), 1)
        self.assertEqual(Contract.objects.get().version, 2)

    def test_the_decision_page_of_the_recruiter_shows_the_contract(self):
        application = self.apply(self.alice, ApplicationStatus.ACCEPTED)
        self.login(self.recruiter.user)
        self.assertIsNone(
            self.client.get(f"{RECRUITER_APPLICATION}/{application.pk}").json()[
                "contract"
            ]
        )
        self.deposit(self.url(application))
        shown = self.client.get(f"{RECRUITER_APPLICATION}/{application.pk}").json()
        self.assertEqual(shown["contract"]["stage"], ContractStage.DEPOSITED)

    def test_refused_conditions(self):
        accepted = self.apply(self.alice, ApplicationStatus.ACCEPTED)
        pending = self.apply(self.carol, ApplicationStatus.IN_REVIEW)
        no_school = self.apply(self.bob, ApplicationStatus.ACCEPTED)
        draft = JobApplication.objects.create(student=self.carol, offer=self.newOffer())
        self.login(self.recruiter.user)
        self.assertEqual(self.deposit(self.url(pending)).status_code, 409)
        self.assertEqual(self.deposit(self.url(no_school)).status_code, 409)
        self.assertEqual(self.deposit(self.url(draft)).status_code, 404)
        self.assertEqual(
            self.deposit(f"{RECRUITER_APPLICATION}/9999/contract").status_code, 404
        )
        self.assertEqual(Contract.objects.count(), 0)
        for user in (self.alice.user, self.manager.user):
            self.login(user)
            self.assertEqual(self.deposit(self.url(accepted)).status_code, 403)

    def test_another_recruiter_cannot_deposit(self):
        application = self.apply(self.alice, ApplicationStatus.ACCEPTED)
        colleague = Recruiter.objects.create(
            user=self.user(USERS[3], email="rh@thales.org"),
            company=self.recruiter.company,
        )
        self.login(colleague.user)
        self.assertEqual(self.deposit(self.url(application)).status_code, 404)

    def test_the_student_follows_the_contract(self):
        application = self.apply(self.alice, ApplicationStatus.ACCEPTED)
        self.login(self.alice.user)
        shown = self.client.get(f"/api/applications/{application.pk}").json()
        self.assertIsNone(shown["contract"])
        self.assertEqual(shown["school"], self.school.name)
        contract = self.contract(self.alice, ContractStage.VALIDATED)
        contract.application = application
        contract.save()
        shown = self.client.get(f"/api/applications/{application.pk}").json()
        self.assertEqual(shown["contract"]["stage"], ContractStage.VALIDATED)


class SchoolContractTests(SchoolTestCase):
    def url(self, contract):
        return f"{SCHOOL}/contracts/{contract.pk}"

    def test_list_is_limited_to_the_school_and_starts_with_the_ones_to_validate(self):
        signed = self.contract(self.alice, ContractStage.SIGNED)
        waiting = self.contract(self.alice)
        self.contract(self.carol)
        self.login(self.manager.user)
        contracts = self.client.get(f"{SCHOOL}/contracts").json()
        self.assertEqual([c["id"] for c in contracts], [waiting.pk, signed.pk])
        self.assertEqual(contracts[0]["company"], "Thales")
        self.assertEqual(contracts[0]["student"]["id"], self.alice.user.pk)

    def test_the_school_validates_then_signs_and_the_student_is_told(self):
        contract = self.contract()
        self.login(self.manager.user)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                self.url(contract), {"stage": ContractStage.VALIDATED}, format="json"
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["stage"], ContractStage.VALIDATED)
        self.assertIsNotNone(response.json()["validated_at"])
        self.assertIsNone(response.json()["signed_at"])
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                self.url(contract), {"stage": ContractStage.SIGNED}, format="json"
            )
        self.assertEqual(response.json()["stage"], ContractStage.SIGNED)
        self.assertIsNotNone(response.json()["signed_at"])
        self.assertEqual(
            [n.title for n in self.notificationsOf(self.alice.user)],
            ["Contrat validé par votre école", "Contrat signé !"],
        )

    def test_steps_cannot_be_skipped_nor_repeated_nor_undone(self):
        contract = self.contract()
        self.login(self.manager.user)
        for stage, status in (
            (ContractStage.SIGNED, 409),
            (ContractStage.DEPOSITED, 400),
            (4, 400),
            ("x", 400),
        ):
            response = self.client.patch(
                self.url(contract), {"stage": stage}, format="json"
            )
            self.assertEqual(response.status_code, status, stage)
        self.client.patch(
            self.url(contract), {"stage": ContractStage.VALIDATED}, format="json"
        )
        again = self.client.patch(
            self.url(contract), {"stage": ContractStage.VALIDATED}, format="json"
        )
        self.assertEqual(again.status_code, 409)
        contract.refresh_from_db()
        self.assertEqual(contract.stage, ContractStage.VALIDATED)

    def test_another_school_cannot_touch_the_contract(self):
        contract = self.contract()
        self.login(self.other_manager.user)
        response = self.client.patch(
            self.url(contract), {"stage": ContractStage.VALIDATED}, format="json"
        )
        self.assertEqual(response.status_code, 404)
        self.login(self.recruiter.user)
        response = self.client.patch(
            self.url(contract), {"stage": ContractStage.VALIDATED}, format="json"
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.get(f"{SCHOOL}/contracts").status_code, 403)


class SchoolConversationTests(SchoolTestCase):
    LIST = f"{SCHOOL}/conversations"

    def test_the_school_starts_a_conversation_with_its_own_students_only(self):
        self.login(self.manager.user)
        response = self.client.post(
            self.LIST, {"student_id": self.alice.user.pk}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        again = self.client.post(
            self.LIST, {"student_id": self.alice.user.pk}, format="json"
        )
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.json()["id"], response.json()["id"])
        for body, status in (
            ({"student_id": self.carol.user.pk}, 404),
            ({"student_id": self.bob.user.pk}, 404),
            ({"student_id": True}, 400),
            ({"student_id": "1"}, 400),
            ({}, 400),
        ):
            result = self.client.post(self.LIST, body, format="json")
            self.assertEqual(result.status_code, status, body)
        self.assertEqual(Conversation.objects.count(), 1)

    def test_list_holds_the_conversations_of_the_account(self):
        mine = Conversation.objects.create(
            student=self.alice, school_manager=self.manager
        )
        Conversation.objects.create(
            student=self.carol, school_manager=self.other_manager
        )
        Message.objects.create(
            conversation=mine, sender=self.alice.user, body="Bonjour"
        )
        self.login(self.manager.user)
        (item,) = self.client.get(self.LIST).json()
        self.assertEqual(item["id"], mine.pk)
        self.assertEqual(item["candidate"]["id"], self.alice.user.pk)
        self.assertEqual(item["last_message"]["body"], "Bonjour")
        self.assertFalse(item["suspended"])
        self.login(self.alice.user)
        self.assertEqual(self.client.get(self.LIST).status_code, 403)

    def test_messages_go_both_ways_and_notify_the_other_side(self):
        conversation = Conversation.objects.create(
            student=self.alice, school_manager=self.manager
        )
        url = f"/api/conversations/{conversation.pk}/messages"
        self.login(self.manager.user)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(url, {"body": "Bienvenue"}, format="json")
        self.assertEqual(response.status_code, 201)
        (to_student,) = self.notificationsOf(self.alice.user)
        self.assertEqual(to_student.link, f"/messages/{conversation.pk}")
        self.login(self.alice.user)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(url, {"body": "Merci"}, format="json")
        (to_school,) = self.notificationsOf(self.manager.user)
        self.assertEqual(to_school.kind, NotificationKind.MESSAGE)
        self.assertEqual(to_school.title, "Nouveau message de Alice Plancher")
        self.assertEqual(to_school.link, f"/school/messages/{conversation.pk}")

    def test_message_preference_of_the_school_is_respected(self):
        conversation = Conversation.objects.create(
            student=self.alice, school_manager=self.manager
        )
        NotificationPreference.objects.create(user=self.manager.user, messages=False)
        self.login(self.alice.user)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(
                f"/api/conversations/{conversation.pk}/messages",
                {"body": "Merci"},
                format="json",
            )
        self.assertEqual(self.notificationsOf(self.manager.user), [])
