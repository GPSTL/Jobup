import { afterEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CandidatePresence, { presenceState, PRESENCE_TTL } from "../front/components/CandidatePresence";
import { getRecruiterConversations } from "../front/services/recruiterConversations";
import { HEARTBEAT_DELAY, startHeartbeat } from "../front/services/presence";

const realFetch = globalThis.fetch;
const realDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

// Replaces fetch with a simulated response and keeps the requested URLs
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
	if (realDocument) Object.defineProperty(globalThis, "document", realDocument);
	else delete (globalThis as { document?: unknown }).document;
	mock.timers.reset();
});

test("presence expires and never treats missing, invalid or future timestamps as online", () => {
	const now = Date.parse("2026-11-09T12:00:00Z");
	assert.equal(presenceState(new Date(now - PRESENCE_TTL + 1).toISOString(), now), "online");
	assert.equal(presenceState(new Date(now - PRESENCE_TTL).toISOString(), now), "offline");
	assert.equal(presenceState(null, now), "unknown");
	assert.equal(presenceState("invalid", now), "unknown");
	assert.equal(presenceState(new Date(now + 1000).toISOString(), now), "unknown");
});

test("présence : un candidat vu juste après l'affichage de l'en-tête est « En ligne », pas « indisponible »", () => {
	const shown = (lastSeen: string | null) => renderToStaticMarkup(createElement(CandidatePresence, { lastSeen }));
	// Liste reçue après le dernier battement de 5 s du composant : date un peu après son heure
	assert.match(shown(new Date(Date.now() + 1000).toISOString()), /En ligne/);
	assert.match(shown(new Date(Date.now() - PRESENCE_TTL - 1000).toISOString()), /Hors ligne/);
	assert.match(shown(null), /Présence indisponible/);
	assert.match(shown("invalid"), /Présence indisponible/);
});

test("liste : l'âge de la dernière requête devient une date de l'horloge du navigateur", async () => {
	const lucas = { id: 1, candidate: { id: 5, first_name: "Lucas", last_name: "Martin" }, last_message: null };
	const urls = mockFetch(() => Response.json([{ ...lucas, seen_seconds_ago: 30 }, { ...lucas, id: 2, seen_seconds_ago: null }]));
	const before = Date.now();
	const result = await getRecruiterConversations();
	assert.deepEqual(urls, ["/api/recruiter/conversations"]);
	assert.ok(result.ok);
	const [seen, never] = result.conversations;
	assert.deepEqual({ ...seen, last_seen_at: null }, { ...lucas, last_seen_at: null });
	// Vu il y a 30 s, quelle que soit l'heure du serveur : « En ligne »
	const age = Date.now() - Date.parse(seen.last_seen_at ?? "");
	assert.ok(age >= 30_000 && age <= 30_000 + (Date.now() - before), String(age));
	assert.equal(presenceState(seen.last_seen_at, Date.now()), "online");
	assert.equal(never.last_seen_at, null);
	assert.ok(!("seen_seconds_ago" in seen));
});

test("liste : session expirée, erreurs du serveur et du réseau", async () => {
	for (const [status, reason] of [[403, "noSession"], [401, "noSession"], [500, "server"], [404, "server"]] as const) {
		mockFetch(() => new Response(null, { status }));
		assert.deepEqual(await getRecruiterConversations(), { ok: false, reason });
	}
	mockFetch(() => new Response("<!doctype html>"));
	assert.deepEqual(await getRecruiterConversations(), { ok: false, reason: "server" });
	mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
	assert.deepEqual(await getRecruiterConversations(), { ok: false, reason: "network" });
});

test("présence de l'étudiant : une requête par minute, seulement quand l'onglet est visible", () => {
	const page = { visibilityState: "visible" };
	Object.defineProperty(globalThis, "document", { value: page, configurable: true });
	const urls = mockFetch(() => Response.json({}));
	mock.timers.enable({ apis: ["setInterval"] });
	const stop = startHeartbeat();

	mock.timers.tick(HEARTBEAT_DELAY - 1);
	assert.deepEqual(urls, []);
	mock.timers.tick(1);
	assert.deepEqual(urls, ["/api/me"]);

	// Onglet caché : l'étudiant passera « Hors ligne »
	page.visibilityState = "hidden";
	mock.timers.tick(HEARTBEAT_DELAY);
	assert.equal(urls.length, 1);

	// Page quittée : plus aucune requête
	page.visibilityState = "visible";
	stop();
	mock.timers.tick(HEARTBEAT_DELAY);
	assert.equal(urls.length, 1);
});

import { searchConversationRecipients, startRecruiterConversation } from "../front/services/recruiterConversations";

test("recherche des destinataires : transmet le nom et retourne les candidats autorisés", async () => {
	const urls = mockFetch(() => Response.json([
		{ id: 12, first_name: "Lucas", last_name: "Martin", has_conversation: false },
	]));
	const result = await searchConversationRecipients("Lucas Martin");
	assert.deepEqual(urls, ["/api/recruiter/conversation-recipients?q=Lucas+Martin"]);
	assert.deepEqual(result, {
		ok: true,
		recipients: [{ id: 12, first_name: "Lucas", last_name: "Martin", has_conversation: false }],
	});
});

test("recherche des destinataires : distingue session expirée, serveur et réseau", async () => {
	mockFetch(() => new Response(null, { status: 403 }));
	assert.deepEqual(await searchConversationRecipients("Lucas"), { ok: false, reason: "noSession" });
	mockFetch(() => new Response(null, { status: 500 }));
	assert.deepEqual(await searchConversationRecipients("Lucas"), { ok: false, reason: "server" });
	mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
	assert.deepEqual(await searchConversationRecipients("Lucas"), { ok: false, reason: "network" });
});

test("démarrage : récupère le CSRF et crée ou reprend une conversation", async () => {
	const urls: string[] = [];
	const bodies: string[] = [];
	globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
		urls.push(String(url));
		if (init?.body) bodies.push(String(init.body));
		if (String(url) === "/api/csrf") return Response.json({ csrfToken: "csrf-test" });
		assert.equal(init?.method, "POST");
		assert.equal((init?.headers as Record<string, string>)["X-CSRFToken"], "csrf-test");
		return Response.json({ id: 42, created: false, candidate: { id: 12, first_name: "Lucas", last_name: "Martin" } });
	}) as typeof fetch;
	assert.deepEqual(await startRecruiterConversation(12), { ok: true, id: 42, created: false });
	assert.deepEqual(urls, ["/api/csrf", "/api/recruiter/conversations"]);
	assert.deepEqual(bodies, ['{"candidate_id":12}']);
});
