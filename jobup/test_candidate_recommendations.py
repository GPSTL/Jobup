from .models import Exclusion, JobCategory, Shortlist
from .test_candidates import CandidateTestCase

URL = "/api/recruiter/candidates/recommendations"


class CandidateRecommendationTests(CandidateTestCase):
    def test_access_and_matching_active_own_offers(self):
        self.assertOnlyRecruiters(URL)
        self.alice.category = JobCategory.COMPUTER_SCIENCE
        self.alice.desired_position = "développeur java"
        self.alice.save()
        self.bob.category = JobCategory.DATA_AI
        self.bob.save()
        recruiter = self.offers[0].recruiter
        self.client.force_authenticate(recruiter.user)
        items = self.client.get(URL).json()
        self.assertEqual([item["id"] for item in items], [self.alice.user_id])
        self.assertEqual(len(items[0]["reasons"]), 3)
        self.assertEqual(items[0]["match_percentage"], 75)
        for offer in self.offers:
            offer.is_active = False
            offer.save()
        self.assertEqual(self.client.get(URL).json(), [])

    def test_excluded_shortlisted_and_inactive_candidates_are_not_returned(self):
        recruiter = self.offers[0].recruiter
        self.client.force_authenticate(recruiter.user)
        Shortlist.objects.create(recruiter=recruiter, student=self.alice)
        Exclusion.objects.create(recruiter=recruiter, student=self.bob)
        self.assertEqual(self.client.get(URL).json(), [])

    def test_cv_keywords_rank_candidates_without_exposing_cv_text(self):
        import io
        import zipfile

        from django.core.files.base import ContentFile

        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w") as document:
            document.writestr(
                "word/document.xml",
                "<document><p>Python Django secret-personnel</p></document>",
            )
        self.alice.skills = "Java"
        self.alice.resume.save("candidate.docx", ContentFile(archive.getvalue()))
        offer = self.offers[0]
        offer.requirements = "Python, Django et SQL"
        offer.save()
        self.client.force_authenticate(offer.recruiter.user)
        items = self.client.get(URL).json()
        self.assertEqual(items[0]["id"], self.alice.user_id)
        self.assertIn("django, python", items[0]["reasons"][0])
        self.assertNotIn("secret-personnel", str(items))
        self.assertEqual(items[0]["match_percentage"], 33)

        self.client.force_authenticate(self.alice.user)
        student_items = self.client.get("/api/student/recommendations").json()
        student_match = next(item for item in student_items if item["id"] == offer.pk)
        self.assertEqual(
            student_match["match_percentage"], items[0]["match_percentage"]
        )

    def test_unreadable_cv_does_not_break_suggestions(self):
        from django.core.files.base import ContentFile

        self.bob.resume.save("broken.pdf", ContentFile(b"%PDF-invalid"))
        self.client.force_authenticate(self.offers[0].recruiter.user)
        self.assertEqual(self.client.get(URL).status_code, 200)

    def test_all_matching_candidates_are_returned(self):
        from .models import Student, User, Role

        recruiter = self.offers[0].recruiter
        for index in range(6):
            user = User.objects.create_user(
                email=f"rank{index}@example.com",
                password="password",
                role=Role.STUDENT,
                first_name="Test",
                last_name="Candidate",
            )
            Student.objects.create(user=user, category=JobCategory.COMPUTER_SCIENCE)
        self.client.force_authenticate(recruiter.user)
        items = self.client.get(URL).json()
        self.assertGreaterEqual(len(items), 6)
        self.assertTrue(all(item["reasons"] for item in items))

    def test_profile_skills_and_gendered_position_match_without_cv(self):
        self.alice.desired_position = "Développeuse Java"
        self.alice.skills = "Spring, SQL, UX"
        self.alice.save()
        offer = self.offers[0]
        offer.requirements = "Java, SQL., UX."
        offer.save()
        self.client.force_authenticate(offer.recruiter.user)
        items = self.client.get(URL).json()
        self.assertEqual(items[0]["id"], self.alice.user_id)
        self.assertTrue(
            any("Poste recherché" in reason for reason in items[0]["reasons"])
        )
        self.assertTrue(any("sql, ux" in reason for reason in items[0]["reasons"]))
