import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AdminUsersResults, AdminUsersTable, AdminUsersToolbar } from "../front/pages/AdminUsersPage";
import { getAdminUser, getAdminUserFilters, getAdminUsers, setSuspension, type AdminUser, type AdminUserDetail, type AdminUsersResult } from "../front/services/adminUsers";
import { AdminStudentProfile } from "../front/pages/AdminUserDetailPage";
import AdminNavbar from "../front/components/AdminNavbar";
import { AdminLoginView } from "../front/pages/AdminLoginPage";
import { adminLogin, login } from "../front/services/auth";
import StudentNavbar from "../front/components/StudentNavbar";
import {
	adminLoginLink,
	adminReturnTo,
	adminUsersLink,
	DEFAULT_QUERY,
	hasCriteria,
	nextSort,
	queryFromParams,
	rangeLabel,
	searchFromQuery,
	sortDirection,
	withChanges,
} from "../front/utils/adminUsers";

const user: AdminUser = { id: 1, first_name: "Alice", last_name: "Martin", email: "alice@example.fr", role: 1, school: "Université Paris", date_joined: "2026-10-09T12:00:00Z", is_active: true, suspended_at: null, detail_url: "/administration/users/1" };
const render = (element: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
const noop = () => {};
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("navigation partagée : menu mobile, page active, rubriques indisponibles et déconnexion", () => {
	const html = renderToStaticMarkup(<MemoryRouter initialEntries={["/administration/users"]}><AdminNavbar /></MemoryRouter>);
	assert.match(html, /aria-expanded="false"/);
	assert.match(html, /aria-current="page"/);
	assert.match(html, /aria-disabled="true" title="Bientôt disponible"/);
	assert.match(html, /Se déconnecter/);
	assert.doesNotMatch(html, /href="\/administration\/(account|companies|schools)"/);
	const student = render(<StudentNavbar />);
	assert.match(student, /href="\/student"/);
	assert.match(student, /href="\/applications"/);
	assert.match(student, /aria-expanded="false"/);
	// Every role logs out from the account menu of AccountNavbar
	assert.match(student, /Se déconnecter/);
});

test("tableau : colonnes, identité, école, date française et flèche vers la fiche", () => {
	const html = renderToStaticMarkup(
		<MemoryRouter initialEntries={["/administration/users?q=ali&page=2"]}>
			<AdminUsersTable users={[user, { ...user, id: 2, school: null }]} sort="-date_joined" onSort={noop} />
		</MemoryRouter>,
	);
	for (const text of ["Prénom", "Nom", "E-mail", "École", "Inscription", "Statut", "Alice", "Martin", "alice@example.fr", "Université Paris", "09/10/2026", "Actif", "Non renseignée"]) assert.ok(html.includes(text), text);
	assert.match(html, /href="\/administration\/users\/1"/);
	assert.match(html, /aria-label="Voir la fiche de Alice Martin"/);
	assert.doesNotMatch(html, /disabled=""/);
});

test("tableau : compte suspendu en rouge avec sa date, sans en inventer une", () => {
	const suspended = render(<AdminUsersTable users={[{ ...user, is_active: false, suspended_at: "2026-10-15T12:00:00Z" }]} sort="-date_joined" onSort={noop} />);
	assert.match(suspended, /text-\[#e00000\]">Suspendu le <time dateTime="2026-10-15T12:00:00Z">15\/10\/2026<\/time>/);
	assert.doesNotMatch(suspended, />Actif</);
	assert.match(render(<AdminUsersTable users={[{ ...user, is_active: false }]} sort="-date_joined" onSort={noop} />), /date non renseignée/);
});

test("tableau : seule la colonne triée porte aria-sort, dans son sens", () => {
	const descending = render(<AdminUsersTable users={[user]} sort="-date_joined" onSort={noop} />);
	assert.equal(descending.match(/aria-sort=/g)?.length, 1);
	assert.match(descending, /aria-sort="descending"[^>]*><button[^>]*>Inscription/);
	assert.match(render(<AdminUsersTable users={[user]} sort="last_name" onSort={noop} />), /aria-sort="ascending"[^>]*><button[^>]*>Nom/);
});

test("tableau : fiche indisponible sans lien cassé", () => {
	const html = render(<AdminUsersTable users={[{ ...user, detail_url: null }]} sort="-date_joined" onSort={noop} />);
	assert.match(html, /Fiche de Alice Martin bientôt disponible/);
	assert.match(html, /disabled=""/);
	assert.doesNotMatch(html, /href="\/administration\/users\/1"/);
});

test("filtres : statuts, écoles chargées, indisponibles, et réinitialisation seulement avec des critères", () => {
	const toolbar = (schools: Parameters<typeof AdminUsersToolbar>[0]["schools"], query = DEFAULT_QUERY) =>
		render(<AdminUsersToolbar query={query} schools={schools} onSearch={noop} onChange={noop} onReset={noop} />);
	const html = toolbar([{ id: 3, name: "Université Paris" }]);
	for (const text of ["Rechercher un étudiant par nom, e-mail ou école", "Tous les statuts", "Actifs", "Suspendus", "Toutes les écoles", "Université Paris"]) assert.ok(html.includes(text), text);
	assert.match(html, /<option value="3">Université Paris<\/option>/);
	assert.doesNotMatch(html, /Réinitialiser/);
	assert.match(toolbar(null), /<select disabled=""/);
	assert.match(toolbar("error"), /Écoles indisponibles/);
	const filtered = toolbar([], { ...DEFAULT_QUERY, q: "alice", school: "9" });
	assert.match(filtered, /value="alice"/);
	assert.match(filtered, /École sélectionnée/);
	assert.match(filtered, /Réinitialiser/);
});

test("résultats : chargement, erreurs, liste vide, aucun résultat et pagination", () => {
	const view = (result: AdminUsersResult | null, query = DEFAULT_QUERY) =>
		render(<AdminUsersResults result={result} loading={false} query={query} onChange={noop} onRetry={noop} onReset={noop} />);
	assert.match(view(null), /Chargement/);
	for (const reason of ["network", "server", "forbidden", "notFound"] as const) assert.match(view({ ok: false, reason }), /role="alert"/);
	assert.match(view({ ok: false, reason: "notFound" }), /Revenir à la première page/);
	assert.match(view({ ok: false, reason: "forbidden" }), /href="\/administration\?next=%2Fadministration%2Fusers"/);
	const empty: AdminUsersResult = { ok: true, results: [], count: 0, page: 1, page_size: 10, total_pages: 1 };
	assert.match(view(empty), /Aucun étudiant inscrit/);
	const noMatch = view(empty, { ...DEFAULT_QUERY, status: "suspended" });
	assert.match(noMatch, /Aucun étudiant ne correspond à votre recherche/);
	assert.match(noMatch, /Réinitialiser les filtres/);
	const html = view({ ok: true, results: [user], count: 11, page: 2, page_size: 10, total_pages: 2 });
	assert.match(html, /11–11 sur 11 étudiants/);
	assert.match(html, /aria-label="Page 1"/);
	assert.match(html, /aria-current="page"/);
	assert.match(html, /Lignes par page/);
	assert.match(html, /<option value="25">25<\/option>/);
});

test("URL : valeurs par défaut, valeurs invalides ignorées et aller-retour", () => {
	assert.deepEqual(queryFromParams(new URLSearchParams()), DEFAULT_QUERY);
	const invalid = queryFromParams(new URLSearchParams("status=deleted&school=abc&sort=password&page=0&page_size=11"));
	assert.deepEqual(invalid, DEFAULT_QUERY);
	const query = queryFromParams(new URLSearchParams("q=+alice+&status=suspended&school=3&sort=last_name&page=2&page_size=25"));
	assert.deepEqual(query, { q: "alice", status: "suspended", school: "3", sort: "last_name", page: 2, page_size: 25 });
	assert.equal(searchFromQuery(query), "q=alice&status=suspended&school=3&sort=last_name&page_size=25&page=2");
	assert.deepEqual(queryFromParams(new URLSearchParams(searchFromQuery(query))), query);
	// Default values stay out of the URL
	assert.equal(searchFromQuery(DEFAULT_QUERY), "");
	assert.equal(hasCriteria(DEFAULT_QUERY), false);
	assert.equal(hasCriteria({ ...DEFAULT_QUERY, school: "3" }), true);
});

test("URL : un nouveau critère revient à la première page, pas un changement de page", () => {
	const onPage3 = { ...DEFAULT_QUERY, page: 3 };
	assert.equal(withChanges(onPage3, { q: "alice" }).page, 1);
	assert.equal(withChanges(onPage3, { sort: "email" }).page, 1);
	assert.equal(withChanges(onPage3, { page_size: 50 }).page, 1);
	assert.equal(withChanges(onPage3, { page: 4 }).page, 4);
});

test("tri : croissant puis décroissant, les plus récents d'abord pour la date", () => {
	assert.equal(nextSort("-date_joined", "last_name"), "last_name");
	assert.equal(nextSort("last_name", "last_name"), "-last_name");
	assert.equal(nextSort("-last_name", "last_name"), "last_name");
	assert.equal(nextSort("last_name", "date_joined"), "-date_joined");
	assert.equal(nextSort("-date_joined", "date_joined"), "date_joined");
	assert.equal(sortDirection("-email", "email"), "descending");
	assert.equal(sortDirection("email", "email"), "ascending");
	assert.equal(sortDirection("email", "school"), undefined);
});

test("libellés : plage affichée et retour vers la liste", () => {
	assert.equal(rangeLabel(42, 1, 10, 10), "1–10 sur 42 étudiants");
	assert.equal(rangeLabel(42, 5, 10, 2), "41–42 sur 42 étudiants");
	assert.equal(rangeLabel(1, 1, 10, 1), "1–1 sur 1 étudiant");
	assert.equal(adminUsersLink("/administration/users?q=alice&page=2"), "/administration/users?q=alice&page=2");
	assert.equal(adminUsersLink("/administration/users"), "/administration/users");
	for (const other of ["/administration/users/5", "/administration/usersx", "https://example.com", "//example.com", 3, undefined]) {
		assert.equal(adminUsersLink(other), "/administration/users", String(other));
	}
});

const profile: AdminUserDetail = { ...user, school: "Université Paris", photo_url: null, phone: null, applications_sent: 7, cv_url: "/api/administration/users/1/cv" };

test("fiche (ADM-02) : école, téléphone, e-mail, candidatures envoyées et date d'inscription", () => {
	const html = render(<AdminStudentProfile user={profile} />);
	for (const text of ["Alice Martin", "Université Paris", "Téléphone non renseigné", "alice@example.fr", "7 candidatures envoyées", "Inscription le", "09/10/2026"]) assert.ok(html.includes(text), text);
	// Labels of the icons, for screen readers
	for (const label of ["École", "Téléphone", "E-mail", "Candidatures", "Inscription"]) assert.match(html, new RegExp(`<span class="sr-only">${label}</span>`));
	assert.match(render(<AdminStudentProfile user={{ ...profile, applications_sent: 1 }} />), /1 candidature envoyée</);
	assert.match(render(<AdminStudentProfile user={{ ...profile, applications_sent: 0 }} />), /Aucune candidature envoyée/);
});

test("fiche : photo du profil, ou initiales sans photo", () => {
	assert.match(render(<AdminStudentProfile user={{ ...profile, photo_url: "/media/photos/alice.png" }} />), /<img src="\/media\/photos\/alice.png"/);
	const noPhoto = render(<AdminStudentProfile user={profile} />);
	assert.doesNotMatch(noPhoto, /<img/);
	assert.match(noPhoto, />AM</);
});

test("fiche : « Télécharger le CV » est un lien de téléchargement, « CV non déposé » sans CV", () => {
	const html = render(<AdminStudentProfile user={profile} />);
	assert.match(html, /<a href="\/api\/administration\/users\/1\/cv" download=""[^>]*>.*Télécharger le CV<\/a>/);
	const noCv = render(<AdminStudentProfile user={{ ...profile, cv_url: null }} />);
	assert.match(noCv, /CV non déposé/);
	assert.doesNotMatch(noCv, /Télécharger le CV|download=""/);
});

test("fiche (ADM-03) : « Suspendre le compte » pour un compte actif, avec une fenêtre de confirmation", () => {
	const active = render(<AdminStudentProfile user={profile} />);
	assert.match(active, /<button type="button" class="[^"]*bg-\[#e00000\][^"]*">Suspendre le compte<\/button>/);
	// The confirmation window, closed until the click
	assert.match(active, /<dialog [^>]*>/);
	assert.doesNotMatch(active, /<dialog [^>]*open/);
	for (const text of ["Suspendre le compte de Alice Martin ?", "ne pourra plus se connecter", "Annuler"]) assert.ok(active.includes(text), text);
	assert.doesNotMatch(active, /Suspendu le|Rétablir le compte/);
});

test("fiche (ADM-04) : compte suspendu, date en rouge et « Rétablir le compte » à la place", () => {
	const suspended = render(<AdminStudentProfile user={{ ...profile, is_active: false, suspended_at: "2026-10-15T12:00:00Z", school: null }} />);
	assert.match(suspended, /text-\[#e00000\]">Suspendu le <time dateTime="2026-10-15T12:00:00Z">15\/10\/2026<\/time>/);
	assert.match(suspended, />Rétablir le compte<\/button>/);
	assert.doesNotMatch(suspended, /Suspendre le compte|<dialog/);
	assert.match(suspended, /École non renseignée/);
	assert.match(render(<AdminStudentProfile user={{ ...profile, is_active: false }} />), /Compte suspendu, date non renseignée/);
});

test("fiche : session expirée, retour à la connexion admin puis à la fiche", () => {
	assert.equal(adminLoginLink("/administration/users/7"), "/administration?next=%2Fadministration%2Fusers%2F7");
	assert.equal(adminReturnTo(new URLSearchParams(adminLoginLink("/administration/users/7").split("?")[1]).get("next")), "/administration/users/7");
});

test("profil API : session, fiche inconnue, refus, serveur et réseau", async () => {
	globalThis.fetch = (async (url, init) => {
		assert.equal(url, "/api/administration/users/1");
		assert.equal(init?.credentials, "same-origin");
		return Response.json(profile);
	}) as typeof fetch;
	assert.deepEqual(await getAdminUser("1"), { ok: true, user: profile });
	for (const [status, reason] of [[401, "forbidden"], [403, "forbidden"], [404, "notFound"], [500, "server"]] as const) {
		globalThis.fetch = async () => new Response("", { status });
		assert.deepEqual(await getAdminUser("1"), { ok: false, reason });
	}
	globalThis.fetch = async () => new Response("not json");
	assert.deepEqual(await getAdminUser("1"), { ok: false, reason: "server" });
	globalThis.fetch = async () => { throw new TypeError("offline"); };
	assert.deepEqual(await getAdminUser("1"), { ok: false, reason: "network" });
});

test("API liste : critères de l'URL, cookie, annulation, accès interdit, réseau et réponse invalide", async () => {
	const controller = new AbortController();
	const page = { results: [user], count: 11, page: 2, page_size: 10, total_pages: 2 };
	globalThis.fetch = (async (url, init) => {
		assert.equal(url, "/api/administration/users?q=alice&page=2");
		assert.equal(init?.credentials, "same-origin");
		assert.equal(init?.signal, controller.signal);
		return Response.json(page);
	}) as typeof fetch;
	assert.deepEqual(await getAdminUsers("q=alice&page=2", controller.signal), { ...page, ok: true });
	globalThis.fetch = (async (url) => {
		assert.equal(url, "/api/administration/users");
		return Response.json(page);
	}) as typeof fetch;
	assert.equal((await getAdminUsers("")).ok, true);
	for (const [status, reason] of [[403, "forbidden"], [404, "notFound"], [400, "server"], [500, "server"]] as const) {
		globalThis.fetch = async () => new Response("", { status });
		assert.deepEqual(await getAdminUsers(""), { ok: false, reason });
	}
	globalThis.fetch = async () => { throw new TypeError("offline"); };
	assert.deepEqual(await getAdminUsers(""), { ok: false, reason: "network" });
	globalThis.fetch = async () => new Response("not json");
	assert.deepEqual(await getAdminUsers(""), { ok: false, reason: "server" });
});

test("API filtres : écoles proposées, erreur et réponse invalide", async () => {
	const schools = [{ id: 3, name: "Université Paris" }];
	globalThis.fetch = (async (url, init) => {
		assert.equal(url, "/api/administration/users/filters");
		assert.equal(init?.credentials, "same-origin");
		return Response.json({ schools });
	}) as typeof fetch;
	assert.deepEqual(await getAdminUserFilters(), { ok: true, schools });
	globalThis.fetch = async () => new Response("", { status: 403 });
	assert.deepEqual(await getAdminUserFilters(), { ok: false });
	globalThis.fetch = async () => Response.json({ schools: "none" });
	assert.deepEqual(await getAdminUserFilters(), { ok: false });
	globalThis.fetch = async () => { throw new TypeError("offline"); };
	assert.deepEqual(await getAdminUserFilters(), { ok: false });
});

test("connexion admin : formulaire sans lien d'inscription ni mot de passe oublié", () => {
	const html = render(<AdminLoginView onLoggedIn={noop} />);
	for (const text of ["Espace administrateur", "Adresse mail", "Mot de passe", "Se connecter"]) assert.ok(html.includes(text), text);
	assert.match(html, /type="password"/);
	assert.doesNotMatch(html, /href="\/signup"|Mot de passe oublié/);
});

test("connexion admin : retour vers la page d'administration demandée, jamais ailleurs", () => {
	assert.equal(adminReturnTo("/administration/users/7"), "/administration/users/7");
	assert.equal(adminReturnTo("/administration/users?q=alice&page=2"), "/administration/users?q=alice&page=2");
	for (const other of [null, "", "/administration", "/administration/", "/student", "https://example.com", "//example.com", "/administration//example.com", 3]) {
		assert.equal(adminReturnTo(other), "/administration/users", String(other));
	}
});

test("API connexion admin : jeton CSRF, identifiants refusés, serveur et réseau", async () => {
	const admin = { id: 1, first_name: "Jean", last_name: "Taire", role: 127 };
	globalThis.fetch = (async (url, init) => {
		if (url === "/api/csrf") return Response.json({ csrfToken: "jeton" });
		assert.equal(url, "/api/administration/login");
		assert.equal(init?.method, "POST");
		assert.equal(init?.credentials, "same-origin");
		assert.equal((init?.headers as Record<string, string>)["X-CSRFToken"], "jeton");
		assert.deepEqual(JSON.parse(String(init?.body)), { email: "admin@example.fr", password: "Secret123" });
		return Response.json(admin);
	}) as typeof fetch;
	assert.deepEqual(await adminLogin("admin@example.fr", "Secret123"), { ok: true, user: admin });
	for (const [status, reason] of [[401, "invalidCredentials"], [500, "server"]] as const) {
		globalThis.fetch = (async (url) => (url === "/api/csrf" ? Response.json({ csrfToken: "jeton" }) : new Response("", { status }))) as typeof fetch;
		assert.deepEqual(await adminLogin("admin@example.fr", "Secret123"), { ok: false, reason });
	}
	globalThis.fetch = async () => { throw new TypeError("offline"); };
	assert.deepEqual(await adminLogin("admin@example.fr", "Secret123"), { ok: false, reason: "network" });
});

test("API suspension : POST pour suspendre, DELETE pour rétablir, avec le jeton CSRF", async () => {
	const calls: { url: string; method?: string; token?: string }[] = [];
	globalThis.fetch = (async (url, init) => {
		if (url === "/api/csrf") return Response.json({ csrfToken: "jeton" });
		calls.push({ url: String(url), method: init?.method, token: (init?.headers as Record<string, string>)["X-CSRFToken"] });
		return Response.json({ ...profile, is_active: init?.method === "DELETE" });
	}) as typeof fetch;
	assert.equal((await setSuspension(1, true)).ok, true);
	const restored = await setSuspension(1, false);
	assert.ok(restored.ok && restored.user.is_active);
	assert.deepEqual(calls, [
		{ url: "/api/administration/users/1/suspension", method: "POST", token: "jeton" },
		{ url: "/api/administration/users/1/suspension", method: "DELETE", token: "jeton" },
	]);
	for (const [status, reason] of [[403, "forbidden"], [404, "notFound"], [500, "server"]] as const) {
		globalThis.fetch = (async (url) => (url === "/api/csrf" ? Response.json({ csrfToken: "jeton" }) : new Response("", { status }))) as typeof fetch;
		assert.deepEqual(await setSuspension(1, true), { ok: false, reason });
	}
	globalThis.fetch = async () => { throw new TypeError("offline"); };
	assert.deepEqual(await setSuspension(1, true), { ok: false, reason: "network" });
});

test("connexion : « Votre compte est suspendu » seulement pour la réponse du compte suspendu", async () => {
	const answer = (response: () => Response) => {
		globalThis.fetch = (async (url) => (url === "/api/csrf" ? Response.json({ csrfToken: "jeton" }) : response())) as typeof fetch;
	};
	answer(() => Response.json({ error: "Account suspended" }, { status: 403 }));
	assert.deepEqual(await login("alice@example.fr", "Secret123"), { ok: false, reason: "suspended" });
	// Another 403 (e.g. CSRF refusal) stays a server error
	answer(() => Response.json({ detail: "CSRF Failed" }, { status: 403 }));
	assert.deepEqual(await login("alice@example.fr", "Secret123"), { ok: false, reason: "server" });
	answer(() => new Response("", { status: 401 }));
	assert.deepEqual(await login("alice@example.fr", "Secret123"), { ok: false, reason: "invalidCredentials" });
});
