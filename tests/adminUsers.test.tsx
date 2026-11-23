import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AdminUsersResults, AdminUsersTable, AdminUsersToolbar } from "../front/pages/AdminUsersPage";
import { getAdminUser, getAdminUsers, setSuspension, type AdminUser, type AdminUserDetail, type AdminUsersResult } from "../front/services/adminUsers";
import { AdminUserProfile } from "../front/pages/AdminUserDetailPage";
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

const user: AdminUser = { id: 1, first_name: "Alice", last_name: "Martin", email: "alice@example.fr", role: 1, date_joined: "2026-10-09T12:00:00Z", is_active: true, suspended_at: null, detail_url: "/administration/users/1" };
const render = (element: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
const noop = () => {};
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("navigation partagée : rubriques renommées, menu mobile, page active et déconnexion", () => {
	const html = renderToStaticMarkup(<MemoryRouter initialEntries={["/administration/users"]}><AdminNavbar /></MemoryRouter>);
	assert.match(html, /aria-expanded="false"/);
	assert.match(html, /aria-current="page"/);
	assert.match(html, /Se déconnecter/);
	// Every section has its page, under a short name
	for (const [path, label] of [["account", "Mon espace"], ["users", "Utilisateurs"], ["companies", "Entreprises"], ["schools", "Écoles"], ["reports", "Signalements"], ["claims", "Réclamations"]]) {
		assert.match(html, new RegExp(`href="/administration/${path}"[^>]*>${label}<`), label);
	}
	assert.doesNotMatch(html, /aria-disabled="true"|Liste d/);
	const student = render(<StudentNavbar />);
	assert.match(student, /href="\/student"/);
	assert.match(student, /href="\/applications"/);
	assert.match(student, /aria-expanded="false"/);
	// Every role logs out from the account menu of AccountNavbar
	assert.match(student, /Se déconnecter/);
});

test("tableau : colonnes, identité, type de compte, date française et flèche vers la fiche", () => {
	const html = renderToStaticMarkup(
		<MemoryRouter initialEntries={["/administration/users?q=ali&page=2"]}>
			<AdminUsersTable users={[user, { ...user, id: 2, role: 3 }, { ...user, id: 3, role: 2 }, { ...user, id: 4, role: 127 }]} sort="-date_joined" onSort={noop} />
		</MemoryRouter>,
	);
	for (const text of ["Prénom", "Nom", "E-mail", "Type de compte", "Inscription", "Statut", "Alice", "Martin", "alice@example.fr", "Étudiant", "Recruteur", "Manager", "Administrateur", "09/10/2026", "Actif"]) assert.ok(html.includes(text), text);
	assert.doesNotMatch(html, /École/);
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

test("filtres : type de compte, statuts, et réinitialisation seulement avec des critères", () => {
	const toolbar = (query = DEFAULT_QUERY) => render(<AdminUsersToolbar query={query} onSearch={noop} onChange={noop} onReset={noop} />);
	const html = toolbar();
	for (const text of ["Rechercher un utilisateur par nom, e-mail, école ou entreprise", "Type de compte", "Tous les types", "Étudiants", "Managers", "Recruteurs", "Tous les statuts", "Actifs", "Suspendus"]) assert.ok(html.includes(text), text);
	assert.match(html, /<option value="manager">Managers<\/option>/);
	// The school is too specific for a list of every account
	assert.doesNotMatch(html, /Toutes les écoles|<option value="admin">/);
	assert.doesNotMatch(html, /Réinitialiser/);
	const filtered = toolbar({ ...DEFAULT_QUERY, q: "alice", role: "recruiter" });
	assert.match(filtered, /value="alice"/);
	assert.match(filtered, /<option value="recruiter" selected="">Recruteurs/);
	assert.match(filtered, /Réinitialiser/);
	// An administrator filter of the URL stays shown
	assert.match(toolbar({ ...DEFAULT_QUERY, role: "admin" }), /<option value="admin" selected="">Administrateurs/);
});

test("résultats : chargement, erreurs, liste vide, aucun résultat et pagination", () => {
	const view = (result: AdminUsersResult | null, query = DEFAULT_QUERY) =>
		render(<AdminUsersResults result={result} loading={false} query={query} onChange={noop} onRetry={noop} onReset={noop} />);
	assert.match(view(null), /Chargement/);
	for (const reason of ["network", "server", "forbidden", "notFound"] as const) assert.match(view({ ok: false, reason }), /role="alert"/);
	assert.match(view({ ok: false, reason: "notFound" }), /Revenir à la première page/);
	assert.match(view({ ok: false, reason: "forbidden" }), /href="\/administration\?next=%2Fadministration%2Fusers"/);
	const empty: AdminUsersResult = { ok: true, results: [], count: 0, page: 1, page_size: 10, total_pages: 1 };
	assert.match(view(empty), /Aucun utilisateur inscrit/);
	const noMatch = view(empty, { ...DEFAULT_QUERY, status: "suspended" });
	assert.match(noMatch, /Aucun utilisateur ne correspond à votre recherche/);
	assert.match(noMatch, /Réinitialiser les filtres/);
	const html = view({ ok: true, results: [user], count: 11, page: 2, page_size: 10, total_pages: 2 });
	assert.match(html, /11–11 sur 11 comptes/);
	assert.match(html, /aria-label="Page 1"/);
	assert.match(html, /aria-current="page"/);
	assert.match(html, /Lignes par page/);
	assert.match(html, /<option value="25">25<\/option>/);
});

test("URL : valeurs par défaut, valeurs invalides ignorées et aller-retour", () => {
	assert.deepEqual(queryFromParams(new URLSearchParams()), DEFAULT_QUERY);
	const invalid = queryFromParams(new URLSearchParams("status=deleted&role=teacher&sort=school&page=0&page_size=11"));
	assert.deepEqual(invalid, DEFAULT_QUERY);
	const query = queryFromParams(new URLSearchParams("q=+alice+&status=suspended&role=recruiter&sort=role&page=2&page_size=25"));
	assert.deepEqual(query, { q: "alice", status: "suspended", role: "recruiter", sort: "role", page: 2, page_size: 25 });
	assert.equal(searchFromQuery(query), "q=alice&status=suspended&role=recruiter&sort=role&page_size=25&page=2");
	assert.deepEqual(queryFromParams(new URLSearchParams(searchFromQuery(query))), query);
	// Default values stay out of the URL
	assert.equal(searchFromQuery(DEFAULT_QUERY), "");
	assert.equal(hasCriteria(DEFAULT_QUERY), false);
	assert.equal(hasCriteria({ ...DEFAULT_QUERY, role: "manager" }), true);
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
	assert.equal(sortDirection("email", "role"), undefined);
});

test("libellés : plage affichée et retour vers la liste", () => {
	assert.equal(rangeLabel(42, 1, 10, 10), "1–10 sur 42 comptes");
	assert.equal(rangeLabel(42, 5, 10, 2), "41–42 sur 42 comptes");
	assert.equal(rangeLabel(1, 1, 10, 1), "1–1 sur 1 compte");
	assert.equal(adminUsersLink("/administration/users?q=alice&page=2"), "/administration/users?q=alice&page=2");
	assert.equal(adminUsersLink("/administration/users"), "/administration/users");
	for (const other of ["/administration/users/5", "/administration/usersx", "https://example.com", "//example.com", 3, undefined]) {
		assert.equal(adminUsersLink(other), "/administration/users", String(other));
	}
});

const profile: AdminUserDetail = { ...user, school: "Université Paris", company: null, photo_url: null, phone: null, applications_sent: 7, cv_url: "/api/administration/users/1/cv", can_suspend: true };

test("fiche (ADM-02) : école, téléphone, e-mail, candidatures envoyées et date d'inscription", () => {
	const html = render(<AdminUserProfile user={profile} />);
	for (const text of ["Alice Martin", "Étudiant", "Université Paris", "Téléphone non renseigné", "alice@example.fr", "7 candidatures envoyées", "Inscription le", "09/10/2026"]) assert.ok(html.includes(text), text);
	// Labels of the icons, for screen readers
	for (const label of ["Type de compte", "École", "Téléphone", "E-mail", "Candidatures", "Inscription"]) assert.match(html, new RegExp(`<span class="sr-only">${label}</span>`));
	assert.match(render(<AdminUserProfile user={{ ...profile, applications_sent: 1 }} />), /1 candidature envoyée</);
	assert.match(render(<AdminUserProfile user={{ ...profile, applications_sent: 0 }} />), /Aucune candidature envoyée/);
});

test("fiche : photo du profil, ou initiales sans photo", () => {
	assert.match(render(<AdminUserProfile user={{ ...profile, photo_url: "/media/photos/alice.png" }} />), /<img src="\/media\/photos\/alice.png"/);
	const noPhoto = render(<AdminUserProfile user={profile} />);
	assert.doesNotMatch(noPhoto, /<img/);
	assert.match(noPhoto, />AM</);
});

test("fiche : « Télécharger le CV » est un lien de téléchargement, « CV non déposé » sans CV", () => {
	const html = render(<AdminUserProfile user={profile} />);
	assert.match(html, /<a href="\/api\/administration\/users\/1\/cv" download=""[^>]*>.*Télécharger le CV<\/a>/);
	const noCv = render(<AdminUserProfile user={{ ...profile, cv_url: null }} />);
	assert.match(noCv, /CV non déposé/);
	assert.doesNotMatch(noCv, /Télécharger le CV|download=""/);
});

test("fiche (ADM-03) : « Suspendre le compte » pour un compte actif, avec une fenêtre de confirmation", () => {
	const active = render(<AdminUserProfile user={profile} />);
	assert.match(active, /<button type="button" class="[^"]*bg-\[#e00000\][^"]*">Suspendre le compte<\/button>/);
	// The confirmation window, closed until the click
	assert.match(active, /<dialog [^>]*>/);
	assert.doesNotMatch(active, /<dialog [^>]*open/);
	for (const text of ["Suspendre le compte de Alice Martin ?", "ne pourra plus se connecter", "Annuler"]) assert.ok(active.includes(text), text);
	assert.doesNotMatch(active, /Suspendu le|Rétablir le compte/);
});

test("fiche (ADM-04) : compte suspendu, date en rouge et « Rétablir le compte » à la place", () => {
	const suspended = render(<AdminUserProfile user={{ ...profile, is_active: false, suspended_at: "2026-10-15T12:00:00Z", school: null }} />);
	assert.match(suspended, /text-\[#e00000\]">Suspendu le <time dateTime="2026-10-15T12:00:00Z">15\/10\/2026<\/time>/);
	assert.match(suspended, />Rétablir le compte<\/button>/);
	assert.doesNotMatch(suspended, /Suspendre le compte|<dialog/);
	assert.match(suspended, /École non renseignée/);
	assert.match(render(<AdminUserProfile user={{ ...profile, is_active: false }} />), /Compte suspendu, date non renseignée/);
});

test("fiche : un manager montre son école, un recruteur son entreprise, sans candidatures ni CV", () => {
	const manager = render(<AdminUserProfile user={{ ...profile, role: 2, applications_sent: null, cv_url: null }} />);
	assert.match(manager, />Manager</);
	assert.match(manager, /Université Paris/);
	assert.doesNotMatch(manager, /Candidatures|CV non déposé|Télécharger le CV/);
	assert.match(manager, />Suspendre le compte<\/button>/);
	const recruiter = render(<AdminUserProfile user={{ ...profile, role: 3, school: null, company: "Acme", applications_sent: null, cv_url: null }} />);
	assert.match(recruiter, />Recruteur</);
	assert.match(recruiter, /<span class="sr-only">Entreprise<\/span>/);
	assert.match(recruiter, /Acme/);
	assert.doesNotMatch(recruiter, /École|Candidatures|CV non déposé/);
	assert.match(render(<AdminUserProfile user={{ ...profile, role: 3, school: null, applications_sent: null, cv_url: null }} />), /Entreprise non renseignée/);
});

test("fiche : un compte administrateur ne peut pas être suspendu", () => {
	const admin = render(<AdminUserProfile user={{ ...profile, role: 127, school: null, applications_sent: null, cv_url: null, can_suspend: false }} />);
	assert.match(admin, />Administrateur</);
	assert.match(admin, /Un compte administrateur ne peut pas être suspendu/);
	assert.doesNotMatch(admin, /Suspendre le compte|Rétablir le compte|<dialog/);
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
