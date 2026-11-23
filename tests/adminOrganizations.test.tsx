import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AdminOrganizationsResults, AdminOrganizationsTable, AdminOrganizationsToolbar, ReviewActions } from "../front/components/AdminOrganizationsList";
import AdminAccountPage from "../front/pages/AdminAccountPage";
import AdminClaimsPage from "../front/pages/AdminClaimsPage";
import AdminCompaniesPage, { COMPANY_COLUMNS } from "../front/pages/AdminCompaniesPage";
import AdminReportsPage from "../front/pages/AdminReportsPage";
import AdminSchoolsPage, { SCHOOL_COLUMNS } from "../front/pages/AdminSchoolsPage";
import { getAdminOrganizations, setOrganizationStatus, type AdminCompany, type AdminSchool, type OrganizationsResult } from "../front/services/adminOrganizations";
import { hasCriteria, nextSort, queryFromParams, rangeLabel, searchFromQuery, sortDirection, withChanges, type OrganizationQuery } from "../front/utils/adminOrganizations";

const company: AdminCompany = { id: 4, name: "Acme", siret: "12345678901234", city: "Paris", website: "", status: "pending", recruiters: 2 };
const school: AdminSchool = { id: 7, name: "Université Paris", status: "validated", students: 12, managers: 1 };
const query: OrganizationQuery = { q: "", status: "", sort: "name", page: 1, page_size: 10 };
const columns = ["name", "city", "recruiters"];
const render = (element: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
const noop = () => {};
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("URL : valeurs par défaut, valeurs invalides ignorées et aller-retour", () => {
	assert.deepEqual(queryFromParams(new URLSearchParams(), columns), query);
	// "siret" is not a sort of the companies
	assert.deepEqual(queryFromParams(new URLSearchParams("status=deleted&sort=siret&page=0&page_size=11"), columns), query);
	const asked = queryFromParams(new URLSearchParams("q=+acme+&status=refused&sort=-city&page=2&page_size=25"), columns);
	assert.deepEqual(asked, { q: "acme", status: "refused", sort: "-city", page: 2, page_size: 25 });
	assert.equal(searchFromQuery(asked), "q=acme&status=refused&sort=-city&page_size=25&page=2");
	assert.deepEqual(queryFromParams(new URLSearchParams(searchFromQuery(asked)), columns), asked);
	assert.equal(searchFromQuery(query), "");
	assert.equal(hasCriteria(query), false);
	assert.equal(hasCriteria({ ...query, status: "pending" }), true);
	assert.equal(withChanges({ ...query, page: 3 }, { status: "validated" }).page, 1);
	assert.equal(withChanges({ ...query, page: 3 }, { page: 4 }).page, 4);
});

test("tri et plage : croissant puis décroissant, libellé au pluriel", () => {
	assert.equal(nextSort("name", "city"), "city");
	assert.equal(nextSort("city", "city"), "-city");
	assert.equal(nextSort("-city", "city"), "city");
	assert.equal(sortDirection("-city", "city"), "descending");
	assert.equal(sortDirection("city", "city"), "ascending");
	assert.equal(sortDirection("city", "name"), undefined);
	assert.equal(rangeLabel(42, 5, 10, 2, ["école", "écoles"]), "41–42 sur 42 écoles");
	assert.equal(rangeLabel(1, 1, 10, 1, ["école", "écoles"]), "1–1 sur 1 école");
});

test("tableau des entreprises : colonnes, statut et décision", () => {
	const html = render(<AdminOrganizationsTable label="Entreprises" rows={[company, { ...company, id: 5, name: "Zed", city: "", status: "validated" }]} columns={COMPANY_COLUMNS} sort="name" onSort={noop} busyId={null} onReview={noop} />);
	for (const text of ["Entreprise", "SIRET", "Ville", "Recruteurs", "Statut", "Décision", "Acme", "12345678901234", "Paris", "Non renseignée", "En attente", "Validée"]) assert.ok(html.includes(text), text);
	// Only the sorted column carries aria-sort; SIRET is not sortable
	assert.equal(html.match(/aria-sort=/g)?.length, 1);
	assert.match(html, /aria-sort="ascending"[^>]*><button[^>]*>Entreprise/);
	assert.doesNotMatch(html, /<button[^>]*>SIRET/);
});

test("tableau des écoles : étudiants et managers", () => {
	const html = render(<AdminOrganizationsTable label="Écoles" rows={[school]} columns={SCHOOL_COLUMNS} sort="-students" onSort={noop} busyId={null} onReview={noop} />);
	for (const text of ["Université Paris", ">12<", ">1<", "Validée"]) assert.ok(html.includes(text), text);
	assert.match(html, /aria-sort="descending"[^>]*><button[^>]*>Étudiants/);
});

test("décision : chaque statut peut être remplacé par un autre, pour revenir sur son choix", () => {
	const labels = (status: "pending" | "validated" | "refused") => [...render(<ReviewActions name="Acme" status={status} disabled={false} onChange={noop} />).matchAll(/aria-label="([^"]*)"/g)].map(([, label]) => label);
	assert.deepEqual(labels("pending"), ["Valider : Acme", "Refuser : Acme"]);
	assert.deepEqual(labels("validated"), ["Refuser : Acme", "Remettre en attente : Acme"]);
	assert.deepEqual(labels("refused"), ["Valider : Acme", "Remettre en attente : Acme"]);
	// The buttons wait while a change is sent
	assert.equal(render(<ReviewActions name="Acme" status="pending" disabled onChange={noop} />).match(/disabled=""/g)?.length, 2);
});

test("filtres : recherche, statuts de validation et réinitialisation seulement avec des critères", () => {
	const search = { name: "entreprises", label: "Rechercher une entreprise par nom, SIRET ou ville", placeholder: "Rechercher par nom, SIRET ou ville…" };
	const toolbar = (current = query) => render(<AdminOrganizationsToolbar query={current} search={search} onSearch={noop} onChange={noop} onReset={noop} />);
	const html = toolbar();
	for (const text of ["Rechercher et filtrer les entreprises", "Rechercher une entreprise par nom, SIRET ou ville", "Tous les statuts", "En attente", "Validées", "Refusées"]) assert.ok(html.includes(text), text);
	assert.doesNotMatch(html, /Réinitialiser/);
	const filtered = toolbar({ ...query, q: "acme", status: "refused" });
	assert.match(filtered, /value="acme"/);
	assert.match(filtered, /<option value="refused" selected="">Refusées/);
	assert.match(filtered, /Réinitialiser/);
});

test("résultats : chargement, erreurs, liste vide, aucun résultat et pagination", () => {
	const view = (result: OrganizationsResult<AdminCompany> | null, current = query) =>
		render(<AdminOrganizationsResults label="Entreprises" result={result} loading={false} query={current} columns={COMPANY_COLUMNS} noun={["entreprise", "entreprises"]} empty="Aucune entreprise inscrite pour le moment." noMatch="Aucune entreprise ne correspond à votre recherche." busyId={null} onChange={noop} onRetry={noop} onReset={noop} onReview={noop} />);
	assert.match(view(null), /Chargement/);
	for (const reason of ["network", "server", "forbidden", "notFound"] as const) assert.match(view({ ok: false, reason }), /role="alert"/);
	assert.match(view({ ok: false, reason: "notFound" }), /Revenir à la première page/);
	assert.match(view({ ok: false, reason: "server" }), /Réessayer/);
	assert.match(view({ ok: false, reason: "forbidden" }), /href="\/administration\?next=%2Fadministration%2Fusers"/);
	const empty: OrganizationsResult<AdminCompany> = { ok: true, results: [], count: 0, page: 1, page_size: 10, total_pages: 1 };
	assert.match(view(empty), /Aucune entreprise inscrite/);
	const noMatch = view(empty, { ...query, status: "pending" });
	assert.match(noMatch, /Aucune entreprise ne correspond à votre recherche/);
	assert.match(noMatch, /Réinitialiser les filtres/);
	const html = view({ ok: true, results: [company], count: 11, page: 2, page_size: 10, total_pages: 2 });
	assert.match(html, /11–11 sur 11 entreprises/);
	assert.match(html, /aria-label="Page 1"/);
	assert.match(html, /Lignes par page/);
});

test("pages : entreprises et écoles, avant le chargement de la liste", () => {
	const companies = render(<AdminCompaniesPage />);
	for (const text of ["Entreprises", "Validez ou refusez les entreprises", "Rechercher par nom, SIRET ou ville", "Chargement"]) assert.ok(companies.includes(text), text);
	const schools = render(<AdminSchoolsPage />);
	for (const text of ["Écoles", "Validez ou refusez les écoles", "Rechercher par nom…", "Chargement"]) assert.ok(schools.includes(text), text);
	// The navigation of the administration is on every page
	assert.match(companies, /href="\/administration\/schools"/);
});

test("pages vides : Mon espace, Signalements et Réclamations", () => {
	for (const [page, title, empty] of [[<AdminAccountPage />, "Mon espace", "Rien à afficher"], [<AdminReportsPage />, "Signalements", "Aucun signalement"], [<AdminClaimsPage />, "Réclamations", "Aucune réclamation"]] as const) {
		const html = render(page);
		assert.match(html, new RegExp(`<h1[^>]*>${title}</h1>`), title);
		assert.ok(html.includes(empty), empty);
		assert.match(html, /href="\/administration\/users"/);
	}
});

test("API listes : critères de l'URL, cookie, annulation, accès interdit, réseau et réponse invalide", async () => {
	const controller = new AbortController();
	const page = { results: [company], count: 11, page: 2, page_size: 10, total_pages: 2 };
	globalThis.fetch = (async (url, init) => {
		assert.equal(url, "/api/administration/companies?q=acme&page=2");
		assert.equal(init?.credentials, "same-origin");
		assert.equal(init?.signal, controller.signal);
		return Response.json(page);
	}) as typeof fetch;
	assert.deepEqual(await getAdminOrganizations("companies", "q=acme&page=2", controller.signal), { ...page, ok: true });
	globalThis.fetch = (async (url) => {
		assert.equal(url, "/api/administration/schools");
		return Response.json({ ...page, results: [school] });
	}) as typeof fetch;
	assert.equal((await getAdminOrganizations("schools", "")).ok, true);
	for (const [status, reason] of [[403, "forbidden"], [404, "notFound"], [400, "server"], [500, "server"]] as const) {
		globalThis.fetch = async () => new Response("", { status });
		assert.deepEqual(await getAdminOrganizations("companies", ""), { ok: false, reason });
	}
	globalThis.fetch = async () => { throw new TypeError("offline"); };
	assert.deepEqual(await getAdminOrganizations("companies", ""), { ok: false, reason: "network" });
	globalThis.fetch = async () => new Response("not json");
	assert.deepEqual(await getAdminOrganizations("companies", ""), { ok: false, reason: "server" });
});

test("API décision : PATCH du statut avec le jeton CSRF, puis erreurs", async () => {
	const calls: { url: string; init?: RequestInit }[] = [];
	globalThis.fetch = (async (url, init) => {
		if (url === "/api/csrf") return Response.json({ csrfToken: "token" });
		calls.push({ url: String(url), init });
		return Response.json({ ...company, status: "validated" });
	}) as typeof fetch;
	assert.deepEqual(await setOrganizationStatus("companies", 4, "validated"), { ok: true, row: { ...company, status: "validated" } });
	await setOrganizationStatus("schools", 7, "pending");
	assert.equal(calls[0].url, "/api/administration/companies/4/status");
	assert.equal(calls[0].init?.method, "PATCH");
	assert.equal(calls[0].init?.body, JSON.stringify({ status: "validated" }));
	assert.equal((calls[0].init?.headers as Record<string, string>)["X-CSRFToken"], "token");
	assert.equal(calls[1].url, "/api/administration/schools/7/status");
	assert.equal(calls[1].init?.body, JSON.stringify({ status: "pending" }));
	for (const [status, reason] of [[403, "forbidden"], [404, "notFound"], [400, "server"], [500, "server"]] as const) {
		globalThis.fetch = (async (url) => (url === "/api/csrf" ? Response.json({ csrfToken: "token" }) : new Response("", { status }))) as typeof fetch;
		assert.deepEqual(await setOrganizationStatus("companies", 4, "refused"), { ok: false, reason });
	}
	globalThis.fetch = (async (url) => (url === "/api/csrf" ? Response.json({ csrfToken: "token" }) : new Response("not json"))) as typeof fetch;
	assert.deepEqual(await setOrganizationStatus("companies", 4, "refused"), { ok: false, reason: "server" });
	globalThis.fetch = async () => { throw new TypeError("offline"); };
	assert.deepEqual(await setOrganizationStatus("companies", 4, "refused"), { ok: false, reason: "network" });
});
