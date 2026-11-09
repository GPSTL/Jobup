import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ThreadMessages } from "../front/components/MessageThread";
import { getMessages, sendMessage, type Message } from "../front/services/messages";
import { dayLabel, formatTime, groupByDay, mergeMessages } from "../front/utils/messages";

const realFetch = globalThis.fetch;

// Dates locales : les tests ne dépendent pas du fuseau de la machine
const at = (day: number, hour: number, minute = 0, month = 10, year = 2026) => new Date(year, month, day, hour, minute).toISOString();
const message = (id: number, created_at: string, from_me = false): Message => ({ id, body: `Message ${id}`, created_at, from_me });

type Call = { url: string; init?: RequestInit };

// Remplace fetch par une réponse simulée et garde la trace des appels
function mockFetch(respond: (url: string) => Response | Promise<Response>) {
	const calls: Call[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		return respond(url);
	}) as typeof fetch;
	return calls;
}

// Jeton CSRF puis réponse de l'envoi
const sendResponse = (response: () => Response) => (url: string) =>
	url === "/api/csrf" ? Response.json({ csrfToken: "jeton" }) : response();

afterEach(() => {
	globalThis.fetch = realFetch;
});

test("fil : derniers messages, historique et rafraîchissement", async () => {
	const messages = [message(4, at(3, 10)), message(5, at(3, 11), true)];
	const calls = mockFetch(() => Response.json({ messages, has_more: true }));
	assert.deepEqual(await getMessages(7), { ok: true, messages, hasMore: true });
	await getMessages(7, { before: 4 });
	await getMessages(7, { after: 5 });
	assert.deepEqual(calls.map((call) => call.url), [
		"/api/conversations/7/messages",
		"/api/conversations/7/messages?before=4",
		"/api/conversations/7/messages?after=5",
	]);
});

test("fil : conversation d'un autre, session expirée, erreurs", async () => {
	const cases = [[404, "notFound"], [403, "noSession"], [401, "noSession"], [500, "server"]] as const;
	for (const [status, reason] of cases) {
		mockFetch(() => new Response(null, { status }));
		assert.deepEqual(await getMessages(7), { ok: false, reason });
	}
	mockFetch(() => new Response("<!doctype html>"));
	assert.deepEqual(await getMessages(7), { ok: false, reason: "server" });
	mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
	assert.deepEqual(await getMessages(7), { ok: false, reason: "network" });
});

test("envoi : POST JSON avec jeton CSRF, le message renvoyé est celui du serveur", async () => {
	const saved = message(9, at(3, 12), true);
	const calls = mockFetch(sendResponse(() => Response.json(saved, { status: 201 })));
	assert.deepEqual(await sendMessage(7, "Bonjour"), { ok: true, message: saved });
	assert.deepEqual(calls.map((call) => call.url), ["/api/csrf", "/api/conversations/7/messages"]);
	assert.equal(calls[1].init?.method, "POST");
	assert.deepEqual(calls[1].init?.headers, { "Content-Type": "application/json", "X-CSRFToken": "jeton" });
	assert.equal(calls[1].init?.body, JSON.stringify({ body: "Bonjour" }));
});

test("envoi : chaque échec est signalé, jamais un faux succès", async () => {
	const cases = [[400, "invalid"], [403, "noSession"], [404, "notFound"], [500, "server"]] as const;
	for (const [status, reason] of cases) {
		mockFetch(sendResponse(() => new Response(null, { status })));
		assert.deepEqual(await sendMessage(7, "Bonjour"), { ok: false, reason });
	}
	mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
	assert.deepEqual(await sendMessage(7, "Bonjour"), { ok: false, reason: "network" });
	mockFetch(sendResponse(() => new Response("pas du JSON", { status: 201 })));
	assert.deepEqual(await sendMessage(7, "Bonjour"), { ok: false, reason: "server" });
});

test("fusion : ni perte ni doublon, dans l'ordre du serveur", () => {
	const shown = [message(3, at(3, 9)), message(4, at(3, 10))];
	// L'envoi a déjà affiché le 5 ; le rafraîchissement le renvoie avec le 6
	const afterSend = mergeMessages(shown, [message(5, at(3, 11), true)]);
	const afterRefresh = mergeMessages(afterSend, [message(5, at(3, 11), true), message(6, at(3, 12))]);
	assert.deepEqual(afterRefresh.map((m) => m.id), [3, 4, 5, 6]);
	// L'historique arrive avant les messages déjà affichés
	assert.deepEqual(mergeMessages(afterRefresh, [message(1, at(2, 9)), message(2, at(2, 10))]).map((m) => m.id), [1, 2, 3, 4, 5, 6]);
});

test("jours : aujourd'hui, hier, jour de la semaine, année si différente", () => {
	// Mardi 3 novembre 2026, 15 h
	const now = new Date(2026, 10, 3, 15, 0);
	assert.equal(dayLabel(at(3, 0, 5), now), "Aujourd’hui");
	assert.equal(dayLabel(at(2, 23, 59), now), "Hier");
	assert.equal(dayLabel(at(30, 8, 0, 9), now), "Vendredi 30 octobre");
	assert.equal(dayLabel(at(28, 8, 0, 11, 2025), now), "Dimanche 28 décembre 2025");
	assert.equal(formatTime(at(3, 9, 5)), "09:05");
});

test("groupes : un séparateur par jour, messages dans l'ordre", () => {
	const now = new Date(2026, 10, 3, 15, 0);
	const days = groupByDay([message(1, at(2, 9)), message(2, at(2, 18)), message(3, at(3, 8)), message(4, at(3, 9), true)], now);
	assert.deepEqual(days.map((day) => [day.label, day.messages.map((m) => m.id)]), [["Hier", [1, 2]], ["Aujourd’hui", [3, 4]]]);
	assert.deepEqual(groupByDay([], now), []);
});

test("rendu : pastille de date, heure d'envoi et auteur annoncé", () => {
	const now = new Date();
	const html = renderToStaticMarkup(
		<ThreadMessages days={groupByDay([message(1, now.toISOString()), message(2, now.toISOString(), true)], now)} name="Léa Martin – Acme" />,
	);
	assert.match(html, /Aujourd’hui/);
	assert.match(html, /<span class="sr-only">Léa Martin – Acme : <\/span>Message 1/);
	assert.match(html, /<span class="sr-only">Vous : <\/span>Message 2/);
	assert.match(html, new RegExp(`<time dateTime="${now.toISOString()}"[^>]*>${formatTime(now.toISOString())}</time>`));
	// Mes messages à droite en bleu, ceux de l'interlocuteur à gauche en gris (maquette)
	assert.match(html, /justify-end[^]*bg-\[#dcedfc\][^]*Message 2/);
});
