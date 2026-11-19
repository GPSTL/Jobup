# Période de l'alternance sur la page « Contrats » de l'école (JOB-048, ECO-06)
import datetime
from unittest import mock

from .school import contractPeriod
from .test_school import SCHOOL, SchoolTestCase

TODAY = datetime.date(2026, 11, 19)


class ContractPeriodTests(SchoolTestCase):
    def setUp(self):
        super().setUp()
        self.enterContext(mock.patch("jobup.school.timezone.localdate", lambda: TODAY))

    def period(self, start, end):
        contract = self.contract(self.alice)
        contract.start_date, contract.end_date = start, end
        return contractPeriod(contract)

    def test_upcoming_ongoing_and_finished_at_paris_date(self):
        day = datetime.timedelta(days=1)
        self.assertEqual(self.period(TODAY + day, TODAY + 300 * day), "upcoming")
        # Le jour du début et le jour de fin font partie de l'alternance
        self.assertEqual(self.period(TODAY, TODAY + 300 * day), "ongoing")
        self.assertEqual(self.period(TODAY - 300 * day, TODAY), "ongoing")
        self.assertEqual(self.period(TODAY - 300 * day, TODAY - day), "finished")
        # Contrat déposé avant JOB-045, sans dates
        self.assertIsNone(self.period(None, None))

    def test_the_school_list_shows_the_period(self):
        contract = self.contract(self.alice)
        contract.start_date = TODAY - datetime.timedelta(days=10)
        contract.end_date = TODAY + datetime.timedelta(days=10)
        contract.save()
        self.contract(self.alice)
        self.login(self.manager.user)
        periods = {
            item["id"]: item["period"]
            for item in self.client.get(f"{SCHOOL}/contracts").json()
        }
        self.assertEqual(periods[contract.pk], "ongoing")
        self.assertEqual(sorted(periods.values(), key=str), [None, "ongoing"])
