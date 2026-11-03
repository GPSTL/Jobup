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

## Recruiter offers (JOB-022)

Recruiters land on `/recruiter/offers` after login. Cards show the title, image
and description; “Plus d’informations” opens `/recruiter/offers/:id`. Pagination
runs entirely in the frontend, using `?page=` in the browser URL and three
offers per page. Offers are ordered newest first (ID breaks date ties).
Returning from a detail preserves the originating page. Loading, retry, empty,
missing-offer and missing-page states are included. The public `/offers` page
remains the student discovery page.

`GET /api/recruiter/offers` returns a JSON array of all authorized offers.
The frontend fetches the list once and slices it locally; changing pages does
not send another API request. The API does not paginate or interpret `page`.
`GET /api/recruiter/offers/:id` returns one offer. Both require a recruiter
session and select only that individual recruiter's active offers, including
when colleagues share a company. Other owners' offers, inactive offers and
missing IDs all return 404. The individual recruiter ownership scope is a
conservative implementation assumption pending product confirmation.

The existing Offer model now supports an optional `image_url`; absent or broken
images use the locally downloaded Figma team photo. Run `make migrate` against an existing
checkout to generate/apply the field migration (this repository ignores generated
migrations). Do not reset an existing database. Creation, editing, deletion and candidate consultation remain outside this ticket.
Creation, candidate, edit and delete controls remain visible in their original
positions, disabled until the corresponding workflows are available.

For local pagination checks, use an existing recruiter account with a Recruiter
profile and company, then run:

```bash
python manage.py seed_recruiter_offers recruiter@example.com
python manage.py test jobup.test_offers
npx tsc --noEmit
make all
```

The seed command adds 14 clearly labelled offers for that account, is repeatable,
and does not change passwords or create accounts. Use a development database.
Check pages 1–5, direct detail/reload, keyboard links, mobile layout, an unknown
ID, and access using a different recruiter or a non-recruiter account.

The layout retains the Figma composition: rounded recruiter navigation, three
cards per page, centered titles above the original team image, description and
blue detail link, then candidate and edit/delete actions. Refinements are limited
to more readable typography and line spacing, balanced card padding, softer
shadows, subtle borders and a quieter background. The detail retains its original
image-and-information layout. Mobile layouts and reduced-motion preferences are
supported. Assets are stored in `jobup/static/img/recruiter/`.
