// Formulaire « Créer une offre » (JOB-051, repris par JOB-065). Les tests d'interaction de JOB-051
// utilisaient jsdom ; ils sont remplacés par des rendus statiques et des appels simulés, comme le reste du dépôt.
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { CreateOfferForm, NoCompanyForOffer } from "../front/pages/CreateOfferPage";
import { RecruiterOfferList } from "../front/pages/RecruiterOffersPage";
import { createOffer, type NewOffer, type OfferSummary } from "../front/services/recruiterOffers";
import { newOfferSchema } from "../front/utils/offer";

const valid = {
	title: "Développeur",
	description: "Construire une application",
	category: "1",
	requirements: "Python",
	image_url: "",
	contract_type: "alternance",
	duration: "12 mois",
	start_date: "",
	location: "Paris",
};
const offer: NewOffer = { ...valid, category: 1, start_date: null };

const render = (element: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

// Remplace fetch : /api/csrf renvoie un jeton, la publication la réponse donnée
function mockFetch(respond: () => Response | Promise<Response>) {
	const calls: { url: string; init?: RequestInit }[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		if (url === "/api/csrf") return Response.json({ csrfToken: "test-token" });
		return respond();
	}) as typeof fetch;
	return calls;
}

test("validation : champs obligatoires vides, image non sûre et date impossible refusés", () => {
	assert.equal(newOfferSchema.safeParse(valid).success, true);
	for (const [key, value] of [
		["title", " "],
		["description", "\n"],
		["category", ""],
		["title", "x".repeat(129)],
		["image_url", "javascript:alert(1)"],
		["image_url", "ftp://example.com/a.png"],
		["start_date", "2027-02-30"],
		["contract_type", "freelance"],
	]) {
		assert.equal(newOfferSchema.safeParse({ ...valid, [key]: value }).success, false, `${key}: ${value}`);
	}
	// Pas de champ entreprise : il n'existe plus dans les valeurs envoyées
	assert.equal("company" in newOfferSchema.shape, false);
});

test("formulaire : champs de la maquette, entreprise affichée sans pouvoir la changer", () => {
	const html = render(<CreateOfferForm companyName="Atelier Studio" />);
	for (const label of ["Intitulé du poste *", "Secteur *", "Image de l’offre", "Type de contrat", "Compétences recherchées", "Durée", "Date de début", "Description du poste *", "Lieu du poste"]) {
		assert.match(html, new RegExp(label.replace("*", "\\*")));
	}
	assert.match(html, /<input id="offer-company" readOnly="" aria-describedby="offer-company-hint"[^>]*value="Atelier Studio"/);
	// Le champ entreprise n'a pas de name : il ne fait pas partie des valeurs envoyées
	assert.doesNotMatch(html, /name="company"/);
	assert.match(html, /Publier l’offre/);
	assert.match(html, /<option value="1">Informatique<\/option>/);
});

test("recruteur sans entreprise : message, pas de formulaire", () => {
	const html = render(<NoCompanyForOffer />);
	assert.match(html, /Aucune entreprise rattachée/);
	assert.doesNotMatch(html, /<form/);
});

test("Vos offres : image de l'offre, sinon celle de la maquette", () => {
	const base: OfferSummary = { id: 1, title: "Dev", description: "…", created_at: "2026-11-16T10:00:00Z", is_active: true, applicant_count: 0 };
	assert.match(render(<RecruiterOfferList offers={[{ ...base, image_url: "https://example.com/a.webp" }]} />), /src="https:\/\/example.com\/a.webp"/);
	assert.match(render(<RecruiterOfferList offers={[{ ...base, image_url: "" }]} />), /src="\/static\/img\/recruiter-offers\/offer.webp"/);
});

test("API : publication avec le jeton CSRF et le cookie de session", async () => {
	const published = { ...offer, id: 42, company: { id: 4, name: "Atelier" }, is_active: true, created_at: "2026-11-16T10:00:00Z" };
	const calls = mockFetch(() => Response.json(published, { status: 201 }));
	assert.deepEqual(await createOffer(offer), { ok: true, offer: published });
	assert.deepEqual(
		calls.map((call) => call.url),
		["/api/csrf", "/api/recruiter/offers"],
	);
	const init = calls[1].init;
	assert.equal(init?.method, "POST");
	assert.equal(init?.credentials, "same-origin");
	assert.equal((init?.headers as Record<string, string>)["X-CSRFToken"], "test-token");
	assert.deepEqual(JSON.parse(init?.body as string), offer);
});

test("API : erreurs par champ, accès refusé, sans entreprise et réseau", async () => {
	mockFetch(() => Response.json({ title: ["Ce champ est obligatoire."], company: ["Ce champ ne peut pas être défini."] }, { status: 400 }));
	assert.deepEqual(await createOffer(offer), { ok: false, status: 400, errors: { title: "Ce champ est obligatoire." } });
	mockFetch(() => Response.json({ detail: "Forbidden" }, { status: 403 }));
	assert.deepEqual(await createOffer(offer), { ok: false, status: 403, errors: {} });
	mockFetch(() => Response.json({ error: "No company" }, { status: 404 }));
	assert.deepEqual(await createOffer(offer), { ok: false, status: 404, errors: {} });
	globalThis.fetch = (async () => {
		throw new TypeError("offline");
	}) as typeof fetch;
	assert.deepEqual(await createOffer(offer), { ok: false, status: 0, errors: {} });
});
