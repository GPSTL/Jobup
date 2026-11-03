# Jobup Web Application

A "setup" application built with Django (Python) on the backend and React with TypeScript on the frontend.

## Prerequisites

- **Python** 3.10+
- **npm** 10.+
- **make** and a Unix shell (Linux, macOS or WSL)

## Setup

Optionally, create and activate a virtual environment first:

```bash
python -m venv .venv
source .venv/bin/activate
```

Then install the Python and npm dependencies (including esbuild and Tailwind) and set up the database:

```bash
make init
```

Run `make init` again whenever `requirements.txt` or `package.json` changes.

## Development

To start the Django development server and rebuild the frontend automatically:

```bash
make dev
```

This runs three processes in the same terminal:

- esbuild, which rebuilds `jobup/static/dist/app.js` whenever a file in `front/` changes;
- Tailwind, which rebuilds `jobup/static/dist/app.css` whenever `front/app.css` or a class used in `front/` changes;
- the Django development server.

After saving a file, reload the page in the browser to see the change. Press `Ctrl+C` once to stop all three processes.

## Running the Application

To build a minified frontend bundle and start the Django development server:

```bash
make run
```

Once running, access the application at `http://127.0.0.1:8000/`.

## Makefile Targets

| Target | Description |
|---|---|
| `make init` | Installs the Python and npm dependencies, then runs `make migrate`. |
| `make dev` | Starts the server and rebuilds the JS and CSS on every change. Recommended for day-to-day work. |
| `make run` | Builds the minified JS and CSS (`make all`), then starts the server. |
| `make run_debug` | Builds the non-minified JS and CSS (`make debug`), then starts the server. |
| `make all` | Builds the minified JS and CSS without starting the server. |
| `make debug` | Builds the non-minified JS and CSS without starting the server. |
| `make run_only` | Starts the server without rebuilding the frontend. |
| `make migrate` | Creates and applies the database migrations of the `jobup` app. |
| `make watch_js` | Rebuilds the JS on every change. Used by `make dev`. |
| `make watch_css` | Rebuilds the CSS on every change. Used by `make dev`. |

## Signup and login forms (JOB-027)

Activate `.venv` with `source .venv/bin/activate`. The student form at
`/signup?role=student` now requires only `prenom`, `nom`, `email`, and `password`.
React Hook Form uses the Zod resolver; names allow letters, spaces, apostrophes
and hyphens (32 characters maximum), email is trimmed, and passwords require
at least eight characters, an ASCII uppercase letter, and a digit.

The login form at `/login` also uses React Hook Form and a Zod resolver. It
validates the email and requires a password, preserving support for existing
passwords without applying signup strength rules. Successful login redirects to
`/student`, protected by JOB-006’s `RequireStudent` session guard. API errors retain entered
values, and submit buttons are disabled while requests are pending.

`GET /api/csrf` issues a CSRF token and cookie. `POST /api/signup` takes those four
fields plus the optional frontend marker `role: "student"`; the server assigns
the student role independently and rejects non-student role values. It returns `201` with the public user data,
`400` with `{ "errors": { "field": "French message" } }` for invalid input, or
`409` with an email error for a duplicate address (case insensitive). Creation
of the account and student profile is atomic. Passwords are hashed; signup does
not automatically log in. Success prompts the user to follow the login link.

The role selector from JOB-028 is retained and follows `?role=` on direct links
and reloads. Only the student form can submit. School and company forms retain their fields
(including phone) but are disabled with an explicit unavailable message until
their signup APIs exist; they cannot submit to the student endpoint. Changing roles unmounts the
student form and clears its in-memory values.

Phone, school and domain are absent from the form, schema and request. Student
`category` and `study_degree` now allow NULL; school was already optional.
Existing profile data is preserved. With this repository's locally generated
migrations, run `make migrate` after updating an existing checkout to generate
and apply the nullable-field changes. **Do not run `make init` on an existing
database: that target deletes it.** No data migration or placeholder category is
needed. This updates the signup contract referenced by JOB-003/JOB-005 and the
original ETU-01 requirement. Later profile completion and initial offer selection
without a category remain product decisions outside JOB-027.

Validation commands:

```bash
.venv/bin/python manage.py test
npx tsc --noEmit
npx esbuild tests/signup.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/job027-signup-test.cjs
node --test /tmp/job027-signup-test.cjs
npx esbuild tests/login.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/job027-login-test.cjs
node --test /tmp/job027-login-test.cjs
npx esbuild tests/auth-forms.test.tsx --bundle --platform=node --format=cjs --jsx=automatic --outfile=/tmp/job027-auth-forms-test.cjs
node --test /tmp/job027-auth-forms-test.cjs
make all
```

Browser checks: open `/signup?role=student`, submit empty and invalid fields,
create a disposable account using only the four remaining fields, then submit
the same email again. Check that API/network errors preserve entered values,
keyboard focus reaches each field, and mobile has no horizontal overflow.

## Recruiter offer creation (JOB-51)

Recruiters can open `/recruiter/offers`, choose **Créer une offre**, and publish
from `/recruiter/offers/new`. Success opens the new offer's detail with a
confirmation; it also appears first in the recruiter list. Cancel returns to
the list without writing. Field errors, expired access and network failures
preserve the form for retry, and pending publication disables duplicate submits.

This work reuses JOB-22's recruiter list/detail, guard, and styling without
bringing in its unrelated signup changes. Offer fields match JOB-23's editing
model: title, description, category, requirements, image URL, contract type,
duration, start date, display company name, and location. JOB-23's edit/delete
work remains separate. Title, description, and category are required. Omitting
the display name uses the recruiter's company name.

`GET /api/recruiter/offers/categories` returns the model's category values and
labels. `POST /api/recruiter/offers` accepts the creation fields above and returns
`201` with the persisted offer, or `400` with field error arrays. The server
assigns the current recruiter's profile and active status; unknown fields,
including ownership/publication overrides, are rejected. A recruiter session
and CSRF token are required. Recruiters without a profile receive `404`.
The JOB-22 recruiter GET list/detail remain scoped to the individual recruiter.

After installing updated npm dependencies, run `make migrate` to generate and
apply the additional optional offer fields using this repository's local
migration convention. Existing offers retain their data. Use `make migrate`
on an existing database; `make init` deletes the database.

Validation:

```bash
python manage.py test jobup.test_offers
npm run test:create-offer
npx tsc --noEmit
make all
```

The unchanged base revision also has seven backend test errors: six student API
fixtures refer to the removed `Student.age` field, and one signup fixture omits
required user names. These remain outside JOB-51.

For combined JOB-22/JOB-23/JOB-51 testing, see [OFFERS_TESTING.md](OFFERS_TESTING.md). The combined branch includes the shared signup/model updates and all 47 backend tests pass.
