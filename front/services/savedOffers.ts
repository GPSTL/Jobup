export type SavedOffer = { offerId: number; savedAt: string };
export type SavedOffersResult<T> =
	| { ok: true; data: T }
	| { ok: false; reason: "server" | "network" | "unauthenticated" | "forbidden" | "notFound" };

type SavedOfferResponse = { id: number; saved_at: string };

async function request<T>(url: string, method = "GET"): Promise<SavedOffersResult<T>> {
	const headers: Record<string, string> = {};
	if (method !== "GET") {
		let csrf: Response;
		try {
			csrf = await fetch("/api/csrf", { credentials: "same-origin" });
		} catch {
			return { ok: false, reason: "network" };
		}
		if (!csrf.ok) return { ok: false, reason: "server" };
		try {
			const body = await csrf.json() as { csrfToken?: unknown };
			if (typeof body.csrfToken !== "string") return { ok: false, reason: "server" };
			headers["X-CSRFToken"] = body.csrfToken;
		} catch {
			return { ok: false, reason: "server" };
		}
	}

	let response: Response;
	try {
		response = await fetch(url, { method, headers, credentials: "same-origin" });
	} catch {
		return { ok: false, reason: "network" };
	}
	if (response.status === 401) return { ok: false, reason: "unauthenticated" };
	if (response.status === 403) return { ok: false, reason: "forbidden" };
	if (response.status === 404) return { ok: false, reason: "notFound" };
	if (!response.ok) return { ok: false, reason: "server" };
	if (response.status === 204) return { ok: true, data: undefined as T };
	try {
		return { ok: true, data: await response.json() as T };
	} catch {
		return { ok: false, reason: "server" };
	}
}

export async function getSavedOffers(): Promise<SavedOffersResult<SavedOffer[]>> {
	const result = await request<SavedOfferResponse[]>("/api/student/saved-offers");
	return result.ok
		? { ok: true, data: result.data.map(({ id, saved_at }) => ({ offerId: id, savedAt: saved_at })) }
		: result;
}

export async function saveOffer(offerId: number): Promise<SavedOffersResult<SavedOffer>> {
	const result = await request<SavedOfferResponse>(`/api/student/saved-offers/${offerId}`, "POST");
	return result.ok
		? { ok: true, data: { offerId: result.data.id, savedAt: result.data.saved_at } }
		: result;
}

export function removeSavedOffer(offerId: number): Promise<SavedOffersResult<void>> {
	return request<void>(`/api/student/saved-offers/${offerId}`, "DELETE");
}

export async function isOfferSaved(offerId: number): Promise<SavedOffersResult<boolean>> {
	const result = await getSavedOffers();
	return result.ok ? { ok: true, data: result.data.some((offer) => offer.offerId === offerId) } : result;
}
