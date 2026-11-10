import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import CandidateFilterPanel, { NoMatchingCandidates } from "../front/components/CandidateFilters";
import { filterQuery, getCandidates, getFilterOptions, type FilterOptions } from "../front/services/candidates";
import {
	activeFilters,
	candidatesLink,
	filtersFromParams,
	hasFilters,
	matchCount,
	NO_FILTERS,
	withCandidate,
	withFilters,
} from "../front/utils/candidateFilters";

const options: FilterOptions = {
	positions: ["Data analyst", "Développeur back-end"],
	experiences: [
		{ value: "beginner", label: "Débutant (moins de 6 mois)" },
		{ value: "junior", label: "Junior (6 mois à 2 ans)" },
		{ value: "confirmed", label: "Confirmé (2 ans et plus)" },
	],
	skills: ["Excel", "Power BI", "SQL"],
};
const dataAnalyst = { position: "Data analyst", experience: "confirmed", skill: "Power BI", region: "Bordeaux" };

const realFetch = globalThis.fetch;

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

const noop = () => {};
const panel = (props: Partial<Parameters<typeof CandidateFilterPanel>[0]> = {}) =>
	renderToStaticMarkup(
		<CandidateFilterPanel applied={NO_FILTERS} options={options} optionsError="" onRetryOptions={noop} onSearch={noop} count={12} {...props} />,
	);

// Balise <select> d'un champ, avec ses options
const select = (html: string, id: string) => html.match(new RegExp(`<select id="${id}"[^]*?</select>`))?.[0] ?? "";

test("requête : seuls les critères renseignés partent, sans espaces autour", () => {
	assert.equal(filterQuery(NO_FILTERS), "");
	assert.equal(filterQuery({ ...NO_FILTERS, skill: " Power BI ", region: "  " }), "?skill=Power+BI");
	assert.equal(filterQuery(dataAnalyst), "?position=Data+analyst&experience=confirmed&skill=Power+BI&region=Bordeaux");
});

test("API : les cartes avec ou sans critères, puis les valeurs des listes", async () => {
	const urls = mockFetch(() => Response.json([]));
	await getCandidates();
	await getCandidates(NO_FILTERS);
	await getCandidates({ ...NO_FILTERS, region: "Île-de-France" });
	assert.deepEqual(urls, [
		"/api/recruiter/candidates",
		"/api/recruiter/candidates",
		"/api/recruiter/candidates?region=%C3%8Ele-de-France",
	]);

	const optionsUrls = mockFetch(() => Response.json(options));
	assert.deepEqual(await getFilterOptions(), { ok: true, options });
	assert.deepEqual(optionsUrls, ["/api/recruiter/candidates/filters"]);
});

test("API des listes : session expirée, erreurs du serveur et du réseau", async () => {
	mockFetch(() => new Response(null, { status: 403 }));
	assert.deepEqual(await getFilterOptions(), { ok: false, reason: "unauthenticated" });
	// La route existe toujours : un 404 veut dire que le serveur n'est pas celui attendu
	mockFetch(() => new Response(null, { status: 404 }));
	assert.deepEqual(await getFilterOptions(), { ok: false, reason: "server" });
	mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
	assert.deepEqual(await getFilterOptions(), { ok: false, reason: "network" });
});

test("URL : les critères sont lus et réécrits sans toucher au reste", () => {
	const params = new URLSearchParams("?skill=%20SQL%20&region=Lyon&candidate=7");
	assert.deepEqual(filtersFromParams(params), { position: "", experience: "", skill: "SQL", region: "Lyon" });
	assert.equal(hasFilters(filtersFromParams(params)), true);
	assert.equal(hasFilters(filtersFromParams(new URLSearchParams("?candidate=7"))), false);

	// Nouvelle recherche : critères remplacés, retour à la première carte
	assert.equal(withFilters(params, { ...NO_FILTERS, position: "Data analyst" }).toString(), "position=Data+analyst");
	// Carte suivante : les critères restent
	assert.equal(withCandidate(params, 9).toString(), "skill=+SQL+&region=Lyon&candidate=9");
});

test("retour depuis un profil : même recherche, sur la carte du candidat", () => {
	assert.equal(candidatesLink("?skill=SQL&candidate=3", 12), "/recruiter/candidates?skill=SQL&candidate=12");
	assert.equal(candidatesLink("", 12), "/recruiter/candidates?candidate=12");
	assert.equal(candidatesLink(""), "/recruiter/candidates");
});

