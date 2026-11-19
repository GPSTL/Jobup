# E-mail confirmation at signup

Optional feature, controlled by one environment variable.

| Variable | Default | Effect |
|---|---|---|
| `EMAIL_CONFIRMATION_REQUIRED` | `false` | `true`, `1`, `yes` or `on` (any case) enables the feature. Anything else disables it. |
| `EMAIL_CONFIRMATION_MAX_AGE` | `259200` (3 days) | Validity of the link, in seconds. |
| `EMAIL_CONFIRMATION_RESEND_DELAY` | `60` | Minimum delay between two e-mails for the same account, in seconds. |

Set them in the environment or in a `.env` file (loaded by `python-dotenv`), then restart the
server. The e-mail itself is sent with the existing `MAILERS` setting: with `THE_EMAIL_ADDRESS` /
`THE_PASSWORD` it goes through SMTP, otherwise it is printed in the server console.
`SITE_URL` (default `http://127.0.0.1:8000`) is the base of the link.

## Behaviour

| | Flag off (default) | Flag on |
|---|---|---|
| `POST /api/signup` | Creates the account and opens the session, as before. | Creates the account with `email_confirmed = false`, **does not open a session**, sends the link and answers `201` with the public user data plus `"email_confirmation_required": true`. |
| `POST /api/login` | `email_confirmed` is ignored. | Right password but unconfirmed address: `403 {"error": "Email not confirmed"}`. A wrong password stays `401`, so the state is not revealed. |
| `POST /api/signup/resend-confirmation` | `404` | See below. |
| `POST /api/signup/confirm` | Works (idempotent). | Works. |

Existing accounts have `email_confirmed = true` (column default), so enabling the flag locks nobody
out, and disabling it lets every account in again. No migration is needed.

## Endpoints

### `POST /api/signup/confirm`

Body: `{"token": "<token from the link>"}`. Anonymous.

- `200 {"confirmed": true}`: the address is confirmed. Calling it again with the same link also
  answers `200`.
- `400 {"error": "expired"}`: the link is older than `EMAIL_CONFIRMATION_MAX_AGE`.
- `400 {"error": "invalid"}`: missing, altered or foreign token, unknown account, or the account
  e-mail changed since the link was sent.

The link in the e-mail points to the frontend page `/confirm-email?token=…`, which posts the
token. Confirmation is deliberately not done by a `GET`, so mail scanners that open links do not
confirm accounts.

### `POST /api/signup/resend-confirmation`

Body: `{"email": "…"}`. Anonymous. With the flag on, always `202 {"sent": true}`, whether or not the
address is registered or already confirmed, so it cannot be used to discover accounts. An e-mail is
sent only for an active, unconfirmed account and at most once per `EMAIL_CONFIRMATION_RESEND_DELAY`.
Limited to 10 requests per hour per IP (`429` beyond). `400` for a malformed body, `404` with the
flag off.

## Token

Signed with `django.core.signing` (`SECRET_KEY`, salt `jobup.email-confirmation`), carrying the
user id and e-mail, with a maximum age. Nothing is stored in the database. **Set a real
`SECRET_KEY` in production.**

## Code

`jobup/email_confirmation.py` (tokens, e-mail, endpoints), `SignupSerializer.create` (initial
state), `api.signup` and `api.api_login` (gating), `jobup/test_email_confirmation.py`. Frontend:
`front/pages/ConfirmEmailPage.tsx`, `front/components/ResendConfirmation.tsx`, the signup and login
pages, `front/services/auth.ts`, `tests/email-confirmation.test.tsx`.
