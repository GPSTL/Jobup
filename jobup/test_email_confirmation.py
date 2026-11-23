import re
from unittest import mock

from django.core import mail, signing
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from . import email_confirmation
from .models import Role, User

PAYLOAD = {
    "email": "nouveau@example.fr",
    "password": "Example123",
    "first_name": "Nina",
    "last_name": "Vidal",
    "role": "Student",
}
LOGIN = {"email": PAYLOAD["email"], "password": PAYLOAD["password"]}


def token_of(message) -> str:
    return re.search(r"token=([^\s]+)", message.body).group(1)


@override_settings(EMAIL_CONFIRMATION_REQUIRED=True)
class ConfirmationEnabledTests(APITestCase):
    def setUp(self):
        cache.clear()

    def signup(self, **extra):
        return self.client.post("/api/signup", {**PAYLOAD, **extra}, format="json")

    def test_signup_creates_an_unconfirmed_account_without_logging_in(self):
        response = self.signup()
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()["email_confirmation_required"])
        self.assertFalse(User.objects.get(email=PAYLOAD["email"]).email_confirmed)
        self.assertEqual(self.client.get("/api/me").status_code, 403)

    def test_signup_sends_one_email_with_a_link(self):
        self.signup()
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [PAYLOAD["email"]])
        self.assertIn("/confirm-email?token=", mail.outbox[0].body)

    @override_settings(DEBUG=True)
    def test_link_is_logged_plain_in_debug_only(self):
        with self.assertLogs("jobup.email_confirmation", "WARNING") as logs:
            self.signup()
        self.assertIn("/confirm-email?token=", logs.output[0])
        self.assertIn(token_of(mail.outbox[0]), logs.output[0])

    def test_invalid_signup_sends_nothing(self):
        self.signup(email="pas-un-mail")
        self.assertEqual(mail.outbox, [])

    def test_signup_succeeds_even_if_the_email_cannot_be_sent(self):
        with mock.patch(
            "jobup.email_confirmation.send_mail", side_effect=OSError("SMTP down")
        ):
            with self.assertLogs("jobup.email_confirmation", "ERROR"):
                response = self.signup()
        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(email=PAYLOAD["email"]).exists())

    def test_login_is_refused_until_the_address_is_confirmed(self):
        self.signup()
        response = self.client.post("/api/login", LOGIN, format="json")
        self.assertEqual(
            (response.status_code, response.json()),
            (403, {"error": "Email not confirmed"}),
        )
        self.assertEqual(self.client.get("/api/me").status_code, 403)

    def test_wrong_password_does_not_reveal_the_unconfirmed_state(self):
        self.signup()
        response = self.client.post(
            "/api/login", {**LOGIN, "password": "Mauvais123"}, format="json"
        )
        self.assertEqual(response.status_code, 401)

    def test_link_confirms_the_account_and_allows_login(self):
        self.signup()
        response = self.client.post(
            "/api/signup/confirm", {"token": token_of(mail.outbox[0])}, format="json"
        )
        self.assertEqual(
            (response.status_code, response.json()), (200, {"confirmed": True})
        )
        self.assertTrue(User.objects.get(email=PAYLOAD["email"]).email_confirmed)
        self.assertEqual(
            self.client.post("/api/login", LOGIN, format="json").status_code, 200
        )

    def test_link_can_be_used_twice(self):
        self.signup()
        token = token_of(mail.outbox[0])
        for _ in range(2):
            response = self.client.post(
                "/api/signup/confirm", {"token": token}, format="json"
            )
            self.assertEqual(response.status_code, 200)

    def test_bad_tokens_are_refused(self):
        self.signup()
        for payload in (
            {},
            {"token": ""},
            {"token": 12},
            {"token": "n-importe-quoi"},
            {"token": signing.dumps({"uid": 1}, salt="autre-sel")},
            {"token": signing.dumps({"nope": 1}, salt=email_confirmation.SALT)},
            {"token": signing.dumps("texte", salt=email_confirmation.SALT)},
        ):
            with self.subTest(payload=payload):
                response = self.client.post(
                    "/api/signup/confirm", payload, format="json"
                )
                self.assertEqual(
                    (response.status_code, response.json()), (400, {"error": "invalid"})
                )
        self.assertFalse(User.objects.get(email=PAYLOAD["email"]).email_confirmed)

    def test_non_object_body_is_refused(self):
        response = self.client.post("/api/signup/confirm", [1], format="json")
        self.assertEqual(response.status_code, 400)

    def test_expired_token_is_reported_as_expired(self):
        self.signup()
        token = token_of(mail.outbox[0])
        with override_settings(EMAIL_CONFIRMATION_MAX_AGE=-1):
            response = self.client.post(
                "/api/signup/confirm", {"token": token}, format="json"
            )
        self.assertEqual(
            (response.status_code, response.json()), (400, {"error": "expired"})
        )
        self.assertFalse(User.objects.get(email=PAYLOAD["email"]).email_confirmed)

    def test_token_is_void_when_the_address_changed(self):
        self.signup()
        token = token_of(mail.outbox[0])
        User.objects.update(email="autre@example.fr")
        response = self.client.post(
            "/api/signup/confirm", {"token": token}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_resend_sends_a_new_working_link(self):
        self.signup()
        response = self.client.post(
            "/api/signup/resend-confirmation",
            {"email": PAYLOAD["email"]},
            format="json",
        )
        self.assertEqual(response.status_code, 202)
        self.assertEqual(len(mail.outbox), 2)
        confirm = self.client.post(
            "/api/signup/confirm", {"token": token_of(mail.outbox[1])}, format="json"
        )
        self.assertEqual(confirm.status_code, 200)

    @override_settings(EMAIL_CONFIRMATION_RESEND_DELAY=60)
    def test_resend_is_rate_limited_per_account(self):
        self.signup()
        for _ in range(3):
            response = self.client.post(
                "/api/signup/resend-confirmation",
                {"email": PAYLOAD["email"]},
                format="json",
            )
            self.assertEqual(response.status_code, 202)
        self.assertEqual(len(mail.outbox), 2)

    def test_resend_does_not_reveal_which_addresses_exist(self):
        self.signup()
        User.objects.update(email_confirmed=True)
        mail.outbox.clear()
        for email in ("inconnu@example.fr", PAYLOAD["email"]):
            response = self.client.post(
                "/api/signup/resend-confirmation", {"email": email}, format="json"
            )
            self.assertEqual(
                (response.status_code, response.json()), (202, {"sent": True})
            )
        self.assertEqual(mail.outbox, [])

    def test_resend_skips_suspended_accounts(self):
        self.signup()
        User.objects.update(is_active=False)
        mail.outbox.clear()
        self.client.post(
            "/api/signup/resend-confirmation",
            {"email": PAYLOAD["email"]},
            format="json",
        )
        self.assertEqual(mail.outbox, [])

    def test_resend_rejects_a_bad_payload(self):
        for payload in ({}, {"email": 3}):
            response = self.client.post(
                "/api/signup/resend-confirmation", payload, format="json"
            )
            self.assertEqual(response.status_code, 400)

    def test_resend_is_throttled_per_ip(self):
        for _ in range(10):
            self.client.post(
                "/api/signup/resend-confirmation",
                {"email": "x@example.fr"},
                format="json",
            )
        response = self.client.post(
            "/api/signup/resend-confirmation", {"email": "x@example.fr"}, format="json"
        )
        self.assertEqual(response.status_code, 429)

    def test_existing_confirmed_accounts_still_log_in(self):
        User.objects.create_user(
            "ancien@example.fr",
            "Example123",
            first_name="A",
            last_name="B",
            role=Role.STUDENT,
        )
        response = self.client.post(
            "/api/login",
            {"email": "ancien@example.fr", "password": "Example123"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

    def test_every_public_role_is_covered(self):
        for index, role in enumerate(("Student", "Recruiter", "School Manager")):
            with self.subTest(role=role):
                response = self.signup(email=f"r{index}@example.fr", role=role)
                self.assertEqual(response.status_code, 201)
                self.assertFalse(
                    User.objects.get(email=f"r{index}@example.fr").email_confirmed
                )


@override_settings(EMAIL_CONFIRMATION_REQUIRED=False)
class ConfirmationDisabledTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_signup_keeps_the_direct_login_and_sends_nothing(self):
        response = self.client.post("/api/signup", PAYLOAD, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("email_confirmation_required", response.json())
        self.assertEqual(self.client.get("/api/me").status_code, 200)
        self.assertEqual(mail.outbox, [])
        self.assertTrue(User.objects.get(email=PAYLOAD["email"]).email_confirmed)

    def test_turning_the_flag_off_lets_unconfirmed_accounts_in(self):
        User.objects.create_user(
            PAYLOAD["email"],
            PAYLOAD["password"],
            first_name="N",
            last_name="V",
            role=Role.STUDENT,
            email_confirmed=False,
        )
        self.assertEqual(
            self.client.post("/api/login", LOGIN, format="json").status_code, 200
        )

    def test_resend_is_unavailable(self):
        response = self.client.post(
            "/api/signup/resend-confirmation",
            {"email": PAYLOAD["email"]},
            format="json",
        )
        self.assertEqual(response.status_code, 404)


class SettingTests(APITestCase):
    def test_flag_is_read_from_the_environment(self):
        import importlib
        import os

        from . import settings as project_settings

        cases = {
            "true": True,
            "1": True,
            "ON": True,
            " yes ": True,
            "false": False,
            "": False,
            "0": False,
        }
        for value, expected in cases.items():
            with (
                self.subTest(value=value),
                mock.patch.dict(os.environ, {"EMAIL_CONFIRMATION_REQUIRED": value}),
                mock.patch("dotenv.load_dotenv"),
            ):
                reloaded = importlib.reload(project_settings)
                self.assertEqual(reloaded.EMAIL_CONFIRMATION_REQUIRED, expected)
        importlib.reload(project_settings)

    def test_flag_is_off_by_default(self):
        import importlib
        import os

        from . import settings as project_settings

        env = {
            k: v for k, v in os.environ.items() if k != "EMAIL_CONFIRMATION_REQUIRED"
        }
        with (
            mock.patch.dict(os.environ, env, clear=True),
            mock.patch("dotenv.load_dotenv"),
        ):
            self.assertFalse(
                importlib.reload(project_settings).EMAIL_CONFIRMATION_REQUIRED
            )
        importlib.reload(project_settings)