test("résultats : nombre sous le bouton et pastilles des filtres actifs", () => {
	assert.equal(matchCount(0), "Aucun candidat ne correspond");
	assert.equal(matchCount(1), "1 candidat correspond");
	assert.equal(matchCount(12), "12 candidats correspondent");
	assert.deepEqual(activeFilters(dataAnalyst, options), [
		{ key: "position", label: "Data analyst" },
		{ key: "experience", label: "Confirmé (2 ans et plus)" },
		{ key: "skill", label: "Power BI" },
		{ key: "region", label: "Bordeaux" },
	]);
	// Listes pas encore chargées : la valeur plutôt que rien
	assert.deepEqual(activeFilters({ ...NO_FILTERS, experience: "junior" }, null), [{ key: "experience", label: "junior" }]);
});

test("panneau : champs libellés, listes déroulantes de l'API et région en saisie libre", () => {
	const html = panel();
	assert.match(html, /<form role="search" aria-labelledby="filters-title"/);
	for (const [id, label] of [
		["filter-position", "Profil recherché"],
		["filter-experience", "Expérience"],
		["filter-skill", "Logiciels maîtrisés"],
		["filter-region", "Région"],
	]) {
		assert.match(html, new RegExp(`<label for="${id}"[^>]*>${label}</label>`), label);
	}
	assert.match(select(html, "filter-position"), /<option value=""[^>]*>Tous les profils<\/option>.*Data analyst.*Développeur back-end/);
	assert.match(select(html, "filter-experience"), /<option value="confirmed"[^>]*>Confirmé \(2 ans et plus\)<\/option>/);
	assert.match(select(html, "filter-skill"), /Excel.*Power BI.*SQL/);
	assert.match(html, /<input id="filter-region" type="text"[^>]*placeholder="Ville ou « remote »"/);
	assert.match(html, /<button type="submit"[^>]*>Rechercher les candidats<\/button>/);
	assert.match(html, /<p role="status"[^>]*text-\[#6b7280\][^>]*>12 candidats correspondent<\/p>/);
});

test("panneau : la recherche en cours est affichée, même une valeur absente des listes", () => {
	const html = panel({ applied: { ...dataAnalyst, skill: "Cobol" }, count: 0 });
	assert.match(select(html, "filter-position"), /<option value="Data analyst"[^>]* selected=""/);
	assert.match(select(html, "filter-experience"), /<option value="confirmed"[^>]* selected=""/);
	assert.match(select(html, "filter-skill"), /<option value="Cobol"[^>]* selected=""[^>]*>Cobol<\/option>/);
	assert.match(html, /<input id="filter-region"[^>]*value="Bordeaux"/);
	assert.match(html, /<p role="status"[^>]*text-\[#dc2626\][^>]*>Aucun candidat ne correspond<\/p>/);
});

test("panneau : listes en chargement, puis en erreur avec un nouvel essai", () => {
	const loading = panel({ options: null, count: null });
	assert.match(select(loading, "filter-skill"), /<select id="filter-skill"[^>]*disabled=""/);
	assert.match(loading, /<p role="status"[^>]*><\/p>/);

	const failed = panel({ options: null, optionsError: "Les listes des filtres n’ont pas pu être chargées." });
	assert.match(failed, /role="alert"[^]*Les listes des filtres n’ont pas pu être chargées\.[^]*Réessayer/);
	// La région reste utilisable
	assert.doesNotMatch(failed.match(/<input id="filter-region"[^>]*>/)?.[0] ?? "", /disabled/);
});

test("aucun résultat : message, pastilles retirables une à une et réinitialisation", () => {
	const html = renderToStaticMarkup(<NoMatchingCandidates filters={dataAnalyst} options={options} onRemove={noop} onReset={noop} />);
	assert.match(html, /<h2[^>]*>Aucun candidat ne correspond à vos critères<\/h2>/);
	assert.match(html, /Essayez d’élargir la région ou de retirer un logiciel\./);
	for (const label of ["Data analyst", "Confirmé \\(2 ans et plus\\)", "Power BI", "Bordeaux"]) {
		assert.match(html, new RegExp(`<button type="button" aria-label="Retirer le filtre ${label}"`), label);
	}
	assert.match(html, />Réinitialiser les filtres<\/button>/);
});
