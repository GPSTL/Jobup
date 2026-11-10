// Frontend integration contract proposed for JOB-041/JOB-039; backend endpoint pending.
export type RecruiterConversation = {
	id: number;
	/** id: account id, as in /api/recruiter/candidates/<id>; the profile opens the conversation with ?candidate=<id> */
	candidate: { id: number; first_name: string; last_name: string };
	last_message: { body: string; created_at: string; from_me: boolean } | null;
	/** Server-observed activity, not last_login. null = presence unknown. */
	last_seen_at: string | null;
};

export async function getRecruiterConversations(): Promise<
	{ ok: true; conversations: RecruiterConversation[] } |
	{ ok: false; reason: "noSession" | "unavailable" | "network" | "server" }
> {
	try {
		const response = await fetch("/api/recruiter/conversations", { credentials: "same-origin" });
		if (response.status === 401 || response.status === 403) return { ok: false, reason: "noSession" };
		if (response.status === 404) return { ok: false, reason: "unavailable" };
		if (!response.ok) return { ok: false, reason: "server" };
		return { ok: true, conversations: await response.json() as RecruiterConversation[] };
	} catch {
		return { ok: false, reason: "network" };
	}
}
