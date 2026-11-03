export type Offer = {
  id: number;
  title: string;
  description: string;
  image_url: string;
  requirements: string;
  category: string;
  company: string;
  created_at: string;
  contract_type: string;
  duration: string;
  start_date: string | null;
  location: string;
};

export class OfferError extends Error {
  constructor(public status: number) { super("Impossible de charger les offres."); }
}

export type OfferCategory = { value: number; label: string };
export type NewOffer = {
  title: string; description: string; category: number; requirements: string;
  image_url: string; contract_type: string; duration: string;
  start_date: string | null; company: string; location: string;
};
export type CreateOfferResult =
  | { ok: true; offer: Offer }
  | { ok: false; status: number; errors: Partial<Record<keyof NewOffer, string>> };

export async function createOffer(values: NewOffer): Promise<CreateOfferResult> {
  try {
    const csrf = await fetch("/api/csrf", { credentials: "same-origin" });
    if (!csrf.ok) return { ok: false, status: csrf.status, errors: {} };
    const { csrfToken } = await csrf.json();
    const response = await fetch("/api/recruiter/offers", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
      body: JSON.stringify(values),
    });
    if (response.status === 201) return { ok: true, offer: await response.json() };
    const errors: Partial<Record<keyof NewOffer, string>> = {};
    if (response.status === 400) {
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

export async function fetchOffers<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/recruiter/offers${path}`, { credentials: "same-origin", signal });
  if (!response.ok) throw new OfferError(response.status);
  return response.json();
}
