import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { getCities, getCompanies, getCompany } from "../front/services/companies";
import { companyEmblem, formatEmployees, SECTOR_OPTIONS, sectorLabel, websiteLabel } from "../front/utils/companies";

const realFetch = globalThis.fetch;
const list = { count: 1, page: 1, pages: 1, results: [{ id: 3, name: "Acme", sector: 1, city: "Paris", employees: 120, description: "", active_offers: 2 }] };

// Remplace fetch par une réponse simulée et garde la trace des URL appelées
function mockFetch(respond: () => Response | Promise<Response>) {
	const urls: string[] = [];
	globalThis.fetch = (async (url: string) => {
		urls.push(url);
		return respond();
	}) as typeof fetch;
	return urls;
}

afterEach(() => {
	globalThis.fetch = realFetch;
});

test("répertoire : les filtres vides ne sont pas envoyés", async () => {
	const urls = mockFetch(() => Response.json(list));
	assert.deepEqual(await getCompanies({ q: "  ", sector: "", city: "", page: 1 }), { ok: true, list });
	assert.equal(urls[0], "/api/companies");
});

test("répertoire : recherche, secteur, ville et page sont combinés", async () => {
	const urls = mockFetch(() => Response.json(list));
	await getCompanies({ q: " acme ", sector: 23, city: "Paris", page: 2 });
	assert.equal(urls[0], "/api/companies?q=acme&sector=23&city=Paris&page=2");
});

test("répertoire : erreur serveur et erreur réseau", async () => {
	mockFetch(() => new Response("oops", { status: 500 }));
	assert.deepEqual(await getCompanies({}), { ok: false, reason: "server" });
	mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
	assert.deepEqual(await getCompanies({}), { ok: false, reason: "network" });
	// Réponse HTML : l'API n'est pas disponible sur ce serveur
	mockFetch(() => new Response("<!doctype html>", { status: 200 }));
	assert.deepEqual(await getCompanies({}), { ok: false, reason: "server" });
});

test("page entreprise : trouvée, introuvable, erreur réseau", async () => {
	const company = { ...list.results[0], website: "", offers: [] };
	const urls = mockFetch(() => Response.json(company));
	assert.deepEqual(await getCompany(3), { ok: true, company });
	assert.equal(urls[0], "/api/companies/3");
	mockFetch(() => Response.json({ error: "Company not found" }, { status: 404 }));
	assert.deepEqual(await getCompany(999), { ok: false, reason: "notFound" });
	mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
	assert.deepEqual(await getCompany(3), { ok: false, reason: "network" });
});

test("villes : liste reçue ou erreur", async () => {
	const urls = mockFetch(() => Response.json(["Lyon", "Paris"]));
	assert.deepEqual(await getCities(), { ok: true, cities: ["Lyon", "Paris"] });
	assert.equal(urls[0], "/api/companies/cities");
	mockFetch(() => new Response("oops", { status: 500 }));
	assert.deepEqual(await getCities(), { ok: false, reason: "server" });
});

test("affichage : initiales, effectif, site web et secteurs", () => {
	assert.equal(companyEmblem("Atelier Studio"), "AS");
	assert.equal(companyEmblem("qonto"), "Q");
	assert.equal(companyEmblem("Back Market Group"), "BM");
	assert.equal(companyEmblem("Pixel & Co"), "PC");
	assert.equal(formatEmployees(1), "1 salarié");
	assert.match(formatEmployees(2800), /^2\s800 salariés$/);
	assert.equal(websiteLabel("https://www.atelier-studio.fr/"), "atelier-studio.fr");
	assert.equal(sectorLabel(23), "Santé");
	assert.equal(sectorLabel(null), "");
	assert.equal(SECTOR_OPTIONS.at(-1)?.label, "Autre");
	assert.equal(SECTOR_OPTIONS.length, 30);
});
