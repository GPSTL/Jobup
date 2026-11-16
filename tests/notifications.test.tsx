import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import NotificationBell from "../front/components/NotificationBell";
import NotificationList from "../front/components/NotificationList";
import NotificationSettings from "../front/components/NotificationSettings";
import {
	getNotifications,
	getPreferences,
	getUnreadCount,
	markAllRead,
	markRead,
	updatePreferences,
	type AppNotification,
} from "../front/services/notifications";
import { badgeLabel, bellLabel, kindIcon, relativeTime } from "../front/utils/notifications";

const realFetch = globalThis.fetch;

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

// Jeton CSRF des écritures, puis la réponse de l'API
const withCsrf = (response: () => Response) => (url: string) => (url === "/api/csrf" ? Response.json({ csrfToken: "jeton" }) : response());

afterEach(() => {
	globalThis.fetch = realFetch;
});

const notification = (id: number, read: boolean, link = "/messages/3"): AppNotification => ({
	id,
	kind: "message",
	title: "Nouveau message de Léa Martin – Acme",
	body: "« Seriez-vous disponible mardi ? »",
	link,
	created_at: new Date(2026, 10, 16, 10, 0).toISOString(),
	read,
});

const render = (element: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);

test("heure relative comme la maquette, à l'heure locale", () => {
	const now = new Date(2026, 10, 16, 15, 0);
	assert.equal(relativeTime(new Date(2026, 10, 16, 14, 59, 30).toISOString(), now), "À l’instant");
	assert.equal(relativeTime(new Date(2026, 10, 16, 14, 55).toISOString(), now), "Il y a 5 min");
	assert.equal(relativeTime(new Date(2026, 10, 16, 13, 0).toISOString(), now), "Il y a 2 h");
	assert.equal(relativeTime(new Date(2026, 10, 15, 23, 30).toISOString(), now), "Hier");
	assert.equal(relativeTime(new Date(2026, 9, 15, 9, 0).toISOString(), now), "15 oct.");
	assert.equal(relativeTime(new Date(2025, 11, 31, 9, 0).toISOString(), now), "31 déc. 2025");
});

test("pastille, nom accessible de la cloche et icônes", () => {
	assert.equal(badgeLabel(3), "3");
	assert.equal(badgeLabel(12), "9+");
	assert.equal(bellLabel(0), "Notifications");
	assert.equal(bellLabel(1), "Notifications, 1 non lue");
	assert.equal(bellLabel(3), "Notifications, 3 non lues");
	assert.equal(kindIcon("application_accepted").src, "/static/img/notifications/check.svg");
	// Type ajouté plus tard par une autre story : icône générique plutôt qu'une erreur
	assert.equal(kindIcon("contract").src, "/static/img/notifications/mail.svg");
});

test("API : liste, page précédente et nombre de non lues", async () => {
	const calls = mockFetch(() => Response.json({ notifications: [notification(2, false)], has_more: true, unread_count: 4 }));
	assert.deepEqual(await getNotifications(), { ok: true, notifications: [notification(2, false)], hasMore: true, unreadCount: 4 });
	await getNotifications(2);
	assert.deepEqual(calls.map((call) => call.url), ["/api/notifications", "/api/notifications?before=2"]);

	mockFetch(() => Response.json({ unread_count: 7 }));
	assert.deepEqual(await getUnreadCount(), { ok: true, unreadCount: 7 });
});

test("API : marquer comme lu, avec le jeton CSRF", async () => {
	const calls = mockFetch(withCsrf(() => Response.json({ notification: notification(2, true), unread_count: 3 })));
	assert.deepEqual(await markRead(2), { ok: true, unreadCount: 3 });
	assert.deepEqual(calls.map((call) => call.url), ["/api/csrf", "/api/notifications/2/read"]);
	assert.equal(calls[1].init?.method, "POST");
	assert.deepEqual(calls[1].init?.headers, { "X-CSRFToken": "jeton" });

	mockFetch(withCsrf(() => Response.json({ unread_count: 0 })));
	assert.deepEqual(await markAllRead(), { ok: true, unreadCount: 0 });
	// Notification d'un autre utilisateur : introuvable
	mockFetch(withCsrf(() => new Response(null, { status: 404 })));
	assert.deepEqual(await markRead(99), { ok: false, reason: "notFound" });
});

test("API : préférences lues puis modifiées une à une", async () => {
	const preferences = { messages: true, application_status: true, email: false };
	mockFetch(() => Response.json(preferences));
	assert.deepEqual(await getPreferences(), { ok: true, preferences });

	const calls = mockFetch(withCsrf(() => Response.json({ ...preferences, email: true })));
	assert.deepEqual(await updatePreferences({ email: true }), { ok: true, preferences: { ...preferences, email: true } });
	assert.equal(calls[1].init?.method, "PUT");
	assert.deepEqual(calls[1].init?.headers, { "X-CSRFToken": "jeton", "Content-Type": "application/json" });
	assert.equal(calls[1].init?.body, JSON.stringify({ email: true }));

	mockFetch(withCsrf(() => new Response(null, { status: 400 })));
	assert.deepEqual(await updatePreferences({ email: true }), { ok: false, reason: "invalid" });
});

test("API : session expirée, erreurs du serveur et du réseau", async () => {
	mockFetch(() => new Response(null, { status: 403 }));
	assert.deepEqual(await getUnreadCount(), { ok: false, reason: "unauthenticated" });
	mockFetch(() => new Response(null, { status: 500 }));
	assert.deepEqual(await getNotifications(), { ok: false, reason: "server" });
	mockFetch(() => new Response("<!doctype html>"));
	assert.deepEqual(await getPreferences(), { ok: false, reason: "server" });
	mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
	assert.deepEqual(await getUnreadCount(), { ok: false, reason: "network" });
	assert.deepEqual(await markAllRead(), { ok: false, reason: "network" });
});

test("liste : non lue mise en avant et annoncée, lien vers la ressource", () => {
	const html = render(<NotificationList notifications={[notification(1, false), notification(2, true, "")]} onOpen={() => {}} now={new Date(2026, 10, 16, 10, 5)} />);
	const [unread, read] = html.split("</li>");
	assert.match(unread, /<a [^>]*href="\/messages\/3"/);
	assert.match(unread, /<span class="sr-only">Non lue : <\/span>Nouveau message de Léa Martin – Acme/);
	assert.match(unread, /unread\.svg/);
	assert.match(unread, /bg-\[#f6faff\]/);
	assert.match(unread, />Il y a 5 min<\/time>/);
	// Lue et sans lien : un bouton, sans pastille
	assert.match(read, /<button type="button"/);
	assert.doesNotMatch(read, /unread\.svg|Non lue/);
});

test("cloche : nom accessible et panneau fermé au départ", () => {
	const html = render(<NotificationBell />);
	assert.match(html, /<button[^>]*aria-expanded="false"[^>]*aria-label="Notifications"/);
	assert.match(html, /<div [^>]*role="region" aria-label="Notifications" hidden=""/);
	assert.match(html, /href="\/notifications"[^>]*>Voir toutes les notifications<\/a>/);
	assert.match(html, /href="\/student#notifications"/);
});

test("préférences : section repérable et chargement annoncé", () => {
	const html = render(<NotificationSettings />);
	assert.match(html, /<section [^>]*id="notifications"/);
	assert.match(html, /<h2 id="notification-settings"[^>]*>Notifications<\/h2>/);
	assert.match(html, /role="status"[^>]*>Chargement de vos préférences…/);
});
