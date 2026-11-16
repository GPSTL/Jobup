import type { CandidateSummary } from "./candidates";

export type RecruiterOffer = {
	id: number;
	title: string;
	description: string;
	created_at: string;
	is_active: boolean;
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
