FRONT_SRC = front/App.tsx
FRONT_DST = jobup/static/dist/app.js

.PHONY: init migrate all debug run_only run run_debug reset_db test

all:
	npx esbuild $(FRONT_SRC) --bundle --outfile=$(FRONT_DST) --minify --loader:.tsx=tsx

debug:
	npx esbuild $(FRONT_SRC) --bundle --outfile=$(FRONT_DST) --loader:.tsx=tsx

run_only:
	python manage.py runserver

run: all run_only

run_debug: debug run_only

migrate:
	python manage.py makemigrations jobup
	python manage.py migrate

reset_db:
	rm -f db.sqlite3
	rm -rf jobup/migrations

init: reset_db
	pip install -r requirements.txt
	npm install
	$(MAKE) migrate

test:
	pytest -v