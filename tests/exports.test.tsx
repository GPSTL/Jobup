import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import ExportPanel, { ExportForm } from "../front/components/ExportPanel";
import { AdminUsersTable, exportDefaults, exportFields } from "../front/pages/AdminUsersPage";
import type { AdminUser } from "../front/services/adminUsers";
import { downloadCsv, REVOKE_DELAY, saveFile } from "../front/services/exports";
import { DEFAULT_QUERY, MAX_SELECTION, readSelection, saveSelection, toggleIds } from "../front/utils/adminUsers";
import { exportQuery, initialValues, type ExportField } from "../front/utils/exports";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const fields: ExportField[] = [
	{ kind: "select", key: "role", label: "Rôle", options: [{ value: "", label: "Tous les rôles" }, { value: "student", label: "Étudiants" }] },
	{ kind: "checkboxes", key: "status", label: "Statut", options: [{ value: "review", label: "En cours d’étude" }, { value: "accepted", label: "Acceptée" }] },
	{ kind: "toggle", key: "q", label: "Appliquer la recherche", value: "alice martin" },
];

test("filtres d'export : rien de choisi, tout est exporté sauf les cases isolées, cochées au départ", () => {
	assert.deepEqual(initialValues(fields), { role: "", status: [], q: true });
	assert.equal(exportQuery(fields, { role: "", status: [], q: false }), "");
});

test("filtres d'export : valeurs choisies, listes jointes par une virgule, texte encodé", () => {
	assert.equal(exportQuery(fields, { role: "student", status: ["review", "accepted"], q: true }), "role=student&status=review%2Caccepted&q=alice+martin");
	assert.deepEqual(initialValues(fields, { role: "student", status: ["review"] }), { role: "student", status: ["review"], q: true });
});

test("panneau : replié par défaut, les filtres apparaissent à l'ouverture", () => {
	const closed = renderToStaticMarkup(<ExportPanel url="/api/x/export" fields={fields} />);
	assert.match(closed, /aria-expanded="false"/);
	assert.match(closed, />Exporter en CSV</);
	assert.doesNotMatch(closed, /Télécharger le CSV/);
	// Nothing to choose: one button that downloads at once
	const direct = renderToStaticMarkup(<ExportPanel url="/api/offers/3/export" fields={[]} />);
	assert.match(direct, />Exporter en CSV</);
	assert.doesNotMatch(direct, /aria-expanded/);

	const form = renderToStaticMarkup(<ExportForm url="/api/x/export" fields={fields} defaults={{ role: "student", status: ["accepted"] }} />);
	assert.match(form, /<option value="student" selected="">Étudiants/);
	assert.match(form, /<legend[^>]*>Statut<\/legend>/);
	assert.match(form, /Aucune case cochée : tout est exporté/);
	assert.match(form, /<input type="checkbox" class="[^"]*" checked=""\/><span[^>]*>Acceptée/);
	assert.match(form, /<input type="checkbox" class="[^"]*"\/><span[^>]*>En cours d’étude/);
	assert.match(form, /<input type="checkbox" class="[^"]*" checked=""\/>Appliquer la recherche/);
	assert.match(form, />Télécharger le CSV</);
});

test("téléchargement : le fichier reçoit le nom donné par le serveur", async () => {
	const urls: string[] = [];
	globalThis.fetch = (async (url: string) => {
		urls.push(url);
		return new Response("a;b\n", { headers: { "Content-Disposition": 'attachment; filename="etudiants-2026-11-19.csv"' } });
	}) as typeof fetch;
	const saved: { name: string; text: string }[] = [];
	const result = await downloadCsv("/api/school/students/export?status=signed", async (blob, name) => { saved.push({ name, text: await blob.text() }); });
	assert.deepEqual(result, { ok: true, filename: "etudiants-2026-11-19.csv" });
	assert.deepEqual(urls, ["/api/school/students/export?status=signed"]);
	await new Promise((resolve) => setTimeout(resolve));
	assert.deepEqual(saved, [{ name: "etudiants-2026-11-19.csv", text: "a;b\n" }]);
});

test("téléchargement : échecs traduits en raisons, sans enregistrer de fichier", async () => {
	let saved = false;
	const save = () => { saved = true; };
	for (const [status, reason] of [[401, "unauthenticated"], [403, "unauthenticated"], [400, "invalid"], [500, "server"]] as const) {
		globalThis.fetch = (async () => new Response("{}", { status })) as typeof fetch;
		assert.deepEqual(await downloadCsv("/api/x", save), { ok: false, reason }, String(status));
	}
	globalThis.fetch = (async () => { throw new TypeError("offline"); }) as typeof fetch;
	assert.deepEqual(await downloadCsv("/api/x", save), { ok: false, reason: "network" });
	globalThis.fetch = (async () => new Response("a")) as typeof fetch;
	assert.deepEqual(await downloadCsv("/api/x", () => { throw new Error("blocked"); }), { ok: false, reason: "server" });
	assert.equal(saved, false);
	// Without a header, a default name
	assert.deepEqual(await downloadCsv("/api/x", save), { ok: true, filename: "export.csv" });
});

const user: AdminUser = { id: 1, first_name: "Alice", last_name: "Martin", email: "alice@example.fr", role: 1, school: "Université Paris", date_joined: "2026-10-09T12:00:00Z", is_active: true, suspended_at: null, detail_url: "/administration/users/1" };
const users = [user, { ...user, id: 2, first_name: "Bob" }];
const table = (ids: number[]) => renderToStaticMarkup(<MemoryRouter><AdminUsersTable users={users} sort="-date_joined" onSort={() => {}} selection={{ ids, onChange: () => {} }} /></MemoryRouter>);

