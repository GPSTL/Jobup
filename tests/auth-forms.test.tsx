import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import Inscription from "../front/pages/Inscription";

function renderSignup(role: string) {
	return renderToStaticMarkup(<MemoryRouter initialEntries={[`/signup?role=${role}`]}><Inscription /></MemoryRouter>);
}

test("student signup renders four enabled fields and excludes phone, school and domain", () => {
	const html = renderSignup("student");
	for (const field of ["prenom", "nom", "email", "password"]) assert.match(html, new RegExp(`name="${field}"`));
	for (const field of ["telephone", "etablissement", "domaine"]) assert.doesNotMatch(html, new RegExp(`name="${field}"`));
	assert.doesNotMatch(html, /<fieldset disabled/);
	assert.match(html, /<input(?=[^>]*value="student")(?=[^>]*checked)[^>]*>/);
});

test("school and company selections preserve role and disable unsupported signup", () => {
	for (const role of ["school", "recruiter"]) {
		const html = renderSignup(role);
		assert.match(html, new RegExp(`<input(?=[^>]*value="${role}")(?=[^>]*checked)[^>]*>`));
		assert.match(html, /name="telephone"/);
		assert.match(html, /<fieldset disabled/);
		assert.match(html, /<button disabled="" type="submit"/);
		assert.match(html, /sera bientôt disponible/);
		assert.match(html, /href="\/login"/);
	}
});
