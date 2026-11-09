from rest_framework.test import APIClient, APITestCase

from .models import Role, User

PAYLOAD = {
    "first_name": "Élodie",
    "last_name": "Durand",
    "email": "elodie@example.fr",
    "password": "Example123",
    "role": "Student",
}


class SignupLoginTests(APITestCase):
    def setUp(self):
        # Comme le front : jeton CSRF demandé avant l'inscription
        self.client = APIClient(enforce_csrf_checks=True)
        self.token = self.client.get("/api/csrf").json()["csrfToken"]

    def signup(self, payload):
        return self.client.post(
            "/api/signup", payload, format="json", HTTP_X_CSRFTOKEN=self.token
        )

    def test_signup_opens_the_session(self):
        response = self.signup(PAYLOAD)
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="elodie@example.fr")
        self.assertEqual(response.json()["id"], user.pk)
        self.assertNotIn("password", response.json())
        # Connecté sans passer par /api/login
        me = self.client.get("/api/me")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["id"], user.pk)
        self.assertEqual(me.json()["role"], Role.STUDENT)

    def test_refused_signup_does_not_open_a_session(self):
        User.objects.create_user(
            "elodie@example.fr",
            "Other123",
            first_name="Élodie",
            last_name="Existante",
            role=Role.STUDENT,
        )
        for payload in (PAYLOAD, {**PAYLOAD, "email": "pas-un-mail"}):
            self.assertEqual(self.signup(payload).status_code, 400)
            self.assertEqual(self.client.get("/api/me").status_code, 403)
