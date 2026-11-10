import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import CandidateCard from "../front/components/CandidateCard";
import { CandidateDeck } from "../front/pages/CandidatesPage";
import { ShortlistView } from "../front/pages/ShortlistPage";
import { excludeCandidate, getShortlist, keepCandidate, removeFromShortlist, type CandidateSummary, type ShortlistedCandidate } from "../front/services/candidates";

const lucas: CandidateSummary = {
	id: 7,
	first_name: "Lucas",
	last_name: "Martin",
	photo_url: null,
	education: "Master MIAGE",
	school: "Université Paris Nanterre",
	description: "Étudiant en Master MIAGE.",
	cv_url: null,
};
const sarah: CandidateSummary = { ...lucas, id: 8, first_name: "Sarah", last_name: "Benali" };
const kept: ShortlistedCandidate = { ...lucas, shortlisted_at: "2026-11-09T14:02:11Z", offer: null };

const render = (element: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
const noop = () => {};

const realFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = realFetch;
});

// Remplace fetch : /api/csrf renvoie un jeton, les autres appels la réponse donnée
function mockFetch(respond: (url: string) => Response | Promise<Response>) {
	const calls: { url: string; init?: RequestInit }[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		if (url === "/api/csrf") return Response.json({ csrfToken: "test-token" });
		return respond(url);
	}) as typeof fetch;
	return calls;
}

test("carte : bouton ♥ accessible seulement quand l'action est fournie, inactif pendant l'envoi", () => {
	assert.doesNotMatch(render(<CandidateCard candidate={lucas} />), /Retenir Lucas Martin/);
	const html = render(<CandidateCard candidate={lucas} onKeep={noop} />);
	assert.match(html, /<button type="button" aria-label="Retenir Lucas Martin" aria-disabled="false"/);
	assert.match(render(<CandidateCard candidate={lucas} onKeep={noop} keeping />), /aria-disabled="true"/);
});

test("cartes : le ♥ porte sur la carte affichée", () => {
	const html = render(<CandidateDeck candidates={[lucas, sarah]} index={1} onSelect={noop} onKeep={noop} />);
	assert.match(html, /aria-label="Retenir Sarah Benali"/);
	assert.doesNotMatch(html, /Retenir Lucas Martin/);
});

test("candidats retenus : profil, retrait et étiquette d'offre seulement quand elle est connue", () => {
	const html = render(<ShortlistView candidates={[kept]} onRemove={noop} removingId={null} />);
	assert.match(html, /Lucas Martin/);
	assert.match(html, /Master MIAGE — Université Paris Nanterre/);
	assert.match(html, /href="\/recruiter\/candidates\/7"/);
	assert.match(html, /Retirer<span class="sr-only"> Lucas Martin des candidats retenus<\/span>/);
	assert.doesNotMatch(html, /Pour :/);
	const forOffer = render(<ShortlistView candidates={[{ ...kept, offer: { id: 3, title: "Développeur Java" } }]} onRemove={noop} removingId={null} />);
	assert.match(forOffer, /Pour : Développeur Java/);
	// Retrait en cours : bouton inactif
	assert.match(render(<ShortlistView candidates={[kept]} onRemove={noop} removingId={7} />), /aria-disabled="true"/);
});

test("candidats retenus : état vide avec un lien vers les cartes", () => {
	const html = render(<ShortlistView candidates={[]} onRemove={noop} removingId={null} />);
	assert.match(html, /Aucun candidat retenu pour le moment/);
	assert.match(html, /href="\/recruiter\/candidates"/);
});

test("API : liste des retenus avec le cookie de session", async () => {
	const calls = mockFetch(() => Response.json([kept]));
	assert.deepEqual(await getShortlist(), { ok: true, candidates: [kept] });
	assert.equal(calls[0].url, "/api/recruiter/shortlist");
	assert.equal(calls[0].init?.credentials, "same-origin");
});

test("API : ♥ et « Retirer » envoient le jeton CSRF", async () => {
	let calls = mockFetch(() => Response.json(kept, { status: 201 }));
	assert.deepEqual(await keepCandidate(7), { ok: true });
	assert.deepEqual(calls.map((call) => call.url), ["/api/csrf", "/api/recruiter/candidates/7/shortlist"]);
	assert.equal(calls[1].init?.method, "POST");
	assert.equal((calls[1].init?.headers as Record<string, string>)["X-CSRFToken"], "test-token");
	// ♥ répété : déjà retenu, toujours un succès
	mockFetch(() => Response.json(kept, { status: 200 }));
	assert.deepEqual(await keepCandidate(7), { ok: true });

	calls = mockFetch(() => new Response(null, { status: 204 }));
	assert.deepEqual(await removeFromShortlist(7), { ok: true });
	assert.equal(calls[1].init?.method, "DELETE");
});

