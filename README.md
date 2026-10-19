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
