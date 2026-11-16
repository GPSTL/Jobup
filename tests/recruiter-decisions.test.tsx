import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import { RecruiterApplicationContent } from "../front/pages/RecruiterApplicationPage";
import { ApplicationDetailView } from "../front/pages/ApplicationDetailPage";
import { decideApplication, getRecruiterApplication, type RecruiterApplication } from "../front/services/recruiterOffers";
import { STATUS } from "../front/utils/applications";

const sample: RecruiterApplication = {
	id: 20,
	offer: { id: 12, title: "Développeur Java", description: "Alternance", created_at: "2026-10-01T09:00:00Z", is_active: true },
	candidate: { id: 7, first_name: "Lucas", last_name: "Martin", school: null, education: null, description: "", photo_url: null, cv_url: null },
	status: STATUS.IN_REVIEW, submitted_at: "2026-10-10T09:00:00Z", message: "Je suis motivé", decision_message: "", conversation_id: null,
};
const render = (application: RecruiterApplication) => renderToStaticMarkup(
	<MemoryRouter><RecruiterApplicationContent application={application} saving={false} error="" onDecision={() => {}} /></MemoryRouter>,
);
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("détail recruteur : statut et décision, message facultatif, profil accessible", () => {
	const html = render(sample);
	assert.match(html, /En cours d’étude/);
	assert.match(html, /Ouvrir la candidature|Candidature — Développeur Java/);
	assert.match(html, /Je suis motivé/);
	assert.match(html, /Message au candidat \(facultatif\)/);
	assert.match(html, /maxLength="1024"/);
	assert.match(html, />Accepter<|>Refuser</);
	assert.match(html, /href="\/recruiter\/candidates\/7\?offer=12"/);
	assert.match(html, /href="\/recruiter\/offers\/12\/applicants"/);
});

test("décision acceptée : pas de seconde décision, conversation réutilisée", () => {
	const html = render({ ...sample, status: STATUS.ACCEPTED, decision_message: "Bienvenue !", conversation_id: 42 });
	assert.doesNotMatch(html, />Accepter<|>Refuser<|<textarea/);
	assert.match(html, /Décision enregistrée : Acceptée/);
	assert.match(html, /Bienvenue !/);
	assert.match(html, /href="\/recruiter\/messages\/42"/);
});

test("décision refusée : message visible sans ouverture de conversation", () => {
	const html = render({ ...sample, status: STATUS.REFUSED, decision_message: "Non retenu" });
	assert.match(html, /Décision enregistrée : Refusée/);
	assert.match(html, /Non retenu/);
	assert.doesNotMatch(html, /Ouvrir la conversation|>Accepter<|>Refuser</);
});

test("l’étudiant voit le message associé à la décision, sans altérer sa présentation", () => {
	const html = renderToStaticMarkup(<MemoryRouter><ApplicationDetailView application={{
		id: 20, offer: { id: 12, title: "Développeur Java" }, company: "Acme", status: STATUS.ACCEPTED,
		status_label: "Accepted", submitted_at: sample.submitted_at, updated_at: sample.submitted_at,
		message: "Je suis motivé", decision_message: "Bienvenue !", documents: { resume: null, cover_letter: null },
	}} /></MemoryRouter>);
	assert.match(html, /Message du recruteur/);
	assert.match(html, /Bienvenue !/);
	assert.match(html, /Présentation envoyée/);
	assert.match(html, /Je suis motivé/);
});

test("API : ouverture de la candidature et décision PATCH avec CSRF, sans doublons côté client", async () => {
	const calls: Array<{ url: string; init?: RequestInit }> = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		if (url === "/api/csrf") return Response.json({ csrfToken: "token" });
		return Response.json({ ...sample, status: STATUS.ACCEPTED, conversation_id: 42 });
	}) as typeof fetch;
	assert.equal((await getRecruiterApplication("20")).ok, true);
	const result = await decideApplication(20, STATUS.ACCEPTED, "Bonjour");
	assert.equal(result.ok, true);
	assert.deepEqual(calls.map(({ url }) => url), [
		"/api/recruiter/applications/20", "/api/csrf", "/api/recruiter/applications/20",
	]);
	assert.equal(calls[2].init?.method, "PATCH");
	assert.equal((calls[2].init?.headers as Record<string, string>)["X-CSRFToken"], "token");
	assert.equal(calls[2].init?.credentials, "same-origin");
	assert.deepEqual(JSON.parse(calls[2].init?.body as string), { status: STATUS.ACCEPTED, message: "Bonjour" });
});

test("API : conflit de décision et erreur d'autorisation", async () => {
	globalThis.fetch = (async (url: string) => url === "/api/csrf"
		? Response.json({ csrfToken: "token" })
		: new Response("", { status: 409 })) as typeof fetch;
	assert.deepEqual(await decideApplication(20, STATUS.REFUSED, ""), { ok: false, reason: "conflict" });
	globalThis.fetch = (async () => new Response("", { status: 404 })) as typeof fetch;
	assert.deepEqual(await getRecruiterApplication("20"), { ok: false, reason: "notFound" });
});
