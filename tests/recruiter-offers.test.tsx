import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import { CandidateProfile } from "../front/pages/CandidateProfilePage";
import { OfferApplicantsContent } from "../front/pages/OfferApplicantsPage";
import { OfferRequestState, RecruiterOfferList } from "../front/pages/RecruiterOffersPage";
import { getOfferApplicants, getRecruiterOffers, type OfferApplicants } from "../front/services/recruiterOffers";
import { STATUS } from "../front/utils/applications";

const offer = { id: 12, title: "Développeur Java", description: "Une alternance de 12 mois.", created_at: "2026-10-10T09:00:00Z", is_active: true };
const candidate = { id: 7, first_name: "Lucas", last_name: "Martin", photo_url: null, education: null, school: null, description: "", cv_url: null };
const data: OfferApplicants = {
	offer,
	applications: [STATUS.SUBMITTED, STATUS.READ, STATUS.IN_REVIEW, STATUS.ACCEPTED, STATUS.REFUSED].map((status, index) => ({
		id: index + 1, candidate: { ...candidate, id: index + 7, first_name: `Prénom${index}` }, status, submitted_at: "2026-10-15T09:00:00Z",
	})),
};
const render = (node: React.ReactNode, query = "") => renderToStaticMarkup(<MemoryRouter initialEntries={[`/recruiter/offers/12/applicants${query}`]}>{node}</MemoryRouter>);
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("chaque offre possède un lien vers ses propres candidatures, y compris une offre clôturée", () => {
	const html = render(<RecruiterOfferList offers={[{ ...offer, applicant_count: 2 }, { ...offer, id: 13, title: "Data analyst", is_active: false, applicant_count: 0 }]} />);
	assert.match(html, /href="\/recruiter\/offers\/12\/applicants"/);
	assert.match(html, /href="\/recruiter\/offers\/13\/applicants"/);
	assert.equal((html.match(/Consulter la liste de candidats/g) ?? []).length, 2);
	assert.match(html, /Clôturée/);
	assert.match(render(<RecruiterOfferList offers={[]} />), /aucune offre/);
});

test("candidats : contexte de l’offre, statuts, dates, identité partagée et profil avec lien de retour", () => {
	const html = render(<OfferApplicantsContent data={data} />);
	assert.match(html, /<h1[^>]*>Développeur Java<\/h1>/);
	assert.match(html, /5 candidatures/);
	assert.match(html, /Toutes \(5\)/);
	assert.match(html, /En cours d’étude \(2\)/);
	assert.match(html, /École non renseignée/);
	assert.match(html, /Reçue le/);
	assert.match(html, /href="\/recruiter\/candidates\/7\?offer=12"/);
	assert.equal((html.match(/<li /g) ?? []).length, 5);
	// Decision controls belong to JOB-044; viewing applicants must remain read-only.
	assert.doesNotMatch(html, />Accepter<|>Refuser<|Déposer le contrat/);
	const profile = { ...candidate, region: "", study_degree: null, available_from: null, skills: [], experiences: [], exchanges: [] };
	const back = render(<CandidateProfile candidate={profile} />, "?offer=12");
	assert.match(back, /href="\/recruiter\/offers\/12\/applicants"/);
	assert.match(back, /Retour aux candidats de l’offre/);
});

test("filtre conservé dans l’URL, READ et IN_REVIEW regroupés, filtre inconnu ramené à Toutes", () => {
	const html = render(<OfferApplicantsContent data={data} />, "?status=review");
	assert.equal((html.match(/<li /g) ?? []).length, 2);
	assert.match(html, /Prénom1/);
	assert.match(html, /Prénom2/);
	assert.doesNotMatch(html, /Prénom0|Prénom3|Prénom4/);
	assert.match(html, /aria-pressed="true"[^>]*>En cours d’étude \(2\)/);
	assert.equal((render(<OfferApplicantsContent data={data} />, "?status=unknown").match(/<li /g) ?? []).length, 5);
});

test("états aucune candidature et aucun résultat distincts", () => {
	assert.match(render(<OfferApplicantsContent data={{ ...data, applications: [] }} />), /Aucune candidature pour cette offre/);
	assert.match(render(<OfferApplicantsContent data={{ ...data, applications: data.applications.slice(0, 1) }} />, "?status=accepted"), /Aucune candidature avec ce statut/);
});

test("chargement, offre introuvable et erreurs récupérables", () => {
	assert.match(render(<OfferRequestState result={null} retry={() => {}} />), /role="status"[^>]*>Chargement/);
	const missing = render(<OfferRequestState result={{ ok: false, reason: "notFound" }} retry={() => {}} />);
	assert.match(missing, /Offre introuvable/);
	assert.doesNotMatch(missing, /Réessayer/);
	for (const reason of ["server", "network"] as const) {
		assert.match(render(<OfferRequestState result={{ ok: false, reason }} retry={() => {}} />), /role="alert"/);
		assert.match(render(<OfferRequestState result={{ ok: false, reason }} retry={() => {}} />), /Réessayer/);
	}
});

test("API : URL de l’offre et cookie de session", async () => {
	const calls: string[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => { calls.push(url); assert.equal(init?.credentials, "same-origin"); return Response.json(url.endsWith("applicants") ? data : []); }) as typeof fetch;
	assert.deepEqual(await getRecruiterOffers(), { ok: true, data: [] });
	assert.deepEqual(await getOfferApplicants("12"), { ok: true, data });
	assert.deepEqual(calls, ["/api/recruiter/offers", "/api/recruiter/offers/12/applicants"]);
});

test("API : session expirée, accès masqué, serveur invalide et réseau", async () => {
	for (const [status, reason] of [[401, "unauthenticated"], [403, "unauthenticated"], [404, "notFound"], [500, "server"]] as const) {
		globalThis.fetch = (async () => new Response("", { status })) as typeof fetch;
		assert.deepEqual(await getOfferApplicants("12"), { ok: false, reason });
	}
	globalThis.fetch = (async () => new Response("<html>")) as typeof fetch;
	assert.deepEqual(await getRecruiterOffers(), { ok: false, reason: "server" });
	globalThis.fetch = (async () => { throw new TypeError("offline"); }) as typeof fetch;
	assert.deepEqual(await getOfferApplicants("12"), { ok: false, reason: "network" });
});
