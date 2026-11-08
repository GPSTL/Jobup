// Appels à l'API du fil de messages (JOB-034, ETU-15). Contrat commun avec JOB-039 :
//   GET  /api/conversations/<id>/messages              derniers messages, du plus ancien au plus récent
//   GET  /api/conversations/<id>/messages?before=<id>  page précédente de l'historique
//   GET  /api/conversations/<id>/messages?after=<id>   messages arrivés depuis (rafraîchissement)
//   POST /api/conversations/<id>/messages {"body"}     201 et le message enregistré par le serveur
// Les GET renvoient { messages, has_more }. 404 quand l'utilisateur ne participe pas à la conversation.

export type Message = {
	id: number;
	body: string;
	/** Horodatage du serveur */
	created_at: string;
	/** Vrai pour les messages de l'utilisateur connecté */
	from_me: boolean;
};

export type MessagesResult =
	| { ok: true; messages: Message[]; hasMore: boolean }
	| { ok: false; reason: "noSession" | "notFound" | "server" | "network" };

export type SendResult =
	| { ok: true; message: Message }
	| { ok: false; reason: "noSession" | "notFound" | "invalid" | "server" | "network" };

type Cursor = { before: number } | { after: number };

export async function getMessages(conversationId: number, cursor?: Cursor): Promise<MessagesResult> {
	const query = cursor === undefined ? "" : "before" in cursor ? `?before=${cursor.before}` : `?after=${cursor.after}`;
	let response: Response;
	try {
		response = await fetch(`/api/conversations/${conversationId}/messages${query}`, { credentials: "same-origin" });
	} catch {
		return { ok: false, reason: "network" };
	}

	// Session expirée ou compte non autorisé
	if (response.status === 401 || response.status === 403) return { ok: false, reason: "noSession" };
	if (response.status === 404) return { ok: false, reason: "notFound" };
	if (!response.ok) return { ok: false, reason: "server" };
	try {
		const { messages, has_more } = await response.json();
		return { ok: true, messages, hasMore: has_more };
	} catch {
		return { ok: false, reason: "server" };
	}
}

// Le message n'est considéré comme envoyé qu'une fois enregistré par le serveur
export async function sendMessage(conversationId: number, body: string): Promise<SendResult> {
	try {
		const csrf = await fetch("/api/csrf", { credentials: "same-origin" });
		if (!csrf.ok) return { ok: false, reason: "server" };
		const { csrfToken } = await csrf.json();
		const response = await fetch(`/api/conversations/${conversationId}/messages`, {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
			body: JSON.stringify({ body }),
		});
		if (response.status === 401 || response.status === 403) return { ok: false, reason: "noSession" };
		if (response.status === 404) return { ok: false, reason: "notFound" };
		if (response.status === 400) return { ok: false, reason: "invalid" };
		if (!response.ok) return { ok: false, reason: "server" };
		return { ok: true, message: (await response.json()) as Message };
	} catch (error) {
		return { ok: false, reason: error instanceof TypeError ? "network" : "server" };
	}
}
