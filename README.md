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

## Recruiter offer editing and withdrawal (JOB-023)

Recruiters sign in at `/login` and land on `/recruiter/offers`. Each offer has
an edit action, a deletion confirmation, and a detail link. Edits are prefilled;
failed requests preserve the form and allow retry. Pending operations disable
controls. The public `/offers` page now reads published offers from the API.

This checkout did not include JOB-022. Its necessary list/detail foundation is
included here using the API paths and individual-recruiter ownership convention
found in the adjacent JOB-022 worktree. Reconcile these shared files when merging
both tickets. Figma comparison confirms the UI is provisional: editing uses a
two-column modal instead of the designed single-column page, image editing uses
a URL instead of an upload control, and navigation/cards/deletion styling differ.
Visual matching and native browser keyboard/mobile verification remain unfinished.

API contract:

- `GET /api/recruiter/offers?page=1`: own active offers, six per page.
- `GET /api/recruiter/offers/<id>`: own active offer details.
- `PATCH /api/recruiter/offers/<id>`: partial update of `title`, `description`,
  `image_url`, `requirements` (skills), `contract_type`, `duration`, `start_date`,
  `company` (display name only), and `location`. Validation errors return `400`
  with field-name arrays. Session authentication and CSRF are required for writes.
- `DELETE /api/recruiter/offers/<id>`: withdraws the offer (`is_active=False`),
  returns `204`, and retains the offer and its applications. Further reads,
  edits, and deletions return `404`. Other recruiters also receive `404`, even
  if they belong to the same company; other roles and anonymous users get `403`.
- `GET /api/offers` and `/api/offers/<id>`: only active offers. The paginated list
  supports `q`, `location`, and numeric `category` filters.

Provisional choices for the ticket's open questions: withdrawal preserves data;
images use optional HTTP(S) URLs up to 200 characters (no upload API); only title
and description are required. Contract values are blank, `alternance`, `stage`,
`cdd`, or `cdi`; dates use `YYYY-MM-DD` or null, duration is free text (64 characters).
Company display names never update Company records or transfer ownership.
Existing offers keep their original title, description, category and ownership;
new fields default to blank/null. Recruiter signup and offer creation remain
outside this ticket; use prepared recruiter accounts and offers.

As elsewhere in this repository, migrations are generated locally and ignored.
After updating, activate your Python environment and run `make migrate` to add the
fields without resetting data. Do not run `make init` on an existing database.
Then run:

```bash
python manage.py test jobup.test_offers
npm install
npm run test:offers
npx tsc --noEmit
make all
```

After integration with current main, all 32 Django tests pass, including the 11
offer tests. Validation used the current models to generate the test schema
(`MIGRATION_MODULES={"jobup": None}`), since this repository ignores local migrations.