test("sélection : une case par compte et une pour la page, sans case si le tableau n'est pas sélectionnable", () => {
	const none = table([]);
	assert.match(none, /aria-label="Sélectionner Alice Martin"/);
	assert.match(none, /aria-label="Sélectionner Bob Martin"/);
	assert.match(none, /aria-label="Sélectionner tous les comptes de la page"/);
	assert.doesNotMatch(none, /checked=""/);
	const plain = renderToStaticMarkup(<MemoryRouter><AdminUsersTable users={users} sort="-date_joined" onSort={() => {}} /></MemoryRouter>);
	assert.doesNotMatch(plain, /type="checkbox"/);
});

test("sélection : lignes cochées en surbrillance, la case de la page suit", () => {
	const some = table([2]);
	assert.equal(some.match(/checked=""/g)?.length, 1);
	assert.match(some, /<tr class="border-t border-\[#e1e3e8\] bg-\[#eff6ff\]">/);
	assert.equal(table([1, 2]).match(/checked=""/g)?.length, 3);
});

test("sélection : cocher ajoute sans doublon, décocher retire, jamais plus que l'export n'accepte", () => {
	assert.deepEqual(toggleIds([1], [2, 1], true), [1, 2]);
	assert.deepEqual(toggleIds([1, 2, 3], [2], false), [1, 3]);
	assert.deepEqual(toggleIds([1, 2], [3, 4], false), [1, 2]);
	const full = Array.from({ length: MAX_SELECTION }, (_, index) => index + 1);
	assert.equal(toggleIds(full, [MAX_SELECTION + 1], true).length, MAX_SELECTION);
});

test("export admin : filtres de la liste, et sélection ou recherche seulement quand il y en a", () => {
	const keys = (query = DEFAULT_QUERY, selected: number[] = []) => exportFields(query, [{ id: 3, name: "ISEG" }], selected).map(({ key }) => key);
	assert.deepEqual(keys(), ["role", "status", "school"]);
	assert.deepEqual(keys({ ...DEFAULT_QUERY, q: "alice" }, [4, 5]), ["role", "status", "school", "ids", "q"]);
	const [, , school, ids] = exportFields(DEFAULT_QUERY, [{ id: 3, name: "ISEG" }], [4, 5]);
	assert.deepEqual(school.kind === "select" && school.options.at(-1), { value: "3", label: "ISEG" });
	assert.deepEqual(ids, { kind: "toggle", key: "ids", label: "Seulement les 2 comptes sélectionnés", value: "4,5" });
	// The list of schools failed to load: only "Toutes les écoles" remains
	assert.equal((exportFields(DEFAULT_QUERY, "error", [])[2] as { options: unknown[] }).options.length, 1);
});

test("export admin : part des comptes étudiants, comme le tableau, avec ses filtres", () => {
	const query = { ...DEFAULT_QUERY, status: "suspended" as const, school: "3" };
	assert.deepEqual(exportDefaults(query), { role: "student", status: "suspended", school: "3" });
	const form = renderToStaticMarkup(<ExportForm url="/api/administration/users/export" fields={exportFields(query, [{ id: 3, name: "ISEG" }], [])} defaults={exportDefaults(query)} />);
	assert.match(form, /<option value="student" selected="">Étudiants/);
	assert.match(form, /<option value="suspended" selected="">Suspendus/);
	assert.match(form, /<option value="3" selected="">ISEG/);
	// Every role stays available, chosen on purpose
	assert.match(form, /<option value="">Tous les rôles/);
});

test("téléchargement : le lien est cliqué dans la page, et l'adresse du fichier libérée plus tard", async () => {
	const events: string[] = [];
	const link = { href: "", download: "", click: () => events.push("click"), remove: () => events.push("remove") };
	const realDocument = globalThis.document;
	const { createObjectURL, revokeObjectURL } = URL;
	Object.assign(globalThis, { document: { createElement: () => link, body: { append: () => events.push("append") } } });
	URL.createObjectURL = () => "blob:export";
	URL.revokeObjectURL = (href: string) => { events.push(`revoke ${href}`); };
	try {
		saveFile(new Blob(["a;b"]), "offres-2026-11-19.csv");
		assert.deepEqual(link, { ...link, href: "blob:export", download: "offres-2026-11-19.csv" });
		// Released right after the click, some browsers would cancel the download
		assert.deepEqual(events, ["append", "click", "remove"]);
		await new Promise((resolve) => setTimeout(resolve, REVOKE_DELAY + 50));
		assert.deepEqual(events, ["append", "click", "remove", "revoke blob:export"]);
	} finally {
		Object.assign(globalThis, { document: realDocument });
		URL.createObjectURL = createObjectURL;
		URL.revokeObjectURL = revokeObjectURL;
	}
});

test("sélection : gardée pour l'onglet, valeurs invalides ignorées, page sans stockage", () => {
	const store = new Map<string, string>();
	Object.assign(globalThis, { sessionStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value), removeItem: (key: string) => store.delete(key) } });
	try {
		assert.deepEqual(readSelection(), []);
		saveSelection([3, 5]);
		assert.deepEqual(readSelection(), [3, 5]);
		saveSelection([]);
		assert.equal(store.size, 0);
		store.set("adminUsersSelection", JSON.stringify([2, "x", -1, 1.5, 7]));
		assert.deepEqual(readSelection(), [2, 7]);
		store.set("adminUsersSelection", "{");
		assert.deepEqual(readSelection(), []);
		store.set("adminUsersSelection", '{"a":1}');
		assert.deepEqual(readSelection(), []);
	} finally {
		Reflect.deleteProperty(globalThis, "sessionStorage");
	}
	// Without storage (blocked, or not a browser) nothing throws
	assert.deepEqual(readSelection(), []);
	assert.doesNotThrow(() => saveSelection([1]));
});
