# Jobup Web Application

A "setup" application built with Django (Python) on the backend and React with TypeScript on the frontend.

## Prerequisites

- **Python** 3.14 (used in CI)
- **Node.js** 24 (used in CI)
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

## Continuous integration

GitHub Actions runs [CI](.github/workflows/ci.yml) for every pull request,
push to `main`, and manual run from the Actions tab. Two jobs run in parallel:

- **Frontend**: ESLint (including React Hooks rules), strict TypeScript checking
  of application and test code, all `tests/*.test.ts` and `tests/*.test.tsx`
  tests, and the minified JS/CSS build.
- **Backend**: Ruff lint and format checks, Django system checks, and pytest
  with the existing 90% minimum coverage requirement.

Install the development tools once, then run the same checks locally:

```bash
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
npm ci

npm run lint
npm run typecheck
npm test
npm run build
ruff check jobup manage.py
ruff format --check jobup manage.py
python manage.py check
python -m pytest -v
```

The workflow generates Django migrations in its disposable checkout because
this repository currently ignores migration files. No production secrets or
external database are needed. Tracking migrations and checking for missing
migrations is a recommended follow-up.

After pushing this workflow and getting a successful run, configure a branch
ruleset in GitHub **Settings → Rules → Rulesets** for `main`: require pull
requests and require the **Frontend** and **Backend** status checks before
merging. This repository change does not configure those GitHub settings.

This workflow provides CI. Automatic deployment can be added separately once
the hosting environment is chosen.

## Running the development server

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
| `make seed` | Fills the database with a complete demo (local use, can be run again): see below. |
| `make watch_js` | Rebuilds the JS on every change. Used by `make dev`. |
| `make watch_css` | Rebuilds the CSS on every change. Used by `make dev`. |

## Demo data

After `make migrate`, `make seed` (or `python manage.py seed_demo`) creates a recruiter, its candidates, offers, applications, shortlist, an excluded candidate and conversations, including a message with a PDF attachment (JOB-043) and one with a Word document. It refuses to run when `DEBUG` is off, and running it again creates nothing new.

| Account | Email | Password | To see |
|---|---|---|---|
| Recruiter | `recruteur@demo.jobup.fr` | `Demo1234` | `/recruiter/candidates`, a profile with its exchange history, `/recruiter/shortlist` |
| Student | `lucas.martin@demo.jobup.fr` | `Demo1234` | `/messages` (the conversation with the file to download), `/applications` |
| School employee | `ecole@demo.jobup.fr` | `Demo1234` | the other side of Lucas's second conversation |

The recruiter's message page (JOB-041) does not exist yet: the files sent by the recruiter are seen and downloaded from the student account.

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