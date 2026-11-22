import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import Inscription from "../front/pages/Inscription";
import Connexion from "../front/pages/Connexion";
import HomePage from "../front/pages/HomePage";
import StudentPage from "../front/pages/StudentPage";
import SchoolPage from "../front/pages/SchoolPage";
import ComingSoonPage from "../front/pages/ComingSoonPage";
import NotFoundPage from "../front/pages/NotFoundPage";
import ThemeToggle from "../front/components/ThemeToggle";

function renderSignup(role: string) {
	return renderToStaticMarkup(<MemoryRouter initialEntries={[`/signup?role=${role}`]}><Inscription /></MemoryRouter>);
}

// Même formulaire pour les trois rôles depuis JOB-003 : prénom, nom, e-mail et mot de passe
const FIELDS = ["first_name", "last_name", "email", "password"];

test("student signup renders four enabled fields and excludes phone, school and domain", () => {
	const html = renderSignup("student");
	for (const field of FIELDS) assert.match(html, new RegExp(`name="${field}"`));
	for (const field of ["telephone", "etablissement", "domaine"]) assert.doesNotMatch(html, new RegExp(`name="${field}"`));
	assert.doesNotMatch(html, /<fieldset disabled/);
	assert.match(html, /<input(?=[^>]*value="student")(?=[^>]*checked)[^>]*>/);
	assert.match(html, /<label for="prenom"[^>]*>Prénom<\/label>/);
	assert.match(html, /href="\/login"/);
});

test("school and company selections preserve role and use the same enabled form", () => {
	for (const role of ["school", "recruiter"]) {
		const html = renderSignup(role);
		assert.match(html, new RegExp(`<input(?=[^>]*value="${role}")(?=[^>]*checked)[^>]*>`));
		for (const field of FIELDS) assert.match(html, new RegExp(`name="${field}"`));
		assert.doesNotMatch(html, /<fieldset disabled/);
		assert.match(html, /<button[^>]*type="submit"[^>]*>S’inscrire<\/button>/);
		assert.match(html, /href="\/login"/);
	}
});

test("an unknown role falls back to student", () => {
	assert.match(renderSignup("admin"), /<input(?=[^>]*value="student")(?=[^>]*checked)[^>]*>/);
});

test("landing and role pages render modern sections, navigation, footer and theme toggle", () => {
	const home = renderToStaticMarkup(<MemoryRouter><HomePage /></MemoryRouter>);
	assert.doesNotMatch(home, /data-theme="dark"/);
	assert.match(home, /Ton succès commence/);
	assert.match(home, /Un parcours pensé pour chaque acteur/);
	assert.match(home, /Comment fonctionne JobUp \?/);
	assert.match(home, /href="\/students"/);
	assert.match(home, /href="\/schools"/);
	assert.match(home, /href="\/offers"/);
	assert.match(home, /aria-label="Pied de page"/);

	const student = renderToStaticMarkup(<MemoryRouter><StudentPage /></MemoryRouter>);
	assert.match(student, /Pour les étudiants/);
	assert.match(student, /href="\/signup\?role=student"/);
	assert.match(student, /aria-label="Pied de page"/);

	const school = renderToStaticMarkup(<MemoryRouter><SchoolPage /></MemoryRouter>);
	assert.match(school, /Pour les écoles et CFA/);
	assert.match(school, /href="\/signup\?role=school"/);
	assert.match(school, /aria-label="Pied de page"/);

	const toggle = renderToStaticMarkup(<ThemeToggle />);
	assert.match(toggle, /aria-label="Activer le mode sombre"/);
	assert.match(toggle, /Sombre/);

	const login = renderToStaticMarkup(<MemoryRouter><Connexion /></MemoryRouter>);
	assert.match(login, /Connexion/);
	assert.match(login, /Espace membre/);

	const comingSoon = renderToStaticMarkup(<MemoryRouter><ComingSoonPage /></MemoryRouter>);
	assert.match(comingSoon, /Bientôt disponible/);
	assert.match(comingSoon, /aria-label="Pied de page"/);

	const notFound = renderToStaticMarkup(<MemoryRouter><NotFoundPage /></MemoryRouter>);
	assert.match(notFound, /404/);
	assert.match(notFound, /aria-label="Pied de page"/);
});
