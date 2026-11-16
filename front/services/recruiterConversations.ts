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
