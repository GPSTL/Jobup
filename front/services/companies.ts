// Appels à l'API de consultation des entreprises (JOB-021), accessible sans connexion.

// Doit rester égal à PAGE_SIZE dans jobup/companies.py
export const PAGE_SIZE = 6;

export type CompanyCard = {
	id: number;
	name: string;
	/** Logo choisi dans « Mon espace » recruteur (JOB-066) ; null : initiales à la place */
	logo_url: string | null;
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

// ----- Page entreprise du « Mon espace » recruteur (JOB-066, REC-25) -----
// Contrat : docs/api/company-page.md. La route ne vise que l'entreprise du recruteur connecté.

export type OwnCompany = CompanyCard & { website: string };

/** Champs du formulaire « Page entreprise » */
export type CompanyForm = {
	name: string;
	/** Valeur de JobCategory ; "" tant qu'aucun secteur n'est choisi */
	sector: number | "";
	city: string;
	description: string;
};

export type CompanyFormField = keyof CompanyForm | "logo";

export type OwnCompanyResult =
	| { ok: true; company: OwnCompany }
	// Compte recruteur rattaché à aucune entreprise
	| { ok: false; reason: "noCompany" | "unauthenticated" | "server" | "network" }
	// Valeurs refusées par l'API, avec un message par champ
	| { ok: false; reason: "invalid"; fields: Partial<Record<CompanyFormField, string>> };

const FORM_FIELDS: CompanyFormField[] = ["name", "sector", "city", "description", "logo"];

async function ownCompanyRequest(init: RequestInit = {}): Promise<OwnCompanyResult> {
	let response: Response;
	try {
		let headers: HeadersInit = {};
		if (init.method) {
			// Écriture : jeton CSRF demandé juste avant, Django le change à chaque connexion
			const csrf = await fetch("/api/csrf", { credentials: "same-origin" });
			if (!csrf.ok) return { ok: false, reason: "server" };
			const { csrfToken } = await csrf.json();
			headers = { ...(init.headers as Record<string, string>), "X-CSRFToken": csrfToken };
		}
		response = await fetch("/api/recruiter/company", { ...init, headers, credentials: "same-origin" });
	} catch {
		return { ok: false, reason: "network" };
	}
	// DRF répond 403 sans session valide : la page est protégée par RequireRecruiter, donc la session a expiré
	if (response.status === 401 || response.status === 403) return { ok: false, reason: "unauthenticated" };
	try {
		const data = await response.json();
		if (response.ok) return { ok: true, company: data as OwnCompany };
		if (response.status === 404 && data.error === "No company") return { ok: false, reason: "noCompany" };
		if (response.status === 400 && data.errors) {
			// Seuls les champs du formulaire sont gardés ; une autre erreur reste une erreur du serveur
			const fields: Partial<Record<CompanyFormField, string>> = {};
			for (const field of FORM_FIELDS) if (data.errors[field]) fields[field] = data.errors[field];
			if (Object.keys(fields).length > 0) return { ok: false, reason: "invalid", fields };
		}
	} catch {
		// Réponse non JSON : l'API n'est pas disponible sur ce serveur
	}
	return { ok: false, reason: "server" };
}

export const getOwnCompany = () => ownCompanyRequest();

// Enregistre tout le formulaire. Avec un nouveau logo, le corps est un formulaire multipart :
// le texte et le logo sont enregistrés ensemble, ou pas du tout.
export function saveOwnCompany(form: CompanyForm, logo: File | null = null): Promise<OwnCompanyResult> {
	const values = { name: form.name, sector: form.sector, city: form.city, description: form.description };
	if (!logo) {
		return ownCompanyRequest({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
	}
	const body = new FormData();
	for (const [field, value] of Object.entries(values)) body.append(field, String(value));
	body.append("logo", logo);
	// Sans Content-Type : le navigateur l'ajoute, avec la limite du corps multipart
	return ownCompanyRequest({ method: "PATCH", body });
}
