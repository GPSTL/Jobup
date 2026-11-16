import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";

import Button from "../components/Button";
import RecruiterNavbar from "../components/RecruiterNavbar";
import { getRecruiterOffers, type OfferResult, type OfferSummary } from "../services/recruiterOffers";
import { formatDate } from "../utils/applications";
import { focus } from "../utils/searchPageStyles";
import { REQUEST_ERRORS } from "../utils/validation";

export const offerPanel = "mx-auto flex max-w-[1236px] flex-col gap-5 rounded-[25px] bg-surface px-5 py-8 shadow-[0_4px_12px_rgba(0,0,0,0.1)] md:px-10 md:pb-9";

export function RecruiterOffersLayout({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-dvh bg-[#f0f0f0] text-[#111827]">
			<header className="px-4 pt-6 md:pt-[50px]"><div className="mx-auto max-w-[1236px]"><RecruiterNavbar /></div></header>
			<main className="px-4 pt-[35px] pb-16 md:px-6">{children}</main>
		</div>
	);
}

export function OfferRequestState({ result, retry }: { result: OfferResult<unknown> | null; retry: () => void }) {
	if (result === null) return <p role="status">Chargement…</p>;
	if (result.ok) return null;
	if (result.reason === "unauthenticated") return <Navigate to="/login" replace />;
	if (result.reason === "notFound") return <div role="alert"><h1 className="text-3xl font-semibold">Offre introuvable</h1><p>Cette offre n’existe pas ou vous n’y avez pas accès.</p></div>;
	return <div role="alert" className="flex flex-col items-start gap-4"><p>{REQUEST_ERRORS[result.reason]}</p><Button onClick={retry}>Réessayer</Button></div>;
}

export function RecruiterOfferList({ offers }: { offers: OfferSummary[] }) {
	if (offers.length === 0) return <p className={offerPanel}>Vous n’avez aucune offre pour le moment.</p>;
	return (
		<ul className="mx-auto grid max-w-[1332px] gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-[70px]">
			{offers.map((offer) => (
				<li key={offer.id} className="flex flex-col items-center gap-[15px] rounded-[25px] bg-surface px-6 py-10 shadow-[0_4px_12px_rgba(0,0,0,0.1)] sm:px-[50px]">
					<h2 className="text-center text-[36px] leading-tight font-semibold">{offer.title}</h2>
					<img src="/static/img/recruiter-offers/offer.webp" alt="" loading="lazy" className="aspect-[4096/2731] w-full rounded-[15px] object-cover" />
					<p className="self-stretch whitespace-pre-line text-xl">{offer.description}</p>
					<p className="self-stretch text-[#6b7280]">{offer.applicant_count} candidature{offer.applicant_count === 1 ? "" : "s"} • {offer.is_active ? "Publiée" : "Clôturée"}<br />Créée le {formatDate(offer.created_at)}</p>
					<Link to={`/recruiter/offers/${offer.id}/applicants`} className={`mt-auto rounded-[14px] bg-primary px-4 py-4 text-center text-lg font-semibold text-on-primary hover:bg-primary/90 ${focus}`}>
						Consulter la liste de candidats<span className="sr-only"> : {offer.title}</span>
					</Link>
				</li>
			))}
		</ul>
	);
}

// Read-only entry for JOB-040 while offer authoring remains in JOB-022.
export default function RecruiterOffersPage() {
	const [result, setResult] = useState<OfferResult<OfferSummary[]> | null>(null);
	const [attempt, setAttempt] = useState(0);
	useEffect(() => {
		let ignore = false;
		getRecruiterOffers().then((response) => { if (!ignore) setResult(response); });
		return () => { ignore = true; };
	}, [attempt]);
	return (
		<RecruiterOffersLayout>
			<h1 className="mx-auto mb-6 max-w-[1332px] text-3xl font-semibold">Vos offres</h1>
			{result?.ok ? <RecruiterOfferList offers={result.data} /> : <div className={offerPanel}><OfferRequestState result={result} retry={() => { setResult(null); setAttempt(attempt + 1); }} /></div>}
		</RecruiterOffersLayout>
	);
}
