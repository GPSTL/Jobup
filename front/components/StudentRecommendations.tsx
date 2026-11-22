import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getRecommendations, type RecommendedOffer } from "../services/offers";

export default function StudentRecommendations() {
	const [offers, setOffers] = useState<RecommendedOffer[] | null>(null);
	const [error, setError] = useState(false);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let ignore = false;
		getRecommendations().then((result) => {
			if (ignore) return;
			if (result.ok) setOffers(result.data);
			else setError(true);
		});
		return () => { ignore = true; };
	}, [attempt]);

	return <section aria-labelledby="student-recommendations-title" className="mx-auto mt-8 max-w-[1236px] rounded-2xl border border-[#e5e7eb] bg-surface p-5 shadow-xs sm:p-6">
		<h2 id="student-recommendations-title" className="text-xl font-bold">Offres pour vous</h2>
		<p className="mt-1 text-sm text-[#6b7280]">Suggestions basées sur votre profil, votre CV et votre activité.</p>
		{error ? <div role="alert" className="mt-4">Impossible de charger les suggestions. <button className="text-primary underline" onClick={() => { setError(false); setAttempt((n) => n + 1); }}>Réessayer</button></div> : !offers ? <p role="status" className="mt-4">Chargement des suggestions…</p> : offers.length === 0 ? <p className="mt-4">Aucune offre à suggérer pour le moment.</p> : <ul className="mt-4 grid gap-3 md:grid-cols-2">
			{offers.map((offer) => (
				<li key={offer.id} className="rounded-xl border border-[#e5e7eb] p-4">
					<Link className="font-semibold text-primary hover:underline" to={`/offers/${offer.id}`}>{offer.title}</Link>
					<p className="mt-1 text-sm">{offer.company?.name ?? "Entreprise non renseignée"}{offer.company?.city ? ` · ${offer.company.city}` : ""}</p>
					<p className="mt-2 text-sm text-[#6b7280]">{offer.reasons.length ? offer.reasons.join(" · ") : "Offre récente"}</p>
				</li>
			))}
		</ul>}
	</section>;
}
