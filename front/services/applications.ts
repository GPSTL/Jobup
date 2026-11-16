// Appels à l'API de suivi des candidatures (JOB-033, ETU-14).

export type ApplicationSummary = {
	id: number;
	offer: { id: number; title: string };
	company: string;
	/** Valeur de ApplicationStatus dans jobup/models.py (voir STATUS dans utils/applications) */
	status: number;
	status_label: string;
	/** null tant que la candidature est un brouillon */
	submitted_at: string | null;
	updated_at: string;
};

export type ApplicationDetail = ApplicationSummary & {
	message: string;
	/** URL de téléchargement, null quand le document n'existe pas */
	documents: { resume: string | null; cover_letter: string | null };
};

export type ApplicationsResult =
	| { ok: true; inProgress: ApplicationSummary[]; completed: ApplicationSummary[] }
	| { ok: false; reason: "noSession" | "server" | "network" };

export type ApplicationResult =
	| { ok: true; application: ApplicationDetail }
	| { ok: false; reason: "noSession" | "notFound" | "server" | "network" };

export type SaveDraftResult =
	| { ok: true; application: ApplicationDetail }
	| { ok: false; reason: "noSession" | "alreadySubmitted" | "invalid" | "server" | "network" };

export type SubmitResult =
	| { ok: true; application: ApplicationDetail }
	| { ok: false; reason: "noSession" | "alreadySubmitted" | "noResume" | "invalid" | "server" | "network" };

// Jeton exigé par Django pour les requêtes qui modifient des données
async function getCsrfToken(): Promise<string | null> {
	const response = await fetch("/api/csrf", { credentials: "same-origin" });
	if (!response.ok) return null;
	return (await response.json()).csrfToken;
}

// Candidatures de l'étudiant connecté, déjà réparties entre les deux colonnes par le backend
export async function getApplications(): Promise<ApplicationsResult> {
	let response: Response;
	try {
		response = await fetch("/api/applications", { credentials: "same-origin" });
	} catch {
		return { ok: false, reason: "network" };
	}

	// Session expirée ou compte non étudiant
	if (response.status === 401 || response.status === 403) return { ok: false, reason: "noSession" };
	if (!response.ok) return { ok: false, reason: "server" };
	try {
		const { in_progress, completed } = await response.json();
		return { ok: true, inProgress: in_progress, completed };
	} catch {
		return { ok: false, reason: "server" };
	}
}

export async function getApplication(id: number): Promise<ApplicationResult> {
	let response: Response;
	try {
		response = await fetch(`/api/applications/${id}`, { credentials: "same-origin" });
	} catch {
		return { ok: false, reason: "network" };
	}

	if (response.status === 401 || response.status === 403) return { ok: false, reason: "noSession" };
	// Le backend répond aussi 404 pour la candidature d'un autre étudiant
	if (response.status === 404) return { ok: false, reason: "notFound" };
	if (!response.ok) return { ok: false, reason: "server" };
	try {
		return { ok: true, application: (await response.json()) as ApplicationDetail };
	} catch {
		return { ok: false, reason: "server" };
	}
}

// Enregistre le brouillon sans l'envoyer. Sans nouvelle lettre, celle déjà enregistrée est conservée.
export async function saveDraft(offerId: number, message: string, coverLetter?: File): Promise<SaveDraftResult> {
	const body = new FormData();
	body.append("offer", String(offerId));
	body.append("message", message);
	if (coverLetter) body.append("cover_letter", coverLetter);

	try {
		const csrfToken = await getCsrfToken();
		if (!csrfToken) return { ok: false, reason: "server" };
		// Pas de Content-Type : le navigateur ajoute lui-même la frontière du multipart
		const response = await fetch("/api/applications/draft", {
			method: "PUT",
			credentials: "same-origin",
			headers: { "X-CSRFToken": csrfToken },
			body,
		});
		if (response.status === 401 || response.status === 403) return { ok: false, reason: "noSession" };
		if (response.status === 409) return { ok: false, reason: "alreadySubmitted" };
		if (response.status === 400) return { ok: false, reason: "invalid" };
		if (!response.ok) return { ok: false, reason: "server" };
		return { ok: true, application: (await response.json()) as ApplicationDetail };
	} catch (error) {
		return { ok: false, reason: error instanceof TypeError ? "network" : "server" };
	}
}

// Envoie un brouillon au recruteur. Le backend y joint une copie du CV du profil, qui ne bougera plus ensuite.
export async function submitApplication(id: number): Promise<SubmitResult> {
	try {
		const csrfToken = await getCsrfToken();
		if (!csrfToken) return { ok: false, reason: "server" };
		const response = await fetch(`/api/applications/${id}/submit`, {
			method: "POST",
			credentials: "same-origin",
			headers: { "X-CSRFToken": csrfToken },
		});
		if (response.status === 401 || response.status === 403) return { ok: false, reason: "noSession" };
		if (response.status === 409) return { ok: false, reason: "alreadySubmitted" };
		if (response.status === 400) {
			// Le backend ne distingue « pas de CV » de « offre fermée » que par son message
			const { error } = await response.json();
			return { ok: false, reason: error === "A resume is required" ? "noResume" : "invalid" };
		}
		if (!response.ok) return { ok: false, reason: "server" };
		return { ok: true, application: (await response.json()) as ApplicationDetail };
	} catch (error) {
		return { ok: false, reason: error instanceof TypeError ? "network" : "server" };
	}
}
