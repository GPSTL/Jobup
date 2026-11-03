export type Offer = {
	id: number; title: string; description: string; image_url: string; requirements: string;
	category: string; company: string; contract_type: string; duration: string;
	start_date: string | null; location: string; created_at: string;
};
export type OfferChanges = Pick<Offer, "title" | "description" | "image_url" | "requirements" | "company" | "contract_type" | "duration" | "start_date" | "location">;
export type OfferPage = { count: number; next: string | null; previous: string | null; results: Offer[] };
export class OfferError extends Error {
	constructor(public status: number, public fields: Record<string, string[]> = {}) {
		super(status === 404 ? "Cette offre est introuvable ou n’est plus disponible." : status === 403
			? "Accès refusé. Vérifiez votre connexion et vos droits de recruteur."
			: status === 400 ? "Vérifiez les champs du formulaire."
			: "Impossible de joindre le serveur. Réessayez.");
	}
}

export async function offerRequest<T>(url: string, method = "GET", changes?: OfferChanges): Promise<T> {
	try {
		const headers: Record<string, string> = {};
		if (method !== "GET") {
			const csrf = await fetch("/api/csrf", { credentials: "same-origin" });
			if (!csrf.ok) throw new OfferError(csrf.status);
			headers["X-CSRFToken"] = (await csrf.json()).csrfToken;
			headers["Content-Type"] = "application/json";
		}
		const response = await fetch(url, { method, credentials: "same-origin", headers,
			...(changes ? { body: JSON.stringify(changes) } : {}) });
		if (!response.ok) {
			let fields = {};
			if (response.status === 400) fields = await response.json();
			throw new OfferError(response.status, fields);
		}
		return response.status === 204 ? undefined as T : await response.json();
	} catch (error) {
		if (error instanceof OfferError) throw error;
		throw new OfferError(0);
	}
}
export const offerUrl = (id: number) => `/api/recruiter/offers/${id}`;
export const updateOffer = (id: number, changes: OfferChanges) => offerRequest<Offer>(offerUrl(id), "PATCH", changes);
export const removeOffer = (id: number) => offerRequest<void>(offerUrl(id), "DELETE");

export async function fetchOffers<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/recruiter/offers${path}`, { credentials: "same-origin", signal });
  if (!response.ok) throw new OfferError(response.status);
  return response.json();
}
