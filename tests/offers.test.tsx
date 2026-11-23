import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import OffersPage, { filterPublicOffers, PublicOfferDetail, PublicOfferList, PublicOfferRequestState } from "../front/pages/OffersPage";
import StudentOfferSwipe from "../front/pages/StudentOfferSwipe";
import { getOffer, getOffers, type PublicOffer } from "../front/services/offers";

const offer: PublicOffer = { id: 12, title: "Développeur Java", description: "Description réelle du poste", requirements: "Java et SQL", category: 1, created_at: "2026-11-10T09:00:00Z", company: { id: 3, name: "Entreprise réelle", city: "Nantes" } };
const render = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("liste : données réelles et liens par identifiant même avec deux titres identiques", () => {
	const html = render(<PublicOfferList offers={[offer, { ...offer, id: 13 }]} page={1} onPageChange={() => {}} />);
	assert.match(html, /Entreprise réelle/);
	assert.match(html, /Nantes/);
	assert.match(html, /Alternance/);
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
	assert.match(html, /Description du poste/);
	assert.match(html, /Entreprise réelle — voir la page entreprise/);
	assert.match(html, /Alternance/);
	assert.match(html, /Informatique/);
	assert.match(html, /Nantes/);
	assert.match(html, /Publiée le 10 novembre 2026/);
	assert.match(html, /offer\.webp/);
	assert.match(html, /Java et SQL/);
	assert.match(html, /&lt;script&gt;danger&lt;\/script&gt;/);
	assert.match(html, /href="\/offers"/);
	assert.doesNotMatch(html, /Se connecter pour postuler/);
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

test("les filtres de recherche du design sont actifs", () => {
	const html = render(<OffersPage />);
	assert.match(html, /role="search"/);
	assert.match(html, /Poste, compétence ou entreprise/);
	assert.match(html, /Ville ou code postal/);
	assert.match(html, /Secteur/);
	assert.doesNotMatch(html, /disabled=""|La recherche et les filtres seront bientôt disponibles/);
	assert.doesNotMatch(html, /Atelier Studio|Horizon Tech/);
});

test("recherche publique : poste, entreprise, ville et secteur filtrent les offres chargées", () => {
	const offers: PublicOffer[] = [
		offer,
		{ ...offer, id: 13, title: "Data analyst", description: "Analyse de données", requirements: "SQL", category: 2, company: { id: 4, name: "Horizon Tech", city: "Paris" } },
		{ ...offer, id: 14, title: "Designer", description: "Design produit", requirements: "Figma", category: 17, company: { id: 5, name: "Nova", city: "Lyon" } },
	];
	assert.deepEqual(filterPublicOffers(offers, { query: "java", city: "", sector: "" }).map(({ id }) => id), [12]);
	assert.deepEqual(filterPublicOffers(offers, { query: "horizon", city: "", sector: "" }).map(({ id }) => id), [13]);
	assert.deepEqual(filterPublicOffers(offers, { query: "", city: "paris", sector: "2" }).map(({ id }) => id), [13]);
	assert.deepEqual(filterPublicOffers(offers, { query: "", city: "Bordeaux", sector: "" }), []);
});

test("étudiant : offres en cartes swipe avec filtres, détail, passer et sauvegarder", () => {
	const html = render(<StudentOfferSwipe offers={[offer]} />);
	assert.match(html, /aria-label="Filtres des offres"/);
	assert.match(html, /src="\/static\/img\/recruiter-offers\/offer\.webp"/);
	assert.match(html, /Développeur Java/);
	assert.match(html, /Entreprise réelle • Nantes/);
	assert.match(html, /Plus d’informations/);
	assert.match(html, /Passer l’offre Développeur Java/);
	assert.match(html, /Sauvegarder l’offre Développeur Java/);
	assert.match(html, /Modifier mon CV et mes documents/);
	assert.doesNotMatch(html, /Voir l’offre/);
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
