import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import NotificationBell, { NotificationPanelContent } from "../front/components/NotificationBell";
import NotificationList from "../front/components/NotificationList";
import NotificationSettings, { NotificationSettingsCard } from "../front/components/NotificationSettings";
import RecruiterAccountPage from "../front/pages/RecruiterAccountPage";
import {
	getNotifications,
	getPreferences,
	getUnreadCount,
	markAllRead,
	markRead,
	updatePreferences,
	type AppNotification,
} from "../front/services/notifications";
import { badgeLabel, bellLabel, kindIcon, relativeTime, ROLE_NOTIFICATIONS } from "../front/utils/notifications";

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

test("API : le compteur attend que la lecture soit enregistrée", async () => {
	// Ouvrir une notification change de page : la cloche de la nouvelle page ne doit pas relire l'ancien nombre
	let release = () => {};
	const saved = new Promise<void>((resolve) => (release = resolve));
	const calls = mockFetch(async (url) => {
		if (url === "/api/csrf") return Response.json({ csrfToken: "jeton" });
		if (url.endsWith("/read")) {
			await saved;
			return Response.json({ notification: notification(2, true), unread_count: 4 });
		}
		return Response.json({ unread_count: 4 });
	});
	const read = markRead(2);
	const count = getUnreadCount();
	await new Promise((resolve) => setTimeout(resolve, 20));
	assert.ok(!calls.some((call) => call.url === "/api/notifications/unread-count"));
	release();
	assert.deepEqual(await count, { ok: true, unreadCount: 4 });
	assert.deepEqual(await read, { ok: true, unreadCount: 4 });
	assert.deepEqual(
		calls.map((call) => call.url),
		["/api/csrf", "/api/notifications/2/read", "/api/notifications/unread-count"],
	);
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

// ----- Recruteur (JOB-046, REC-32) ----- //

const recruiterNotification = (id: number, kind: AppNotification["kind"]): AppNotification => ({
	...notification(id, false, "/recruiter/messages/3"),
	kind,
	title: kind === "new_application" ? "Nouvelle candidature" : "Nouveau message de Sarah Benali",
	body: kind === "new_application" ? "Lucas Martin a postulé à « Développeur Java en alternance »." : "« Je suis disponible jeudi. »",
});

const preferences = { messages: true, application_status: true, new_applications: false, email: true };

test("recruteur : icônes de la maquette « Notifications recruteur »", () => {
	assert.deepEqual(kindIcon("new_application", "recruiter"), { src: "/static/img/notifications/user-plus.svg", background: "bg-[#dbeafe]" });
	// Le bleu est réservé aux candidatures : les messages du recruteur sont en violet, ceux de l'étudiant restent bleus
	assert.deepEqual(kindIcon("message", "recruiter"), { src: "/static/img/notifications/message-violet.svg", background: "bg-[#ede7fe]" });
	assert.equal(kindIcon("message").src, "/static/img/notifications/message.svg");
	assert.equal(kindIcon("contract", "recruiter").src, "/static/img/notifications/mail.svg");

	const html = render(<NotificationList notifications={[recruiterNotification(1, "new_application"), recruiterNotification(2, "message")]} onOpen={() => {}} role="recruiter" />);
	const [application, message] = html.split("</li>");
	assert.match(application, /user-plus\.svg/);
	assert.match(application, />Lucas Martin a postulé à « Développeur Java en alternance »\.</);
	assert.match(message, /message-violet\.svg/);
	assert.match(message, /href="\/recruiter\/messages\/3"/);
});

test("recruteur : les liens du panneau mènent à ses pages", () => {
	const html = render(<NotificationBell role="recruiter" />);
	assert.match(html, /href="\/recruiter\/notifications"[^>]*>Voir toutes les notifications<\/a>/);
	assert.match(html, /href="\/recruiter\/account#notifications"/);
	assert.doesNotMatch(html, /href="\/student/);
});

test("panneau : chargement, erreur, aucune notification, puis la liste", () => {
	const props = { onRetry: () => {}, onOpen: () => {}, role: "recruiter" as const };
	assert.match(render(<NotificationPanelContent notifications={null} error="" {...props} />), /role="status"[^>]*>Chargement des notifications…/);
	const error = render(<NotificationPanelContent notifications={null} error="Le serveur ne répond pas." {...props} />);
	assert.match(error, /role="alert"/);
	assert.match(error, /Le serveur ne répond pas\./);
	assert.match(error, />Réessayer<\/button>/);
	assert.doesNotMatch(error, /Chargement/);
	assert.match(render(<NotificationPanelContent notifications={[]} error="" {...props} />), />Aucune notification pour l’instant\.</);
	assert.match(render(<NotificationPanelContent notifications={[recruiterNotification(1, "new_application")]} error="" {...props} />), /Nouvelle candidature/);
});

test("recruteur : interrupteurs de « Mon espace » dans l'ordre de la maquette", () => {
	assert.deepEqual(
		ROLE_NOTIFICATIONS.recruiter.settings.map(({ label }) => label),
		["Nouvelles candidatures", "Nouveaux messages", "Recevoir aussi par e-mail"],
	);
	const card = (extra: Partial<Parameters<typeof NotificationSettingsCard>[0]>) =>
		render(<NotificationSettingsCard role="recruiter" preferences={preferences} loadError="" saveError="" saving={null} onToggle={() => {}} onRetry={() => {}} {...extra} />);

	const html = card({});
	const switches = [...html.matchAll(/<span id="notification-(\w+)"[^>]*>([^<]+)<\/span><button[^>]*role="switch" aria-checked="(\w+)"/g)];
	assert.deepEqual(
		switches.map(([, key, label, checked]) => [key, label, checked]),
		[
			["new_applications", "Nouvelles candidatures", "false"],
			["messages", "Nouveaux messages", "true"],
			["email", "Recevoir aussi par e-mail", "true"],
		],
	);
	// Le changement de statut est une préférence de l'étudiant
	assert.doesNotMatch(html, /Changement de statut/);

	const failed = card({ preferences: null, loadError: "Le serveur ne répond pas." });
	assert.match(failed, /role="alert"[^>]*><p>Le serveur ne répond pas\.<\/p>/);
	assert.match(failed, />Réessayer<\/button>/);
	assert.doesNotMatch(failed, /role="switch"/);
	assert.match(card({ saveError: "La préférence n’a pas été enregistrée." }), /role="alert"[^>]*>La préférence n’a pas été enregistrée\.</);
});

test("recruteur : « Préférences e-mail » ouvre l'onglet « Compte et abonnement » de « Mon espace » et son bloc « Notifications »", () => {
	const at = (url: string) =>
		renderToStaticMarkup(
			<MemoryRouter initialEntries={[url]}>
				<RecruiterAccountPage />
			</MemoryRouter>,
		);
	for (const url of ["/recruiter/account#notifications", "/recruiter/account#compte"]) {
		const html = at(url);
		assert.match(html, /<a [^>]*aria-current="page"[^>]*>Compte et abonnement<\/a>/, url);
		assert.match(html, /<section [^>]*id="notifications"/, url);
		assert.doesNotMatch(html, /Chargement de votre page entreprise/, url);
	}
	// Sans ancre : la page entreprise de JOB-066, comme avant
	const company = at("/recruiter/account");
	assert.match(company, /<a [^>]*aria-current="page"[^>]*>Page entreprise<\/a>/);
	assert.match(company, /href="\/recruiter\/account#compte"/);
	assert.match(company, /Chargement de votre page entreprise/);
	assert.doesNotMatch(company, /id="notifications"/);
	// La cloche de la barre est celle des notifications du recruteur
	assert.match(company, /href="\/recruiter\/notifications"/);
});
