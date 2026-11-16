export type PublicOffer = {
	id: number;
	title: string;
	description: string;
	requirements: string;
	category: number;
	created_at: string;
	company: { id: number; name: string; city: string } | null;
};

export type PublicOfferResult<T> = { ok: true; data: T } | { ok: false; reason: "server" | "network" | "notFound" };

async function read<T>(url: string): Promise<PublicOfferResult<T>> {
	let response: Response;
	try {
		response = await fetch(url, { credentials: "same-origin" });
	} catch {
		return { ok: false, reason: "network" };
	}
	if (response.status === 404) return { ok: false, reason: "notFound" };
	if (!response.ok) return { ok: false, reason: "server" };
	try {
		return { ok: true, data: await response.json() as T };
	} catch {
		return { ok: false, reason: "server" };
	}
}

export const getOffers = () => read<PublicOffer[]>("/api/offers");
export const getOffer = (id: string) => read<PublicOffer>(`/api/offers/${encodeURIComponent(id)}`);
