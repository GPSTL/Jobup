FRONT_SRC = front/App.tsx
FRONT_DST = jobup/static/dist/app.js
CSS_SRC = front/app.css
CSS_DST = jobup/static/dist/app.css

.PHONY: init migrate all debug run_only run run_debug dev watch_js watch_css

all:
	npx esbuild $(FRONT_SRC) --bundle --outfile=$(FRONT_DST) --minify --loader:.tsx=tsx
	npx @tailwindcss/cli -i $(CSS_SRC) -o $(CSS_DST) --minify

debug:
	npx esbuild $(FRONT_SRC) --bundle --outfile=$(FRONT_DST) --loader:.tsx=tsx
	npx @tailwindcss/cli -i $(CSS_SRC) -o $(CSS_DST)

run_only:
	python manage.py runserver

run: all run_only

run_debug: debug run_only

watch_js:
	npx esbuild $(FRONT_SRC) --bundle --outfile=$(FRONT_DST) --loader:.tsx=tsx --watch=forever

watch_css:
	npx @tailwindcss/cli -i $(CSS_SRC) -o $(CSS_DST) --watch=always

dev:
	$(MAKE) -j3 watch_js watch_css run_only

migrate:
	python manage.py makemigrations jobup
	python manage.py migrate

init:
	pip install -r requirements.txt
	npm install
	$(MAKE) migrate
