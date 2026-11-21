import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getRecruiterOffer, type OfferResult, type PublishedOffer } from "../services/recruiterOffers";
import { formatDate } from "../utils/applications";
import { sectorLabel } from "../utils/companies";
import { focus } from "../utils/searchPageStyles";
import { OfferRequestState, RecruiterOffersLayout } from "./RecruiterOffersPage";

export function RecruiterOfferDetail({ offer }: { offer: PublishedOffer }) {
	const details = [
		["Secteur", sectorLabel(offer.category)],
		["Type de contrat", offer.contract_type === "alternance" ? "Alternance" : offer.contract_type],
		["Durée", offer.duration],
		["Date de début", offer.start_date ? formatDate(offer.start_date) : ""],
		["Lieu", offer.location],
	];
	return <div className="mx-auto max-w-[900px]">
		<Link to="/recruiter/offers" className={`text-sm font-semibold text-primary hover:underline ${focus}`}>← Retour à vos offres</Link>
		<article className="mt-5 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-surface shadow-xs">
			<img src={offer.image_url || "/static/img/recruiter-offers/offer.webp"} alt="" className="h-52 w-full object-cover sm:h-64" />
			<div className="space-y-8 p-6 sm:p-8">
				<header><p className="text-sm text-[#6b7280]">{offer.company?.name ?? "Entreprise non renseignée"} · Créée le {formatDate(offer.created_at)}</p><h1 className="mt-2 text-3xl font-bold">{offer.title}</h1><p className="mt-2 text-sm font-semibold text-primary">{offer.is_active ? "Publiée" : "Clôturée"}</p></header>
				<dl className="grid gap-4 sm:grid-cols-2">{details.map(([label, value]) => <div key={label}><dt className="text-xs font-semibold uppercase text-[#6b7280]">{label}</dt><dd className="mt-1 text-sm">{value || "Non renseigné"}</dd></div>)}</dl>
				<section><h2 className="text-lg font-semibold">Description de l’offre</h2><p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{offer.description}</p></section>
				<section><h2 className="text-lg font-semibold">Profil recherché</h2><p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{offer.requirements || "Non renseigné"}</p></section>
				<Link to={`/recruiter/offers/${offer.id}/applicants`} className={`inline-block rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-primary/90 ${focus}`}>Voir les candidatures</Link>
			</div>
		</article>
	</div>;
}

export default function RecruiterOfferDetailPage() {
	const { id = "" } = useParams();
	const [result, setResult] = useState<OfferResult<PublishedOffer> | null>(null);
	const [attempt, setAttempt] = useState(0);
	useEffect(() => {
		let ignore = false;
		getRecruiterOffer(id).then((response) => { if (!ignore) setResult(response); });
		return () => { ignore = true; };
	}, [id, attempt]);
	return <RecruiterOffersLayout>{result?.ok ? <RecruiterOfferDetail offer={result.data} /> : <OfferRequestState result={result} retry={() => { setResult(null); setAttempt((value) => value + 1); }} />}</RecruiterOffersLayout>;
}