test("API : session expirée, candidat indisponible, erreurs du serveur et du réseau", async () => {
	mockFetch(() => Response.json({ detail: "Not authenticated" }, { status: 403 }));
	assert.deepEqual(await keepCandidate(7), { ok: false, reason: "unauthenticated" });
	assert.deepEqual(await getShortlist(), { ok: false, reason: "unauthenticated" });
	mockFetch(() => Response.json({ error: "Candidate not found" }, { status: 404 }));
	assert.deepEqual(await keepCandidate(7), { ok: false, reason: "notFound" });
	mockFetch(() => new Response("oops", { status: 500 }));
	assert.deepEqual(await removeFromShortlist(7), { ok: false, reason: "server" });
	assert.deepEqual(await getShortlist(), { ok: false, reason: "server" });
	globalThis.fetch = (async () => {
		throw new TypeError("offline");
	}) as typeof fetch;
	assert.deepEqual(await keepCandidate(7), { ok: false, reason: "network" });
	assert.deepEqual(await getShortlist(), { ok: false, reason: "network" });
});

test("carte : bouton 🚫 accessible seulement quand l'action est fournie, à gauche du ♥", () => {
	assert.doesNotMatch(render(<CandidateCard candidate={lucas} onKeep={noop} />), /Écarter Lucas Martin/);
	const html = render(<CandidateCard candidate={lucas} onExclude={noop} onKeep={noop} />);
	assert.match(html, /<button type="button" aria-label="Écarter Lucas Martin" aria-disabled="false"/);
	assert.ok(html.indexOf("Écarter Lucas Martin") < html.indexOf("Retenir Lucas Martin"));
	// Seul 🚫 fourni : la barre d'actions s'affiche quand même
	assert.match(render(<CandidateCard candidate={lucas} onExclude={noop} />), /Écarter Lucas Martin/);
});

test("carte : pendant une exclusion, 🚫 et ♥ sont inactifs mais restent des boutons focalisables", () => {
	const html = render(<CandidateCard candidate={lucas} onExclude={noop} onKeep={noop} excluding />);
	assert.equal(html.match(/aria-disabled="true"/g)?.length, 2);
	assert.doesNotMatch(html, / disabled=/);
});

test("cartes : le 🚫 porte sur la carte affichée", () => {
	const html = render(<CandidateDeck candidates={[lucas, sarah]} index={1} onSelect={noop} onExclude={noop} />);
	assert.match(html, /aria-label="Écarter Sarah Benali"/);
	assert.doesNotMatch(html, /Écarter Lucas Martin/);
});

test("API : 🚫 envoie le jeton CSRF ; un nouvel essai ou un candidat déjà écarté reste un succès", async () => {
	const calls = mockFetch(() => Response.json({ id: 7, excluded: true }, { status: 201 }));
	assert.deepEqual(await excludeCandidate(7), { ok: true });
	assert.deepEqual(calls.map((call) => call.url), ["/api/csrf", "/api/recruiter/candidates/7/exclusion"]);
	assert.equal(calls[1].init?.method, "POST");
	assert.equal((calls[1].init?.headers as Record<string, string>)["X-CSRFToken"], "test-token");
	mockFetch(() => Response.json({ id: 7, excluded: true }, { status: 200 }));
	assert.deepEqual(await excludeCandidate(7), { ok: true });
});

test("API : 🚫 avec session expirée, candidat indisponible, erreurs du serveur et du réseau", async () => {
	mockFetch(() => Response.json({ detail: "Not authenticated" }, { status: 403 }));
	assert.deepEqual(await excludeCandidate(7), { ok: false, reason: "unauthenticated" });
	mockFetch(() => Response.json({ error: "Candidate not found" }, { status: 404 }));
	assert.deepEqual(await excludeCandidate(7), { ok: false, reason: "notFound" });
	mockFetch(() => new Response("oops", { status: 500 }));
	assert.deepEqual(await excludeCandidate(7), { ok: false, reason: "server" });
	globalThis.fetch = (async () => {
		throw new TypeError("offline");
	}) as typeof fetch;
	assert.deepEqual(await excludeCandidate(7), { ok: false, reason: "network" });
});
