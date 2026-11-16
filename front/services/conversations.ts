// Appels à l'API de la messagerie (JOB-032). Le type ConversationSummary est le contrat partagé
// avec le fil de messages (JOB-034) et la liste côté recruteur (JOB-041).

export type Interlocutor = {
	/** "recruiter" : recruteur d'une entreprise ; "school" : employé d'une école */
	kind: "recruiter" | "school";
	first_name: string;
	last_name: string;
	/** Nom de l'entreprise ou de l'école */
	organization: string;
};

export type ConversationSummary = {
	id: number;
	interlocutor: Interlocutor;
	/** null pour une conversation sans message */
	last_message: {
		body: string;
		created_at: string;
		from_me: boolean;
		/** Nom du fichier joint au dernier message (JOB-043), dont le texte peut alors être vide */
		attachment: string | null;
	} | null;
	created_at: string;
};

export type ConversationsResult =
	| { ok: true; conversations: ConversationSummary[] }
	| { ok: false; reason: "noSession" | "server" | "network" };

// Conversations de l'étudiant connecté, la plus récemment active en premier
export async function getStudentConversations(query = ""): Promise<ConversationsResult> {
	const q = query.trim();
	let response: Response;
	try {
		response = await fetch(q ? `/api/student/conversations?q=${encodeURIComponent(q)}` : "/api/student/conversations", {
			credentials: "same-origin",
		});
	} catch {
		return { ok: false, reason: "network" };
	}

	// Session expirée ou compte non étudiant
	if (response.status === 401 || response.status === 403) return { ok: false, reason: "noSession" };
	if (!response.ok) return { ok: false, reason: "server" };
	try {
		return { ok: true, conversations: (await response.json()) as ConversationSummary[] };
	} catch {
		return { ok: false, reason: "server" };
	}
}
