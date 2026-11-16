// Appels à l'API de consultation des entreprises (JOB-021), accessible sans connexion.

// Doit rester égal à PAGE_SIZE dans jobup/companies.py
export const PAGE_SIZE = 6;

export type CompanyCard = {
	id: number;
	name: string;
	/** Valeur de JobCategory, null si non renseigné */
	sector: number | null;
	city: string;
	employees: number | null;
	description: string;
	active_offers: number;
};

export type CompanyOffer = {
	id: number;
	title: string;
	category: number;
	/** Date ISO */
	created_at: string;
};

export type Company = CompanyCard & {
	website: string;
	offers: CompanyOffer[];
};

export type CompanyList = {
	count: number;
	page: number;
	pages: number;
	results: CompanyCard[];
};

export type CompanyFilters = {
	q?: string;
	/** Valeur de JobCategory ; "" ou absent = tous les secteurs */
	sector?: number | "";
	/** "" ou absent = toute la France */
	city?: string;
	page?: number;
};

type Failure = { ok: false; reason: "server" | "network" };

// GET commun : erreur réseau, réponse non JSON et statut inattendu sont distingués
async function getJson(url: string): Promise<{ ok: true; status: number; data: unknown } | Failure> {
	let response: Response;
	try {
		response = await fetch(url, { credentials: "same-origin" });
	} catch {
		return { ok: false, reason: "network" };
	}
	if (!response.ok && response.status !== 404) return { ok: false, reason: "server" };
	try {
		return { ok: true, status: response.status, data: await response.json() };
	} catch {
		return { ok: false, reason: "server" };
	}
}

export async function getCompanies(filters: CompanyFilters): Promise<{ ok: true; list: CompanyList } | Failure> {
	// Les filtres vides ne sont pas envoyés
	const params = new URLSearchParams();
	if (filters.q?.trim()) params.set("q", filters.q.trim());
	if (filters.sector !== undefined && filters.sector !== "") params.set("sector", String(filters.sector));
	if (filters.city) params.set("city", filters.city);
	if (filters.page && filters.page > 1) params.set("page", String(filters.page));

	const query = params.toString();
	const result = await getJson(query ? `/api/companies?${query}` : "/api/companies");
	if (!result.ok) return result;
	if (result.status === 404) return { ok: false, reason: "server" };
	return { ok: true, list: result.data as CompanyList };
}

export async function getCompany(id: number): Promise<{ ok: true; company: Company } | Failure | { ok: false; reason: "notFound" }> {
	const result = await getJson(`/api/companies/${id}`);
	if (!result.ok) return result;
	if (result.status === 404) return { ok: false, reason: "notFound" };
	return { ok: true, company: result.data as Company };
}

export async function getCities(): Promise<{ ok: true; cities: string[] } | Failure> {
	const result = await getJson("/api/companies/cities");
	if (!result.ok) return result;
	if (result.status === 404) return { ok: false, reason: "server" };
	return { ok: true, cities: result.data as string[] };
}
