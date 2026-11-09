// Calls to the recruiter candidates API (JOB-035, REC-01). Contract: docs/api/candidates.md

/** Card of the "Candidats" tab */
export type CandidateSummary = {
	/** Account id of the student */
	id: number;
	first_name: string;
	last_name: string;
	/** URL of the photo of the profile (JOB-008); null when the student has none */
	photo_url: string | null;
	/** Program followed, e.g. "Master MIAGE": always null for now, no screen asks the student for it */
	education: string | null;
	/** Name of the school; null when not filled in */
	school: string | null;
	/** Personal presentation; "" when not written yet */
	description: string;
	/** Download route that checks the recruiter's rights, never a public file URL; null when there is no CV */
	cv_url: string | null;
};

/** Line of the exchange history: an application received or a message of the conversation (id of the JobApplication or of the Message) */
export type Exchange =
	| { kind: "application"; id: number; date: string; offer_title: string }
	// TODO JOB-039: sent by the API once the messages of JOB-032 are on main
	| { kind: "message"; id: number; date: string; from_me: boolean; body: string };

/** Full profile ("Profil du candidat" screen) */
export type Candidate = CandidateSummary & {
	/** e.g. "Paris" */
	region: string;
	/** Value of StudyDegree in jobup/models.py (1 to 5 for BAC+1 to BAC+5); null when not filled in */
	study_degree: number | null;
	/** Start of availability, date without time ("2026-11-02"); null when not filled in */
	available_from: string | null;
	skills: string[];
	/** Always empty for now: the Student model only stores a number of months */
	experiences: { title: string; details: string }[];
	/** Exchanges with the logged-in recruiter only, never those with other recruiters; oldest first */
	exchanges: Exchange[];
};

export type CandidatesError = "unauthenticated" | "server" | "network";

export type CandidatesResult = { ok: true; candidates: CandidateSummary[] } | { ok: false; reason: CandidatesError };

export type CandidateResult =
	| { ok: true; candidate: Candidate }
	// "notFound" also for an inactive student, or an account that is not a student
	| { ok: false; reason: CandidatesError | "notFound" };

type Answer<T> = { ok: true; data: T } | { ok: false; reason: CandidatesError | "notFound" };

// GET shared by the two routes
async function getJson<T>(url: string): Promise<Answer<T>> {
	let response: Response;
	try {
		response = await fetch(url, { credentials: "same-origin" });
	} catch {
		// Server unreachable or connection lost
		return { ok: false, reason: "network" };
	}

	// Without a session, DRF answers 403; RequireRecruiter has already turned away the other roles
	if (response.status === 401 || response.status === 403) return { ok: false, reason: "unauthenticated" };
	if (response.status === 404) return { ok: false, reason: "notFound" };
	if (!response.ok) return { ok: false, reason: "server" };
	try {
		return { ok: true, data: (await response.json()) as T };
	} catch {
		// Not a JSON answer: the API is not available on this server
		return { ok: false, reason: "server" };
	}
}

// Candidates the logged-in recruiter may see, in the order of the cards
export async function getCandidates(): Promise<CandidatesResult> {
	const answer = await getJson<CandidateSummary[]>("/api/recruiter/candidates");
	if (answer.ok) return { ok: true, candidates: answer.data };
	// The list route always exists: a 404 means the server is not the expected one
	return { ok: false, reason: answer.reason === "notFound" ? "server" : answer.reason };
}

export async function getCandidate(id: number): Promise<CandidateResult> {
	const answer = await getJson<Candidate>(`/api/recruiter/candidates/${id}`);
	return answer.ok ? { ok: true, candidate: answer.data } : answer;
}

// ----- Présélection (JOB-037, REC-03) -----

/** Candidat retenu avec ♥ (écran « Candidats retenus ») */
export type ShortlistedCandidate = CandidateSummary & {
	/** Date du ♥, ISO 8601 */
	shortlisted_at: string;
	/** Offre pour laquelle il est retenu (« Pour : … ») ; toujours null tant que JOB-036 ne permet pas de la choisir */
	offer: { id: number; title: string } | null;
};

export type ShortlistResult = { ok: true; candidates: ShortlistedCandidate[] } | { ok: false; reason: CandidatesError };

export type ShortlistActionResult = { ok: true } | { ok: false; reason: CandidatesError | "notFound" };

// Candidats retenus par le recruteur connecté, le plus récent en premier
export async function getShortlist(): Promise<ShortlistResult> {
	const answer = await getJson<ShortlistedCandidate[]>("/api/recruiter/shortlist");
	if (answer.ok) return { ok: true, candidates: answer.data };
	return { ok: false, reason: answer.reason === "notFound" ? "server" : answer.reason };
}

// Écritures sur un candidat (♥, « Retirer », 🚫) : avec le jeton CSRF de /api/csrf
async function writeCandidate(path: string, method: "POST" | "DELETE"): Promise<ShortlistActionResult> {
	let response: Response;
	try {
		const csrf = await fetch("/api/csrf", { credentials: "same-origin" });
		if (!csrf.ok) return { ok: false, reason: "server" };
		const { csrfToken } = await csrf.json();
		response = await fetch(`/api/recruiter/candidates/${path}`, {
			method,
			credentials: "same-origin",
			headers: { "X-CSRFToken": csrfToken },
		});
	} catch (error) {
		// Réponse de /api/csrf qui n'est pas du JSON : l'API n'est pas disponible sur ce serveur
		return { ok: false, reason: error instanceof TypeError ? "network" : "server" };
	}

	if (response.status === 401 || response.status === 403) return { ok: false, reason: "unauthenticated" };
	// Candidat désactivé entre-temps
	if (response.status === 404) return { ok: false, reason: "notFound" };
	return response.ok ? { ok: true } : { ok: false, reason: "server" };
}

export const keepCandidate = (id: number) => writeCandidate(`${id}/shortlist`, "POST");

export const removeFromShortlist = (id: number) => writeCandidate(`${id}/shortlist`, "DELETE");

// ----- Exclusion (JOB-038, REC-04) -----

// 🚫 : le candidat quitte les cartes de ce recruteur. Répéter l'appel est sans effet : un nouvel essai est toujours permis
export const excludeCandidate = (id: number) => writeCandidate(`${id}/exclusion`, "POST");
