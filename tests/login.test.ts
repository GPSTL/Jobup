import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { getSession, login } from "../front/services/auth";

const realFetch = globalThis.fetch;
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
