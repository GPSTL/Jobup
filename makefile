FRONT_SRC = jobup/front/App.tsx
FRONT_DST = jobup/static/dist/app.js

.PHONY: init migrate all debug run_only run run_debug

all:
	npx esbuild $(FRONT_SRC) --bundle --outfile=$(FRONT_DST) --minify --loader:.tsx=tsx

debug:
	npx esbuild $(FRONT_SRC) --bundle --outfile=$(FRONT_DST) --loader:.tsx=tsx

run_only:
	python manage.py runserver

run: all run_only

run_debug: debug run_only

migrate:
	python manage.py makemigrations
	python manage.py migrate

init:
	pip install -r requirements.txt
	npm install
	$(MAKE) migrate
