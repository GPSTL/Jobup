import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import OffersPage, { PublicOfferDetail, PublicOfferList, PublicOfferRequestState } from "../front/pages/OffersPage";
import { getOffer, getOffers, type PublicOffer } from "../front/services/offers";

const offer: PublicOffer = { id: 12, title: "Développeur Java", description: "Description réelle du poste", requirements: "Java et SQL", category: 1, created_at: "2026-11-10T09:00:00Z", company: { id: 3, name: "Entreprise réelle", city: "Nantes" } };
const render = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("liste : données réelles et liens par identifiant même avec deux titres identiques", () => {
	const html = render(<PublicOfferList offers={[offer, { ...offer, id: 13 }]} page={1} onPageChange={() => {}} />);
	assert.match(html, /Entreprise réelle/);
	assert.match(html, /Nantes/);
	assert.match(html, /href="\/offers\/12"/);
	assert.match(html, /href="\/offers\/13"/);
	assert.doesNotMatch(html, /12 mois|24 mois|Atelier Studio|Pagination/);
});

test("pagination : six offres réelles par page, dernière page et page devenue excessive", () => {
	const offers = Array.from({ length: 8 }, (_, index) => ({ ...offer, id: index + 1, title: `Poste ${index + 1}` }));
	const list = (page: number) => render(<PublicOfferList offers={offers} page={page} onPageChange={() => {}} />);
	assert.equal((list(1).match(/<li /g) ?? []).length, 6);
	assert.match(list(1), /aria-label="Pagination"/);
	assert.doesNotMatch(list(1), /Poste 7|Poste 8/);
	assert.equal((list(2).match(/<li /g) ?? []).length, 2);
	assert.match(list(2), /Poste 7/);
	assert.doesNotMatch(list(2), /Poste 1/);
	assert.match(list(99), /Poste 8/);
});

test("aucune offre et entreprise non renseignée sans données fictives", () => {
	assert.match(render(<PublicOfferList offers={[]} page={1} onPageChange={() => {}} />), /role="status"[^>]*>Aucune offre publiée/);
	assert.match(render(<PublicOfferList offers={[{ ...offer, company: null }]} page={1} onPageChange={() => {}} />), /Entreprise non renseignée/);
});

test("détail : description et critères réels, texte échappé, retour à la liste", () => {
	const html = render(<PublicOfferDetail offer={{ ...offer, description: "<script>danger</script>" }} />);
	assert.match(html, /Développeur Java/);
	assert.match(html, /Java et SQL/);
	assert.match(html, /&lt;script&gt;danger&lt;\/script&gt;/);
	assert.match(html, /href="\/offers"/);
	assert.match(html, /Se connecter pour postuler/);
	assert.doesNotMatch(render(<PublicOfferDetail offer={{ ...offer, requirements: "" }} />), /Profil recherché/);
});

test("chargement, erreurs avec réessai et détail retiré sans réessai", () => {
	assert.match(render(<PublicOfferRequestState result={null} retry={() => {}} />), /role="status"/);
	for (const reason of ["network", "server", "notFound"] as const) {
		const html = render(<PublicOfferRequestState result={{ ok: false, reason }} retry={() => {}} />);
		assert.match(html, /role="alert"/);
		assert.match(html, /Réessayer/);
	}
	const missing = render(<PublicOfferRequestState detail result={{ ok: false, reason: "notFound" }} retry={() => {}} />);
	assert.match(missing, /Offre introuvable ou retirée/);
	assert.doesNotMatch(missing, /Réessayer/);
});

test("les filtres non implémentés sont désactivés et expliqués", () => {
	const html = render(<OffersPage />);
	assert.match(html, /<fieldset disabled=""/);
	assert.match(html, /La recherche et les filtres seront bientôt disponibles/);
	assert.doesNotMatch(html, /Atelier Studio|Horizon Tech/);
});

test("API publique : liste et détail utilisent leurs URL propres, avec le cookie de session", async () => {
	const calls: string[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push(url);
		assert.equal(init?.credentials, "same-origin");
		return Response.json(url === "/api/offers" ? [offer] : offer);
	}) as typeof fetch;
	assert.deepEqual(await getOffers(), { ok: true, data: [offer] });
	assert.deepEqual(await getOffer("12"), { ok: true, data: offer });
	await getOffer("../private");
	assert.deepEqual(calls, ["/api/offers", "/api/offers/12", "/api/offers/..%2Fprivate"]);
});

test("API : offre retirée, serveur et JSON invalides, puis reprise après panne réseau", async () => {
	for (const [status, reason] of [[404, "notFound"], [403, "server"], [500, "server"]] as const) {
		globalThis.fetch = (async () => new Response("", { status })) as typeof fetch;
		assert.deepEqual(await getOffer("12"), { ok: false, reason });
	}
	globalThis.fetch = (async () => new Response("<html>")) as typeof fetch;
	assert.deepEqual(await getOffers(), { ok: false, reason: "server" });
	globalThis.fetch = (async () => { throw new TypeError("offline"); }) as typeof fetch;
	assert.deepEqual(await getOffers(), { ok: false, reason: "network" });
	globalThis.fetch = (async () => Response.json([])) as typeof fetch;
	assert.deepEqual(await getOffers(), { ok: true, data: [] });
});
