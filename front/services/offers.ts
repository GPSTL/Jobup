export type Offer = {
  id: number;
  title: string;
  description: string;
  image_url: string;
  requirements: string;
  category: string;
  company: string;
  created_at: string;
};

export class OfferError extends Error {
  constructor(public status: number) { super("Impossible de charger les offres."); }
}

export async function fetchOffers<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/recruiter/offers${path}`, { credentials: "same-origin", signal });
  if (!response.ok) throw new OfferError(response.status);
  return response.json();
}
