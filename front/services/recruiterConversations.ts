// Conversations of the logged-in recruiter, with the presence of the candidates (JOB-039, REC-05).
// Contract with the back end: docs/api/recruiter-conversations.md

export type RecruiterConversation = {
	id: number;
	/** id: account id, as in /api/recruiter/candidates/<id>; the profile opens the conversation with ?candidate=<id> */
	candidate: { id: number; first_name: string; last_name: string };
	last_message: { body: string; created_at: string; from_me: boolean } | null;
	/** Last request of the candidate, in the clock of the browser. null = never seen. */
	last_seen_at: string | null;
};

// As sent by the API: an age rather than a date, so that the clock of the browser,
// which can differ from the server's one, does not matter
type ApiConversation = Omit<RecruiterConversation, "last_seen_at"> & { seen_seconds_ago: number | null };

export type RecruiterConversationsResult =
	| { ok: true; conversations: RecruiterConversation[] }
	| { ok: false; reason: "noSession" | "network" | "server" };

export async function getRecruiterConversations(): Promise<RecruiterConversationsResult> {
	let response: Response;
	try {
		response = await fetch("/api/recruiter/conversations", { credentials: "same-origin" });
	} catch {
		return { ok: false, reason: "network" };
	}
	if (response.status === 401 || response.status === 403) return { ok: false, reason: "noSession" };
	if (!response.ok) return { ok: false, reason: "server" };
	let items: ApiConversation[];
	try {
		items = await response.json();
	} catch {
		return { ok: false, reason: "server" };
	}
	const receivedAt = Date.now();
	return {
		ok: true,
		conversations: items.map(({ seen_seconds_ago, ...conversation }) => ({
			...conversation,
			last_seen_at: seen_seconds_ago === null ? null : new Date(receivedAt - seen_seconds_ago * 1000).toISOString(),
		})),
	};
}


export type ConversationRecipient = {
	id: number;
	first_name: string;
	last_name: string;
	has_conversation: boolean;
};

export type RecipientSearchResult =
	| { ok: true; recipients: ConversationRecipient[] }
	| { ok: false; reason: "noSession" | "network" | "server" };

export type StartConversationResult =
	| { ok: true; id: number; created: boolean }
	| { ok: false; reason: "noSession" | "notFound" | "network" | "server" };

export async function searchConversationRecipients(query: string, signal?: AbortSignal): Promise<RecipientSearchResult> {
	try {
		const params = new URLSearchParams({ q: query });
		const response = await fetch(`/api/recruiter/conversation-recipients?${params}`, {
			credentials: "same-origin",
			signal,
		});
		if (response.status === 401 || response.status === 403) return { ok: false, reason: "noSession" };
		if (!response.ok) return { ok: false, reason: "server" };
		return { ok: true, recipients: (await response.json()) as ConversationRecipient[] };
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") throw error;
		return { ok: false, reason: error instanceof TypeError ? "network" : "server" };
	}
}

export async function startRecruiterConversation(candidateId: number): Promise<StartConversationResult> {
	try {
		const csrf = await fetch("/api/csrf", { credentials: "same-origin" });
		if (!csrf.ok) return { ok: false, reason: "server" };
		const { csrfToken } = (await csrf.json()) as { csrfToken: string };
		const response = await fetch("/api/recruiter/conversations", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
			body: JSON.stringify({ candidate_id: candidateId }),
		});
		if (response.status === 401 || response.status === 403) return { ok: false, reason: "noSession" };
		if (response.status === 404) return { ok: false, reason: "notFound" };
		if (!response.ok) return { ok: false, reason: "server" };
		const data = (await response.json()) as { id: number; created: boolean };
		return { ok: true, id: data.id, created: data.created };
	} catch (error) {
		return { ok: false, reason: error instanceof TypeError ? "network" : "server" };
	}
}
