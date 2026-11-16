import type { CandidateSummary } from "./candidates";

export type RecruiterOffer = {
	id: number;
	title: string;
	description: string;
	created_at: string;
	is_active: boolean;
	/** Image choisie à la création (JOB-065) ; "" : image par défaut */
	image_url?: string;
};

export type OfferSummary = RecruiterOffer & { applicant_count: number };
export type OfferApplicant = { id: number; candidate: CandidateSummary; status: number; submitted_at: string };
export type OfferApplicants = { offer: RecruiterOffer; applications: OfferApplicant[] };
export type OfferResult<T> = { ok: true; data: T } | { ok: false; reason: "unauthenticated" | "notFound" | "server" | "network" };

async function read<T>(url: string): Promise<OfferResult<T>> {
	let response: Response;
	try {
		response = await fetch(url, { credentials: "same-origin" });
	} catch {
		return { ok: false, reason: "network" };
	}
	if (response.status === 401 || response.status === 403) return { ok: false, reason: "unauthenticated" };
	if (response.status === 404) return { ok: false, reason: "notFound" };
	if (!response.ok) return { ok: false, reason: "server" };
	try {
		return { ok: true, data: await response.json() as T };
	} catch {
		return { ok: false, reason: "server" };
	}
}

export const getRecruiterOffers = () => read<OfferSummary[]>("/api/recruiter/offers");
export const getOfferApplicants = (id: string) => read<OfferApplicants>(`/api/recruiter/offers/${encodeURIComponent(id)}/applicants`);

// ----- Publication d'une offre (JOB-051, repris par JOB-065) : POST sur la même route -----

export type NewOffer = {
	title: string;
	description: string;
	category: number;
	requirements: string;
	image_url: string;
	contract_type: string;
	duration: string;
	start_date: string | null;
	location: string;
};

/** Offre publiée : contrat de lecture partagé avec JOB-068 (docs/api/recruiter-offers.md) */
export type PublishedOffer = NewOffer & {
	id: number;
	company: { id: number; name: string } | null;
	is_active: boolean;
	created_at: string;
};

export type CreateOfferResult =
	| { ok: true; offer: PublishedOffer }
	// status 0 : serveur injoignable ; 404 : recruteur sans entreprise
	| { ok: false; status: number; errors: Partial<Record<keyof NewOffer, string>> };

export async function createOffer(values: NewOffer): Promise<CreateOfferResult> {
	try {
		// Écriture : jeton CSRF demandé juste avant, Django le change à chaque connexion
		const csrf = await fetch("/api/csrf", { credentials: "same-origin" });
		if (!csrf.ok) return { ok: false, status: csrf.status, errors: {} };
		const { csrfToken } = await csrf.json();
		const response = await fetch("/api/recruiter/offers", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
			body: JSON.stringify(values),
		});
		if (response.status === 201) return { ok: true, offer: await response.json() };
		const errors: Partial<Record<keyof NewOffer, string>> = {};
		if (response.status === 400) {
			// Messages de l'API, en listes par champ : seuls ceux du formulaire sont gardés
			const data = await response.json();
			for (const key of Object.keys(values) as (keyof NewOffer)[]) {
				if (Array.isArray(data[key])) errors[key] = data[key].join(" ");
			}
		}
		return { ok: false, status: response.status, errors };
	} catch {
		return { ok: false, status: 0, errors: {} };
	}
}
