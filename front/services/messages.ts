// Appels à l'API du fil de messages (JOB-034, ETU-15). Contrat commun avec JOB-039 :
//   GET  /api/conversations/<id>/messages              derniers messages, du plus ancien au plus récent
//   GET  /api/conversations/<id>/messages?before=<id>  page précédente de l'historique
//   GET  /api/conversations/<id>/messages?after=<id>   messages arrivés depuis (rafraîchissement)
//   POST /api/conversations/<id>/messages {"body"}     201 et le message enregistré par le serveur
// Les GET renvoient { messages, has_more }. 404 quand l'utilisateur ne participe pas à la conversation.
// Pièce jointe (JOB-043, REC-14) : le recruteur envoie le même POST en multipart (body et file).
// Contrat : docs/api/message_attachments.md
//   GET  /api/conversations/<id>/messages/<message>/attachment   le fichier, à télécharger

export type MessageAttachment = {
	name: string;
	/** Octets */
	size: number;
	/** « pdf », « doc » ou « docx » */
	extension: string;
	/** Adresse de téléchargement, contrôlée par le serveur */
	url: string;
};

export type Message = {
	id: number;
	body: string;
	/** Horodatage du serveur */
	created_at: string;
	/** Vrai pour les messages de l'utilisateur connecté */
	from_me: boolean;
	attachment: MessageAttachment | null;
};

export type MessagesResult =
	| { ok: true; messages: Message[]; hasMore: boolean }
	| { ok: false; reason: "noSession" | "notFound" | "server" | "network" };

export type SendResult =
	| { ok: true; message: Message }
	| { ok: false; reason: "noSession" | "notFound" | "invalid" | "server" | "network"; message?: string };

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

// Message d'erreur du serveur à afficher tel quel : le refus du fichier ou l'échec de son enregistrement
async function fileError(response: Response): Promise<string | undefined> {
	try {
		const { errors } = await response.json();
		return typeof errors?.file === "string" ? errors.file : undefined;
	} catch {
		return undefined;
	}
}

// Le message n'est considéré comme envoyé qu'une fois enregistré par le serveur.
// Avec un fichier (recruteur), le texte peut être vide.
export async function sendMessage(conversationId: number, body: string, file?: File): Promise<SendResult> {
	try {
		const csrf = await fetch("/api/csrf", { credentials: "same-origin" });
		if (!csrf.ok) return { ok: false, reason: "server" };
		const { csrfToken } = await csrf.json();
		const headers: Record<string, string> = { "X-CSRFToken": csrfToken };
		let content: string | FormData;
		if (file === undefined) {
			headers["Content-Type"] = "application/json";
			content = JSON.stringify({ body });
		} else {
			// Pas de Content-Type : le navigateur ajoute le séparateur du multipart
			content = new FormData();
			content.append("body", body);
			content.append("file", file);
		}
		const response = await fetch(`/api/conversations/${conversationId}/messages`, {
			method: "POST",
			credentials: "same-origin",
			headers,
			body: content,
		});
		if (response.status === 401 || response.status === 403) return { ok: false, reason: "noSession" };
		if (response.status === 404) return { ok: false, reason: "notFound" };
		// Fichier refusé (format, taille) : le serveur dit pourquoi
		if (response.status === 400 || response.status === 413) {
			const message = file === undefined ? undefined : await fileError(response);
			return message === undefined ? { ok: false, reason: "invalid" } : { ok: false, reason: "invalid", message };
		}
		if (!response.ok) {
			// Échec de l'enregistrement du fichier : le serveur le dit aussi
			const message = file === undefined ? undefined : await fileError(response);
			return message === undefined ? { ok: false, reason: "server" } : { ok: false, reason: "server", message };
		}
		return { ok: true, message: (await response.json()) as Message };
	} catch (error) {
		return { ok: false, reason: error instanceof TypeError ? "network" : "server" };
	}
}
