from .models import ApplicationStatus, JobApplication, JobCategory, SavedOffer
from .test_saved_offers import SavedOfferTests


class RecommendationTests(SavedOfferTests):
    def test_recommendations_rank_matches_and_hide_existing_and_inactive(self):
        self.student.category = JobCategory.DATA_AI
        self.student.desired_position = "Data"
        self.student.save()
        matched = self.createOffer("Data engineer")
        matched.category = JobCategory.DATA_AI
        matched.save()
        saved = self.createOffer("Saved")
        SavedOffer.objects.create(student=self.student, offer=saved)
        applied = self.createOffer("Applied")
        JobApplication.objects.create(
            student=self.student, offer=applied, status=ApplicationStatus.SUBMITTED
        )
        self.client.force_authenticate(self.student.user)
        response = self.client.get("/api/student/recommendations")
        self.assertEqual(response.status_code, 200)
        items = response.json()
        self.assertEqual(items[0]["id"], matched.pk)
        self.assertIn("Correspond à votre domaine", items[0]["reasons"])
        self.assertIn("Correspond au poste recherché", items[0]["reasons"])
        self.assertNotIn(saved.pk, [item["id"] for item in items])
        self.assertNotIn(applied.pk, [item["id"] for item in items])
        self.assertNotIn(self.inactive.pk, [item["id"] for item in items])
        self.assertIn(
            "Dans un domaine lié à vos offres enregistrées ou candidatures",
            items[1]["reasons"],
        )

    def test_fallback_and_permissions(self):
        url = "/api/student/recommendations"
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(self.recruiter.user)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(self.student.user)
        self.assertEqual(self.client.get(url).json(), [])

    def test_returns_all_matching_offers_and_uses_cv(self):
        import io
        import zipfile

        from django.core.files.base import ContentFile

        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w") as document:
            document.writestr(
                "word/document.xml", "<document><p>Python Django</p></document>"
            )
        self.student.resume.save("resume.docx", ContentFile(archive.getvalue()))
        for index in range(6):
            offer = self.createOffer(f"Offer {index}")
            offer.requirements = "Python Django"
            offer.save()
        self.client.force_authenticate(self.student.user)
        items = self.client.get("/api/student/recommendations").json()
        self.assertEqual(len(items), 6)
        self.assertTrue(all("django, python" in item["reasons"][0] for item in items))

    def test_profile_skills_and_flexible_position_matching(self):
        self.student.desired_position = "Développeuse Python Fullstack"
        self.student.skills = "React, TS, Go"
        self.student.save()
        offer = self.createOffer("Alternance Développeur Python")
        offer.requirements = "Maîtrise de React, TS. et Go."
        offer.save()
        self.client.force_authenticate(self.student.user)
        items = self.client.get("/api/student/recommendations").json()
        self.assertEqual(items[0]["id"], offer.pk)
        self.assertIn("Correspond au poste recherché", items[0]["reasons"])
        self.assertIn(
            "Mots communs à votre CV et aux critères : go, react, ts",
            items[0]["reasons"],
        )
