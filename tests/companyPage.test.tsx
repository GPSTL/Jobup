import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import CompanyLogo from "../front/components/CompanyLogo";
import { CompanyPreview, NoCompany } from "../front/pages/RecruiterAccountPage";
import { getOwnCompany, saveOwnCompany, type CompanyForm, type OwnCompany } from "../front/services/companies";
import { centeredOffset, clampOffset, displayedSize, minZoom, outputRect, zoomAroundCenter } from "../front/utils/logoCrop";
import { activeOffersLabel, COMPANY_MESSAGES, formFromCompany, trimmedForm, validateCompanyForm, validateLogo } from "../front/utils/companyForm";

const atelier: OwnCompany = {
	id: 4,
	name: "Atelier Studio",
	logo_url: null,
	sector: 1,
	city: "Paris 9e",
	employees: 70,
	website: "https://atelier-studio.fr",
	description: "Atelier Studio conçoit des applications web et mobiles.",
	active_offers: 3,
};
const form: CompanyForm = { name: "Atelier Studio", sector: 1, city: "Paris 9e", description: "Présentation" };

const render = (element: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

// Remplace fetch : /api/csrf renvoie un jeton, les autres appels la réponse donnée
function mockFetch(respond: () => Response | Promise<Response>) {
	const calls: { url: string; init?: RequestInit }[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		if (url === "/api/csrf") return Response.json({ csrfToken: "test-token" });
		return respond();
	}) as typeof fetch;
	return calls;
}

test("formulaire : nom et secteur obligatoires, longueurs maximales de l'API", () => {
	assert.deepEqual(validateCompanyForm(form), {});
	assert.deepEqual(validateCompanyForm({ ...form, name: "   ", sector: "" }), { name: COMPANY_MESSAGES.name, sector: COMPANY_MESSAGES.sector });
	assert.deepEqual(validateCompanyForm({ ...form, name: "N".repeat(129) }), { name: COMPANY_MESSAGES.name });
	assert.deepEqual(validateCompanyForm({ ...form, city: "C".repeat(65), description: "D".repeat(2049) }), {
		city: COMPANY_MESSAGES.city,
		description: COMPANY_MESSAGES.description,
	});
	// Les espaces autour ne comptent pas, comme côté API
	assert.deepEqual(validateCompanyForm({ ...form, city: ` ${"C".repeat(64)} ` }), {});
	assert.deepEqual(trimmedForm({ ...form, name: " Atelier ", city: " Paris " }), { ...form, name: "Atelier", city: "Paris" });
});

test("formulaire : rempli depuis l'entreprise, secteur vide quand il n'est pas renseigné", () => {
	assert.deepEqual(formFromCompany(atelier), { name: "Atelier Studio", sector: 1, city: "Paris 9e", description: atelier.description });
	assert.equal(formFromCompany({ ...atelier, sector: null }).sector, "");
});

test("logo : JPG ou PNG, 2 Mo maximum", () => {
	assert.equal(validateLogo(new File(["x"], "logo.png", { type: "image/png" })), "");
	assert.equal(validateLogo(new File(["x"], "logo.jpg", { type: "image/jpeg" })), "");
	assert.equal(validateLogo(new File(["x"], "logo.gif", { type: "image/gif" })), COMPANY_MESSAGES.logoFormat);
	assert.equal(validateLogo(new File([new Uint8Array(2 * 1024 * 1024)], "logo.png", { type: "image/png" })), "");
	assert.equal(validateLogo(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "logo.png", { type: "image/png" })), COMPANY_MESSAGES.logoTooBig);
});

test("logo ou initiales de l'entreprise", () => {
	assert.match(render(<CompanyLogo name="Atelier Studio" logoUrl={null} className="size-12" />), /<span aria-hidden="true"[^>]*>AS<\/span>/);
	assert.match(render(<CompanyLogo name="Atelier Studio" logoUrl="/media/logos/a.png" className="size-12" />), /<img src="\/media\/logos\/a.png" alt=""/);
});

test("aperçu côté étudiant : secteur, ville, présentation et offres en cours", () => {
	const html = render(<CompanyPreview form={form} logoUrl={null} activeOffers={3} />);
	assert.match(html, /Atelier Studio/);
	assert.match(html, /Informatique • Paris 9e/);
	assert.match(html, /Présentation/);
	assert.match(html, /3 offres en cours/);
	// Formulaire vidé : textes d'attente plutôt qu'une carte vide
	const empty = render(<CompanyPreview form={{ name: "", sector: "", city: "", description: "" }} logoUrl={null} activeOffers={1} />);
	assert.match(empty, /Nom de l’entreprise/);
	assert.match(empty, /Ajoutez une présentation/);
	assert.equal(activeOffersLabel(1), "1 offre en cours");
});

test("recruteur sans entreprise : message, pas de formulaire", () => {
	const html = render(<NoCompany />);
	assert.match(html, /Aucune entreprise rattachée/);
	assert.doesNotMatch(html, /<form/);
});

