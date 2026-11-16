// Appels à l'API des notifications (JOB-042, ETU-28), commune à tous les rôles. Contrat : docs/api/notifications.md
//   GET  /api/notifications                  les plus récentes, avec le nombre de non lues
//   GET  /api/notifications?before=<id>      les précédentes
//   GET  /api/notifications/unread-count     pour la pastille de la barre de navigation
//   POST /api/notifications/<id>/read        marquer une notification comme lue
//   POST /api/notifications/read-all         tout marquer comme lu
//   GET  /api/notifications/preferences      préférences de l'utilisateur
//   PUT  /api/notifications/preferences      les modifier (seuls les champs envoyés changent)

export type NotificationKind = "message" | "application_update" | "application_accepted" | "application_refused";

export type AppNotification = {
	id: number;
	kind: NotificationKind;
	title: string;
	body: string;
	/** Page de l'application à ouvrir, ex. /messages/3 ; "" s'il n'y en a pas */
	link: string;
	created_at: string;
	read: boolean;
};

export type NotificationPreferences = {
	/** Notification à chaque nouveau message */
	messages: boolean;
	/** Notification à chaque changement de statut d'une candidature */
	application_status: boolean;
	/** E-mail en plus de la notification dans l'application */
	email: boolean;
};

export type NotificationsError = "unauthenticated" | "server" | "network";

export type NotificationsResult =
	| { ok: true; notifications: AppNotification[]; hasMore: boolean; unreadCount: number }
	| { ok: false; reason: NotificationsError };

export type CountResult = { ok: true; unreadCount: number } | { ok: false; reason: NotificationsError };

export type ReadResult = { ok: true; unreadCount: number } | { ok: false; reason: NotificationsError | "notFound" };

export type PreferencesResult = { ok: true; preferences: NotificationPreferences } | { ok: false; reason: NotificationsError | "invalid" };

type Answer = { ok: true; data: unknown } | { ok: false; reason: NotificationsError | "notFound" | "invalid" };

// Appel commun : les écritures envoient le jeton CSRF de /api/csrf
async function call(url: string, method: "GET" | "POST" | "PUT" = "GET", body?: object): Promise<Answer> {
	let response: Response;
	try {
		const headers: Record<string, string> = {};
		if (method !== "GET") {
			const csrf = await fetch("/api/csrf", { credentials: "same-origin" });
			if (!csrf.ok) return { ok: false, reason: "server" };
			headers["X-CSRFToken"] = (await csrf.json()).csrfToken;
		}
		if (body) headers["Content-Type"] = "application/json";
		response = await fetch(url, { method, credentials: "same-origin", headers, body: body && JSON.stringify(body) });
	} catch (error) {
		return { ok: false, reason: error instanceof TypeError ? "network" : "server" };
	}

	// Sans session, DRF répond 403
	if (response.status === 401 || response.status === 403) return { ok: false, reason: "unauthenticated" };
	if (response.status === 404) return { ok: false, reason: "notFound" };
	if (response.status === 400) return { ok: false, reason: "invalid" };
	if (!response.ok) return { ok: false, reason: "server" };
	try {
		return { ok: true, data: await response.json() };
	} catch {
		return { ok: false, reason: "server" };
	}
}

// Les routes de lecture existent toujours : un 404 ou un 400 veut dire que le serveur n'est pas celui attendu
const asServerError = (reason: NotificationsError | "notFound" | "invalid"): NotificationsError =>
	reason === "notFound" || reason === "invalid" ? "server" : reason;

export async function getNotifications(before?: number): Promise<NotificationsResult> {
	const answer = await call(before === undefined ? "/api/notifications" : `/api/notifications?before=${before}`);
	if (!answer.ok) return { ok: false, reason: asServerError(answer.reason) };
	const data = answer.data as { notifications: AppNotification[]; has_more: boolean; unread_count: number };
	return { ok: true, notifications: data.notifications, hasMore: data.has_more, unreadCount: data.unread_count };
}

export async function getUnreadCount(): Promise<CountResult> {
	const answer = await call("/api/notifications/unread-count");
	if (!answer.ok) return { ok: false, reason: asServerError(answer.reason) };
	return { ok: true, unreadCount: (answer.data as { unread_count: number }).unread_count };
}

export async function markRead(id: number): Promise<ReadResult> {
	const answer = await call(`/api/notifications/${id}/read`, "POST");
	if (!answer.ok) return { ok: false, reason: answer.reason === "invalid" ? "server" : answer.reason };
	return { ok: true, unreadCount: (answer.data as { unread_count: number }).unread_count };
}

export async function markAllRead(): Promise<CountResult> {
	const answer = await call("/api/notifications/read-all", "POST");
	if (!answer.ok) return { ok: false, reason: asServerError(answer.reason) };
	return { ok: true, unreadCount: 0 };
}

export async function getPreferences(): Promise<PreferencesResult> {
	const answer = await call("/api/notifications/preferences");
	if (!answer.ok) return { ok: false, reason: asServerError(answer.reason) };
	return { ok: true, preferences: answer.data as NotificationPreferences };
}

export async function updatePreferences(changes: Partial<NotificationPreferences>): Promise<PreferencesResult> {
	const answer = await call("/api/notifications/preferences", "PUT", changes);
	if (!answer.ok) return { ok: false, reason: answer.reason === "notFound" ? "server" : answer.reason };
	return { ok: true, preferences: answer.data as NotificationPreferences };
}
