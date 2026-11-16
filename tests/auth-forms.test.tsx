import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import Inscription from "../front/pages/Inscription";

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
