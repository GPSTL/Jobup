import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { getSession, login, logout } from "../front/services/auth";
import { DEMO_EMAIL, DEMO_PASSWORD, endDemoSession } from "../front/services/demoAuth";

const realFetch = globalThis.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const student = { id: 1, name: "Durand", first_name: "Élodie", role: 1 };

// Remplace fetch par une réponse simulée et garde la trace de la requête envoyée
function mockFetch(respond: () => Response | Promise<Response>) {
	const calls: { url: string; init?: RequestInit }[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		return respond();
	}) as typeof fetch;
	return calls;
}

afterEach(() => {
	globalThis.fetch = realFetch;
	if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
	else Reflect.deleteProperty(globalThis, "window");
});

function mockSessionStorage() {
	const values = new Map<string, string>();
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: { sessionStorage: {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
			removeItem: (key: string) => values.delete(key),
		} },
	});
}

test("demo login persists a simulated session without calling the authentication API", async () => {
	mockSessionStorage();
	const calls = mockFetch(() => { throw new Error("Demo must not call the backend"); });
	const result = await login(` ${DEMO_EMAIL.toUpperCase()} `, DEMO_PASSWORD);
	assert.equal(result.ok, true);
	assert.deepEqual(await getSession(), result);
	assert.equal(calls.length, 0);
});

test("demo rejects incorrect passwords without creating a session or calling the API", async () => {
	mockSessionStorage();
	const calls = mockFetch(() => Response.json({}, { status: 403 }));
	assert.deepEqual(await login(DEMO_EMAIL, "wrong"), { ok: false, reason: "invalidCredentials" });
	assert.equal(calls.length, 0);
	assert.deepEqual(await getSession(), { ok: false, reason: "noSession" });
});

test("leaving demo restores backend session checks", async () => {
	mockSessionStorage();
	await login(DEMO_EMAIL, DEMO_PASSWORD);
	endDemoSession();
	const calls = mockFetch(() => Response.json({}, { status: 403 }));
	assert.deepEqual(await getSession(), { ok: false, reason: "noSession" });
	assert.equal(calls[0].url, "/api/me");
});

test("demo logout clears the session without calling the backend", async () => {
	mockSessionStorage();
	await login(DEMO_EMAIL, DEMO_PASSWORD);
	const calls = mockFetch(() => Response.json({}, { status: 403 }));
	assert.equal(await logout(), true);
	assert.equal(calls.length, 0);
	assert.deepEqual(await getSession(), { ok: false, reason: "noSession" });
});

test("real logout sends CSRF and session cookies", async () => {
	let request = 0;
	const calls = mockFetch(() => ++request === 1 ? Response.json({ csrfToken: "csrf-test" }) : new Response(null, { status: 204 }));
	assert.equal(await logout(), true);
	assert.equal(calls[1].url, "/api/logout");
	assert.equal(calls[1].init?.method, "POST");
	assert.equal(calls[1].init?.credentials, "same-origin");
	assert.deepEqual(calls[1].init?.headers, { "X-CSRFToken": "csrf-test" });
});

test("real logout failure is reported instead of claiming the user is signed out", async () => {
	mockFetch(() => new Response(null, { status: 403 }));
	assert.equal(await logout(), false);
});

test("a real login clears a previous demo session and uses the backend", async () => {
	mockSessionStorage();
	await login(DEMO_EMAIL, DEMO_PASSWORD);
	const calls = mockFetch(() => Response.json(student));
	assert.deepEqual(await login("real@example.fr", "Example123"), { ok: true, user: student });
	assert.deepEqual(await getSession(), { ok: true, user: student });
	assert.deepEqual(calls.map((call) => call.url), ["/api/login", "/api/me"]);
});

test("demo reports a failure when browser storage is unavailable", async () => {
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		get: () => { throw new Error("Storage disabled"); },
	});
	assert.deepEqual(await login(DEMO_EMAIL, DEMO_PASSWORD), { ok: false, reason: "server" });
});

test("connexion réussie : renvoie l'utilisateur et envoie les identifiants avec le cookie de session", async () => {
	const calls = mockFetch(() => Response.json(student));
	const result = await login("test@example.fr", "Example123");

	assert.deepEqual(result, { ok: true, user: student });
	assert.equal(calls[0].url, "/api/login");
	assert.equal(calls[0].init?.method, "POST");
	assert.equal(calls[0].init?.credentials, "same-origin");
	assert.deepEqual(JSON.parse(calls[0].init?.body as string), { email: "test@example.fr", password: "Example123" });
});

test("identifiants incorrects : 401 donne invalidCredentials", async () => {
	mockFetch(() => Response.json({ error: "Invalid credentials" }, { status: 401 }));
	assert.deepEqual(await login("test@example.fr", "wrong"), { ok: false, reason: "invalidCredentials" });
});

test("erreur réseau : un fetch qui échoue donne network", async () => {
	mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
	assert.deepEqual(await login("test@example.fr", "Example123"), { ok: false, reason: "network" });
});

test("erreur serveur : 500 ou réponse non JSON donne server", async () => {
	mockFetch(() => new Response("oops", { status: 500 }));
	assert.deepEqual(await login("test@example.fr", "Example123"), { ok: false, reason: "server" });
	mockFetch(() => new Response("<!doctype html>", { status: 200 }));
	assert.deepEqual(await login("test@example.fr", "Example123"), { ok: false, reason: "server" });
});

test("accès sans session : 403 ou 401 sur /api/me donne noSession", async () => {
	const calls = mockFetch(() => Response.json({ detail: "Not authenticated" }, { status: 403 }));
	assert.deepEqual(await getSession(), { ok: false, reason: "noSession" });
	assert.equal(calls[0].url, "/api/me");
	mockFetch(() => Response.json({}, { status: 401 }));
	assert.deepEqual(await getSession(), { ok: false, reason: "noSession" });
});

test("session valide : /api/me renvoie l'utilisateur connecté", async () => {
	mockFetch(() => Response.json(student));
	assert.deepEqual(await getSession(), { ok: true, user: student });
});

test("vérification de session sans réseau : donne network", async () => {
	mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
	assert.deepEqual(await getSession(), { ok: false, reason: "network" });
});
