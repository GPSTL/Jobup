// Entretiens : le recruteur propose des créneaux, l'étudiant en retient un. Contrat : docs/api/interviews.md

import type { ApplicationDetail } from "./applications";
import { getCsrfToken } from "./auth";
import type { RecruiterApplication } from "./recruiterOffers";

/** Pourquoi un créneau ne peut plus être choisi : déjà commencé, pris par un autre candidat du recruteur,
 * ou en même temps qu'un autre entretien confirmé de l'étudiant (« busy », vue de l'étudiant seulement) */
export type SlotUnavailable = "passed" | "taken" | "busy";

export type InterviewSlot = {
	id: number;
	starts_at: string;
	ends_at: string;
	chosen: boolean;
	/** null : le créneau peut être choisi (toujours null une fois l'entretien confirmé) */
	unavailable: SlotUnavailable | null;
};

export type Interview = {
	id: number;
	/** « proposed » : l'étudiant n'a pas encore choisi ; « confirmed » : confirmed_slot est retenu */
	status: "proposed" | "confirmed";
	/** Adresse ou lien de la visio, "" s'il n'est pas précisé */
	location: string;
	message: string;
	created_at: string;
	/** Du plus proche au plus lointain */
	slots: InterviewSlot[];
	confirmed_slot: InterviewSlot | null;
	/** Créneaux que l'étudiant peut encore choisir */
	available_count: number;
};

/** Entretien d'une candidature dans la liste des candidats d'une offre */
export type InterviewState = {
	status: "proposed" | "confirmed";
	slot_count: number;
	confirmed_slot: InterviewSlot | null;
};

/** Autre entretien confirmé du recruteur : de nouveaux créneaux ne doivent pas le chevaucher */
export type UpcomingInterview = { starts_at: string; ends_at: string; candidate: string; offer: string; application_id: number };

export type Proposal = {
	/** Dates ISO avec leur fuseau */
	slots: { starts_at: string; ends_at: string }[];
	location: string;
	message: string;
};

export type InterviewResult<T> =
	| { ok: true; data: T }
	/** rejected : 400 ou 409, `error` est le code de l'API et `slot` l'indice du créneau en cause */
	| { ok: false; reason: "unauthenticated" | "notFound" | "rejected" | "server" | "network"; error: string; slot: number | null };

const failure = (reason: "unauthenticated" | "server" | "network") => ({ ok: false as const, reason, error: "", slot: null });

async function send<T>(url: string, method: "POST" | "DELETE", body?: unknown): Promise<InterviewResult<T>> {
	let response: Response;
	try {
		const csrfToken = await getCsrfToken();
		if (!csrfToken) return failure("server");
		response = await fetch(url, {
			method,
			credentials: "same-origin",
			headers: body === undefined ? { "X-CSRFToken": csrfToken } : { "X-CSRFToken": csrfToken, "Content-Type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
	} catch {
		return failure("network");
	}
	if (response.status === 401 || response.status === 403) return failure("unauthenticated");
	if (response.ok) {
		try {
			return { ok: true, data: (await response.json()) as T };
		} catch {
			return failure("server");
		}
	}
	if (![400, 404, 409].includes(response.status)) return failure("server");
	let detail: { error?: unknown; slot?: unknown } = {};
	try {
		detail = await response.json();
	} catch {
		// Réponse sans corps JSON : seul le statut compte
	}
	return {
		ok: false,
		reason: response.status === 404 ? "notFound" : "rejected",
		error: typeof detail.error === "string" ? detail.error : "",
		slot: typeof detail.slot === "number" ? detail.slot : null,
	};
}

const recruiterUrl = (applicationId: number) => `/api/recruiter/applications/${applicationId}/interview`;

/** Propose des créneaux ; remplace une proposition à laquelle le candidat n'a pas encore répondu */
export const proposeInterview = (applicationId: number, proposal: Proposal) => send<RecruiterApplication>(recruiterUrl(applicationId), "POST", proposal);

/** Annule l'entretien, proposé ou confirmé ; le candidat est prévenu */
export const cancelInterview = (applicationId: number) => send<RecruiterApplication>(recruiterUrl(applicationId), "DELETE");

/** L'étudiant retient un créneau */
export const chooseInterviewSlot = (applicationId: number, slotId: number) =>
	send<ApplicationDetail>(`/api/applications/${applicationId}/interview`, "POST", { slot: slotId });
