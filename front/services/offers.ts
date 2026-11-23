export type PublicOffer = {
	id: number;
	title: string;
	description: string;
	requirements: string;
	category: number;
	created_at: string;
	company: { id: number; name: string; city: string } | null;
};

export type PublicOfferFilters = { query: string; city: string; sector: string };

export function filterPublicOffers(offers: PublicOffer[], filters: PublicOfferFilters) {
	const query = filters.query.trim().toLocaleLowerCase("fr");
	const city = filters.city.trim().toLocaleLowerCase("fr");
	return offers.filter((offer) => {
		const searchable = [offer.title, offer.description, offer.requirements, offer.company?.name ?? ""]
			.join(" ")
			.toLocaleLowerCase("fr");
		return (!query || searchable.includes(query))
			&& (!city || (offer.company?.city ?? "").toLocaleLowerCase("fr").includes(city))
			&& (!filters.sector || String(offer.category) === filters.sector);
	});
}

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
export type RecommendedOffer = PublicOffer & { reasons: string[]; match_percentage: number };
export const getRecommendations = () => read<RecommendedOffer[]>("/api/student/recommendations");
export const getOffer = (id: string) => read<PublicOffer>(`/api/offers/${encodeURIComponent(id)}`);
