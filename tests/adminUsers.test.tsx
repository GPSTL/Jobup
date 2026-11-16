import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AdminUserCard, AdminUsersContent } from "../front/pages/AdminUsersPage";
import { getAdminUser, getAdminUsers, type AdminUser, type AdminUserDetail } from "../front/services/adminUsers";
import { AdminStudentProfile } from "../front/pages/AdminUserDetailPage";
import AdminNavbar from "../front/components/AdminNavbar";
import StudentNavbar from "../front/components/StudentNavbar";

const user: AdminUser = { id: 1, first_name: "Alice", last_name: "Martin", email: "alice@example.fr", role: 1, date_joined: "2026-10-09T12:00:00Z", is_active: true, suspended_at: null, detail_url: null };
const render = (element: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
const noop = () => {};
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("navigation partagée : menu mobile, page active, rubriques indisponibles et déconnexion", () => {
	const html = renderToStaticMarkup(<MemoryRouter initialEntries={["/administration/users"]}><AdminNavbar /></MemoryRouter>);
	assert.match(html, /aria-expanded="false"/);
	assert.match(html, /aria-current="page"/);
	assert.match(html, /aria-disabled="true" title="Bientôt disponible"/);
	assert.match(html, /Déconnexion/);
	assert.doesNotMatch(html, /href="\/administration\/(account|companies|schools)"/);
	const student = render(<StudentNavbar />);
	assert.match(student, /href="\/student"/);
	assert.match(student, /href="\/applications"/);
	assert.match(student, /aria-expanded="false"/);
	assert.doesNotMatch(student, /Déconnexion/);
});

test("carte : identité, date française et fiche indisponible sans lien cassé", () => {
	const html = render(<AdminUserCard user={user} />);
	for (const text of ["Alice Martin", "alice@example.fr", "09/10/2026", "bientôt disponible"]) assert.ok(html.includes(text));
	assert.match(html, /disabled=""/);
	assert.doesNotMatch(html, /Suspendu le|href=/);
});

test("suspension : date rouge, sans inventer une date historique", () => {
	const html = render(<AdminUserCard user={{ ...user, is_active: false, suspended_at: "2026-10-15T12:00:00Z" }} />);
	assert.match(html, /text-\[#e00000\]/);
	assert.match(html, /15\/10\/2026/);
	assert.match(render(<AdminUserCard user={{ ...user, is_active: false }} />), /date non renseignée/);
});

test("fiche : flèche active vers le profil étudiant administrateur", () => {
	const html = render(<AdminUserCard user={{ ...user, detail_url: "/administration/users/1" }} />);
	assert.match(html, /href="\/administration\/users\/1"/);
	assert.match(html, /Voir la fiche de Alice Martin/);
	assert.doesNotMatch(html, /disabled=""/);
});

const profile: AdminUserDetail = { ...user, school: "Université Paris", phone: null, applications_sent: 7, cv_url: "/api/administration/users/1/cv" };

test("profil : données réelles, champs absents explicites, CV et suspension", () => {
	const html = render(<AdminStudentProfile user={profile} />);
	for (const text of ["Alice", "Martin", "Université Paris", "Téléphone non renseigné", "alice@example.fr", "7 candidatures envoyées", "09/10/2026", "Télécharger le CV", "Suspendre le compte"]) assert.ok(html.includes(text), text);
	assert.doesNotMatch(html, /67 candidatures/);
	const empty = render(<AdminStudentProfile user={{ ...profile, school: null, cv_url: null, applications_sent: 0, is_active: false }} />);
	assert.match(empty, /École non renseignée/);
	assert.match(empty, /Aucun CV disponible/);
	assert.match(empty, /Compte suspendu/);
	assert.match(empty, /disabled=""/);
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

test("liste : chargement, vide, erreurs et pagination", () => {
	const view = (result: Parameters<typeof AdminUsersContent>[0]["result"]) => render(<AdminUsersContent result={result} onRetry={noop} onPageChange={noop} />);
	assert.match(view(null), /Chargement/);
	assert.match(view({ ok: true, results: [], count: 0, page: 1, total_pages: 1 }), /Aucun utilisateur/);
	for (const reason of ["network", "server", "forbidden", "notFound"] as const) assert.match(view({ ok: false, reason }), /role="alert"/);
	const html = view({ ok: true, results: [user], count: 9, page: 1, total_pages: 2 });
	assert.match(html, /aria-label="Page 2"/);
	assert.match(html, /aria-current="page"/);
});

test("API : pagination et cookie, accès interdit, réseau et réponse invalide", async () => {
	globalThis.fetch = (async (url, init) => {
		assert.equal(url, "/api/administration/users?page=2");
		assert.equal(init?.credentials, "same-origin");
		return Response.json({ results: [user], count: 9, page: 2, total_pages: 2 });
	}) as typeof fetch;
	assert.equal((await getAdminUsers(2)).ok, true);
	for (const [status, reason] of [[403, "forbidden"], [404, "notFound"], [500, "server"]] as const) {
		globalThis.fetch = async () => new Response("", { status });
		assert.deepEqual(await getAdminUsers(1), { ok: false, reason });
	}
	globalThis.fetch = async () => { throw new TypeError("offline"); };
	assert.deepEqual(await getAdminUsers(1), { ok: false, reason: "network" });
	globalThis.fetch = async () => new Response("not json");
	assert.deepEqual(await getAdminUsers(1), { ok: false, reason: "server" });
});