test("API : lecture de l'entreprise du recruteur connecté", async () => {
	const calls = mockFetch(() => Response.json(atelier));
	assert.deepEqual(await getOwnCompany(), { ok: true, company: atelier });
	assert.deepEqual(calls.map((call) => call.url), ["/api/recruiter/company"]);
	assert.equal(calls[0].init?.credentials, "same-origin");
});

test("API : enregistrement en JSON sans logo, avec le jeton CSRF", async () => {
	const calls = mockFetch(() => Response.json(atelier));
	assert.deepEqual(await saveOwnCompany(form), { ok: true, company: atelier });
	assert.deepEqual(calls.map((call) => call.url), ["/api/csrf", "/api/recruiter/company"]);
	const init = calls[1].init;
	assert.equal(init?.method, "PATCH");
	assert.deepEqual(init?.headers, { "Content-Type": "application/json", "X-CSRFToken": "test-token" });
	assert.deepEqual(JSON.parse(init?.body as string), form);
});

test("API : avec un nouveau logo, champs et logo partent ensemble en multipart", async () => {
	const calls = mockFetch(() => Response.json({ ...atelier, logo_url: "/media/logos/b.png" }));
	const logo = new File(["png"], "logo.png", { type: "image/png" });
	const result = await saveOwnCompany(form, logo);
	assert.equal(result.ok && result.company.logo_url, "/media/logos/b.png");
	const init = calls[1].init;
	const body = init?.body as FormData;
	assert.ok(body instanceof FormData);
	assert.equal(body.get("name"), "Atelier Studio");
	assert.equal(body.get("sector"), "1");
	assert.equal((body.get("logo") as File).name, "logo.png");
	// Pas de Content-Type : le navigateur ajoute celui du multipart
	assert.deepEqual(init?.headers, { "X-CSRFToken": "test-token" });
});

test("API : erreurs par champ, sans entreprise, session expirée, serveur et réseau", async () => {
	mockFetch(() => Response.json({ errors: { name: "Une autre entreprise porte déjà ce nom.", id: "Ce champ ne peut pas être modifié." } }, { status: 400 }));
	assert.deepEqual(await saveOwnCompany(form), { ok: false, reason: "invalid", fields: { name: "Une autre entreprise porte déjà ce nom." } });
	// Seulement des champs hors du formulaire : erreur du serveur
	mockFetch(() => Response.json({ errors: { id: "Ce champ ne peut pas être modifié." } }, { status: 400 }));
	assert.deepEqual(await saveOwnCompany(form), { ok: false, reason: "server" });
	mockFetch(() => Response.json({ error: "No company" }, { status: 404 }));
	assert.deepEqual(await getOwnCompany(), { ok: false, reason: "noCompany" });
	mockFetch(() => Response.json({ detail: "Not authenticated" }, { status: 403 }));
	assert.deepEqual(await getOwnCompany(), { ok: false, reason: "unauthenticated" });
	mockFetch(() => new Response("oops", { status: 500 }));
	assert.deepEqual(await saveOwnCompany(form), { ok: false, reason: "server" });
	globalThis.fetch = (async () => {
		throw new TypeError("offline");
	}) as typeof fetch;
	assert.deepEqual(await getOwnCompany(), { ok: false, reason: "network" });
});

// Image en hauteur, comme une photo de téléphone : 600 × 1200, dans un cadre de 240 pixels
const tall = { width: 600, height: 1200 };

test("recadrage : à zoom 1, le petit côté remplit le cadre et l'image est centrée", () => {
	assert.deepEqual(displayedSize(tall, 240, 1), { width: 240, height: 480 });
	assert.deepEqual(centeredOffset(tall, 240, 1), { x: 0, y: -120 });
	// Le logo enregistré est l'image à l'échelle du carré de 512 pixels
	assert.deepEqual(outputRect({ x: 0, y: -120 }, tall, 240, 1, 480), { x: 0, y: -240, width: 480, height: 960 });
});

test("recadrage : l'image couvre toujours le cadre quand elle est plus grande que lui", () => {
	assert.deepEqual(clampOffset({ x: 50, y: 50 }, tall, 240, 1), { x: 0, y: 0 });
	assert.deepEqual(clampOffset({ x: -50, y: -400 }, tall, 240, 1), { x: 0, y: -240 });
});

test("recadrage : dézoomer fait tenir toute l'image, qui reste dans le cadre", () => {
	assert.equal(minZoom(tall), 0.5);
	assert.deepEqual(displayedSize(tall, 240, 0.5), { width: 120, height: 240 });
	assert.deepEqual(centeredOffset(tall, 240, 0.5), { x: 60, y: 0 });
	assert.deepEqual(clampOffset({ x: 200, y: -10 }, tall, 240, 0.5), { x: 120, y: 0 });
});

test("recadrage : le zoom garde au centre le point visé", () => {
	// Centre du cadre sur le haut de l'image, puis zoom × 2
	const zoomed = zoomAroundCenter({ x: 0, y: 0 }, tall, 240, 1, 2);
	assert.deepEqual(zoomed, { x: -120, y: -120 });
	// Retour au zoom 1 : la position est ramenée dans les limites
	assert.deepEqual(zoomAroundCenter(zoomed, tall, 240, 2, 1), { x: 0, y: 0 });
});
