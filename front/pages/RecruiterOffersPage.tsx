import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";

import Button from "../components/Button";
import ExportPanel from "../components/ExportPanel";
import RecruiterNavbar from "../components/RecruiterNavbar";
import { getRecruiterOffers, type OfferResult, type OfferSummary } from "../services/recruiterOffers";
import { formatDate } from "../utils/applications";
import { APPLICATION_STATUS_OPTIONS, type ExportField } from "../utils/exports";
import { focus } from "../utils/searchPageStyles";
import { REQUEST_ERRORS } from "../utils/validation";

export const offerPanel = "mx-auto flex max-w-[1236px] flex-col gap-5 rounded-2xl border border-[#e5e7eb] bg-surface px-5 py-7 shadow-xs md:px-10 md:py-8";

export function RecruiterOffersLayout({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-dvh bg-[#f8fafc] px-4 pt-4 pb-16 text-ink md:px-6 md:pt-6">
			<header><RecruiterNavbar /></header>
			<main className="mx-auto mt-8 max-w-[1236px]">{children}</main>
		</div>
	);
}

export function OfferRequestState({ result, retry }: { result: OfferResult<unknown> | null; retry: () => void }) {
	if (result === null) return <p role="status" className="text-sm text-[#6b7280]">Chargement…</p>;
	if (result.ok) return null;
	if (result.reason === "unauthenticated") return <Navigate to="/login" replace />;
	if (result.reason === "notFound") return <div role="alert"><h1 className="text-2xl font-bold">Offre introuvable</h1><p className="mt-1 text-sm text-[#6b7280]">Cette offre n’existe pas ou vous n’y avez pas accès.</p></div>;
	return <div role="alert" className="flex flex-col items-start gap-4"><p className="text-sm">{REQUEST_ERRORS[result.reason]}</p><Button onClick={retry}>Réessayer</Button></div>;
}

export function RecruiterOfferList({ offers }: { offers: OfferSummary[] }) {
	if (offers.length === 0) return <p className={offerPanel}>Vous n’avez aucune offre pour le moment.</p>;
	return (
		<ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
			{offers.map((offer) => (
				<li key={offer.id} className="flex flex-col gap-3.5 rounded-2xl border border-[#e5e7eb] bg-surface p-5 shadow-xs transition-shadow hover:shadow-md">
					{/* Image choisie à la création (JOB-065), sinon l'image de la maquette */}
					<img src={offer.image_url || "/static/img/recruiter-offers/offer.webp"} alt="" loading="lazy" className="h-44 w-full rounded-xl object-cover" />
					<div className="flex items-start justify-between gap-2">
						<h2 className="text-lg leading-snug font-semibold text-ink">{offer.title}</h2>
						<span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${offer.is_active ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#f3f4f6] text-[#6b7280]"}`}>
							{offer.is_active ? "Publiée" : "Clôturée"}
						</span>
					</div>
					<p className="line-clamp-3 text-sm leading-relaxed whitespace-pre-line text-[#6b7280]">{offer.description}</p>
					<p className="mt-auto border-t border-[#e5e7eb] pt-3 text-xs text-[#6b7280]">
						{offer.applicant_count} candidature{offer.applicant_count === 1 ? "" : "s"} • Créée le {formatDate(offer.created_at)}
					</p>
					<Link to={`/recruiter/offers/${offer.id}/applicants`} className={`rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-on-primary hover:bg-primary/90 ${focus}`}>
						Consulter la liste de candidats<span className="sr-only"> : {offer.title}</span>
					</Link>
				</li>
			))}
		</ul>
	);
}

// Filtres de l'export : les offres ou leurs candidats, les offres publiées ou clôturées, et quelles candidatures
const exportFields: ExportField[] = [
	{ kind: "select", key: "content", label: "Contenu", options: [{ value: "offers", label: "Une ligne par offre" }, { value: "candidates", label: "Une ligne par candidat" }] },
	{ kind: "select", key: "offer_status", label: "Offres", options: [{ value: "", label: "Toutes les offres" }, { value: "active", label: "Publiées" }, { value: "closed", label: "Clôturées" }] },
	{ kind: "checkboxes", key: "status", label: "Statut des candidatures", options: APPLICATION_STATUS_OPTIONS.filter(({ value }) => value !== "draft") },
];

// Read-only entry for JOB-040 while offer authoring remains in JOB-022.
export default function RecruiterOffersPage() {
	// Titre de l'offre qui vient d'être publiée depuis « Créer une offre » (JOB-065)
	const created = (useLocation().state as { offerCreated?: string } | null)?.offerCreated;
	const [result, setResult] = useState<OfferResult<OfferSummary[]> | null>(null);
	const [attempt, setAttempt] = useState(0);
	useEffect(() => {
		let ignore = false;
		getRecruiterOffers().then((response) => { if (!ignore) setResult(response); });
		return () => { ignore = true; };
	}, [attempt]);
	return (
		<RecruiterOffersLayout>
			<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Vos offres</h1>
					<p className="mt-1 text-sm text-[#6b7280]">Gérez vos annonces d’alternance et consultez les candidatures reçues.</p>
				</div>
				{/* Bouton de la maquette « Liste d'offres » (JOB-065) */}
				<Button to="/recruiter/offers/new" className="px-5 py-2.5">
					Créer une offre
				</Button>
			</div>
			<p role="status" className="mb-6 rounded-xl bg-[#ecfdf3] px-4 py-3 text-sm font-medium text-[#15803d] empty:hidden">
				{created ? `Votre offre « ${created} » est publiée.` : ""}
			</p>
			{result?.ok && result.data.length > 0 && <div className="mb-6"><ExportPanel url="/api/recruiter/offers/export" fields={exportFields} defaults={{ content: "offers" }} /></div>}
			{result?.ok ? <RecruiterOfferList offers={result.data} /> : <div className={offerPanel}><OfferRequestState result={result} retry={() => { setResult(null); setAttempt(attempt + 1); }} /></div>}
		</RecruiterOffersLayout>
	);
}
