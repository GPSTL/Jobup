import type { CandidateSummary } from "./candidates";
import { STATUS } from "../utils/applications";

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


export type RecruiterApplication = {
    id: number;
    offer: RecruiterOffer;
    candidate: CandidateSummary;
    status: number;
    submitted_at: string;
    message: string;
    decision_message: string;
    conversation_id: number | null;
};

export const getRecruiterApplication = (id: string) => read<RecruiterApplication>(`/api/recruiter/applications/${encodeURIComponent(id)}`);

export type DecisionResult = OfferResult<RecruiterApplication> | { ok: false; reason: "conflict" };

export async function decideApplication(id: number, status: typeof STATUS.ACCEPTED | typeof STATUS.REFUSED, message: string): Promise<DecisionResult> {
    try {
        const csrfResponse = await fetch("/api/csrf", { credentials: "same-origin" });
        if (!csrfResponse.ok) return { ok: false, reason: "server" };
        const { csrfToken } = await csrfResponse.json() as { csrfToken: string };
        if (typeof csrfToken !== "string" || !csrfToken) return { ok: false, reason: "server" };
        const response = await fetch(`/api/recruiter/applications/${id}`, {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
            body: JSON.stringify({ status, message }),
        });
        if (response.status === 401 || response.status === 403) return { ok: false, reason: "unauthenticated" };
        if (response.status === 404) return { ok: false, reason: "notFound" };
        if (response.status === 409) return { ok: false, reason: "conflict" };
        if (!response.ok) return { ok: false, reason: "server" };
        return { ok: true, data: await response.json() as RecruiterApplication };
    } catch {
        return { ok: false, reason: "network" };
    }
}
