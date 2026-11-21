import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";

import Button from "../components/Button";
import ExportPanel from "../components/ExportPanel";
import RecruiterNavbar from "../components/RecruiterNavbar";
import { getRecruiterOffers, type OfferResult, type OfferSummary } from "../services/recruiterOffers";
import { formatDate } from "../utils/applications";
import { APPLICATION_STATUS_OPTIONS, type ExportField } from "../utils/exports";
import { highlightText } from "../utils/highlight";
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

export function RecruiterOfferList({ offers, highlightQuery }: { offers: OfferSummary[]; highlightQuery?: string }) {
	if (offers.length === 0) return <p className={offerPanel}>Vous n’avez aucune offre pour le moment.</p>;
	return (
		<ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
			{offers.map((offer) => (
				<li key={offer.id} className="group flex flex-col overflow-hidden rounded-2xl border border-[#e5e7eb] bg-surface shadow-xs transition-shadow hover:shadow-lg">
					<div className="relative overflow-hidden"><img src={offer.image_url || "/static/img/recruiter-offers/offer.webp"} alt="" loading="lazy" className="h-44 w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" /><span className={`absolute top-4 right-4 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${offer.is_active ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#f3f4f6] text-[#6b7280]"}`}>{offer.is_active ? "Publiée" : "Clôturée"}</span></div>
					<div className="flex flex-1 flex-col p-5 sm:p-6">
						<p className="text-xs font-medium text-[#6b7280]">Créée le {formatDate(offer.created_at)}</p>
						<h2 className="mt-2 text-lg leading-snug font-bold text-ink">{highlightText(offer.title, highlightQuery)}</h2>
						<p className="mt-2 line-clamp-3 text-sm leading-relaxed whitespace-pre-line text-[#6b7280]">{highlightText(offer.description, highlightQuery)}</p>
						<div className="mt-auto pt-6"><Link to={`/recruiter/offers/${offer.id}`} className={`mb-4 inline-block text-sm font-semibold text-primary hover:underline ${focus}`}>Voir les détails<span className="sr-only"> : {offer.title}</span> →</Link><div className="mb-4 flex items-center justify-between border-t border-[#e5e7eb] pt-4"><span className="text-sm text-[#6b7280]">Candidatures</span><span className="rounded-full bg-[#f3f4f6] px-3 py-1 text-sm font-bold text-ink">{offer.applicant_count}</span></div>
							<Link to={`/recruiter/offers/${offer.id}/applicants`} className={`flex items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/90 ${focus}`}><span>Consulter la liste de candidats<span className="sr-only"> : {offer.title}</span></span><span aria-hidden="true">→</span></Link>
						</div>
					</div>
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
	const [status, setStatus] = useState<"all" | "active" | "closed">("all");
	const [query, setQuery] = useState("");
	useEffect(() => {
		let ignore = false;
		getRecruiterOffers().then((response) => { if (!ignore) setResult(response); });
		return () => { ignore = true; };
	}, [attempt]);
	const search = query.trim().toLocaleLowerCase("fr");
	const filteredOffers = result?.ok
		? result.data.filter((offer) => (status === "all" || offer.is_active === (status === "active")) && (!search || `${offer.title} ${offer.description}`.toLocaleLowerCase("fr").includes(search)))
		: [];
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
			{result?.ok && result.data.length > 0 && <>
				<div className="mb-7 grid grid-cols-3 gap-3"><div className="rounded-2xl border border-[#e5e7eb] bg-surface p-4"><p className="text-xs font-medium text-[#6b7280]">Toutes les offres</p><p className="mt-1 text-2xl font-bold">{result.data.length}</p></div><div className="rounded-2xl border border-[#e5e7eb] bg-surface p-4"><p className="text-xs font-medium text-[#6b7280]">Publiées</p><p className="mt-1 text-2xl font-bold">{result.data.filter((offer) => offer.is_active).length}</p></div><div className="rounded-2xl border border-[#e5e7eb] bg-surface p-4"><p className="text-xs font-medium text-[#6b7280]">Candidatures</p><p className="mt-1 text-2xl font-bold">{result.data.reduce((total, offer) => total + offer.applicant_count, 0)}</p></div></div>
				<div className="mb-4 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-bold">Vos annonces</h2><p className="text-sm text-[#6b7280]">Suivez vos offres et leurs candidatures.</p></div><div className="flex flex-wrap items-center gap-3"><label className="text-sm"><span className="sr-only">Rechercher une offre</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une offre…" className="rounded-xl border border-[#d1d5db] bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary" /></label><label className="text-sm"><span className="sr-only">Filtrer les offres par statut</span><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="rounded-xl border border-[#d1d5db] bg-surface px-3 py-2.5 font-medium"><option value="all">Toutes les offres</option><option value="active">Publiées</option><option value="closed">Clôturées</option></select></label><ExportPanel url="/api/recruiter/offers/export" fields={exportFields} defaults={{ content: "offers" }} /></div></div>
			</>}
			{result?.ok ? result.data.length > 0 && filteredOffers.length === 0 ? <p className={offerPanel}>{search ? "Aucune offre ne correspond à votre recherche." : "Aucune offre ne correspond à ce statut."}</p> : <RecruiterOfferList offers={filteredOffers} highlightQuery={query} /> : <div className={offerPanel}><OfferRequestState result={result} retry={() => { setResult(null); setAttempt(attempt + 1); }} /></div>}
		</RecruiterOffersLayout>
	);
}
