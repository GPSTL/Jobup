# Guidance for AI coding agents

These instructions apply to the entire repository. Read this file before making
changes, and follow any additional `AGENTS.md` instructions in subdirectories.

## Git and user control

- Do not commit or push unless the user explicitly asks you to do so. Permission
  to edit files, implement a feature, or run checks is not permission to commit
  or push. Permission to commit does not automatically authorize a push.
- Leave changes in the working tree for the user to review.
- Inspect `git status` before editing. Preserve existing changes and do not
  revert, overwrite, or discard work you did not create.
- Do not reset branches, force-push, or rewrite history without an explicit
  user request.

## Project structure

- `jobup/`: Django backend, API, models, and backend tests.
- `front/`: React and TypeScript frontend with Tailwind CSS.
- `tests/`: frontend tests using Node's test runner, bundled with esbuild.
- `scripts/test-frontend.mjs`: frontend test discovery and runner.
- `makefile`: frontend builds and local development commands.
- `.github/workflows/ci.yml`: frontend and backend CI jobs.

CI uses Node.js 24 and Python 3.14. See `README.md` for setup and development.

## Making changes

- Keep changes focused on the user's request and follow nearby code conventions.
- Inspect relevant implementation and tests before changing behavior.
- Add or update meaningful tests when behavior changes. Do not weaken checks or
  change expected behavior merely to make a failing test pass.
- Keep frontend payloads, validation, and backend API contracts consistent.
- Use the repository's virtual environment for Python commands when available.
- Never add secrets, `.env` contents, local databases, uploaded files, or generated
  build output to version control.
- Do not run `make init` or `make reset_db` against an existing checkout without
  explicit approval: they delete `db.sqlite3`. Install dependencies directly
  with `python -m pip install -r requirements-dev.txt` and `npm ci` instead.
- Migrations are currently ignored by Git and generated locally. Do not change
  that convention or alter an existing database as an incidental cleanup.

## Validation

Run the checks relevant to your changes. For changes affecting both stacks,
use the same checks as CI:

```sh
npm run lint
npm run typecheck
npm test
npm run build

# Activate .venv first, or use its executables directly.
ruff check jobup manage.py
ruff format --check jobup manage.py
python manage.py check
python -m pytest -v
```

Pytest enforces the configured 90% minimum coverage. CI generates migrations
in its disposable checkout before running backend tests. Do not use a user's
database as a disposable test database.

Before handing work back, review the diff and run `git diff --check`. Summarize
what changed, which checks passed, and any checks you could not run. Do not claim
that a GitHub Actions run passed based only on local verification.
