import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { CandidateAvatar, EducationLine } from "../components/CandidateIdentity";
import ExportPanel from "../components/ExportPanel";
import { getOfferApplicants, type OfferApplicants, type OfferResult } from "../services/recruiterOffers";
import { formatDate, STATUS, statusChip } from "../utils/applications";
import { fullName } from "../utils/candidates";
import { APPLICATION_STATUS_OPTIONS, type ExportField } from "../utils/exports";
import { highlightText } from "../utils/highlight";
import { focus } from "../utils/searchPageStyles";
import { offerPanel, OfferRequestState, RecruiterOffersLayout } from "./RecruiterOffersPage";

export const applicantFilters = [
	{ key: "all", label: "Toutes", statuses: [] as number[] },
	{ key: "submitted", label: "Postulée", statuses: [STATUS.SUBMITTED] },
	{ key: "review", label: "En cours d’étude", statuses: [STATUS.READ, STATUS.IN_REVIEW] },
	{ key: "accepted", label: "Acceptée", statuses: [STATUS.ACCEPTED] },
	{ key: "refused", label: "Refusée", statuses: [STATUS.REFUSED] },
];

// Export de l'offre : son résumé (nombre de candidatures par statut) ou la liste de ses candidats
const exportFields: ExportField[] = [
	{ kind: "select", key: "content", label: "Contenu", options: [{ value: "offers", label: "Résumé de l’offre" }, { value: "candidates", label: "Liste des candidats" }] },
	{ kind: "checkboxes", key: "status", label: "Statut des candidatures", options: APPLICATION_STATUS_OPTIONS.filter(({ value }) => value !== "draft") },
];

export function OfferApplicantsContent({ data }: { data: OfferApplicants }) {
	const [params, setParams] = useSearchParams();
	const [query, setQuery] = useState("");
	const selected = applicantFilters.find((filter) => filter.key === params.get("status")) ?? applicantFilters[0];
	const matches = (status: number) => selected.statuses.length === 0 || selected.statuses.includes(status);
	const search = query.trim().toLocaleLowerCase("fr");
	const visible = data.applications.filter((application) => matches(application.status) && (!search || `${fullName(application.candidate)} ${application.candidate.education ?? ""} ${application.candidate.school ?? ""}`.toLocaleLowerCase("fr").includes(search)));
	return (
		<>
			<header className="flex flex-col gap-1">
				<h1 className="text-2xl leading-tight font-bold sm:text-3xl">{data.offer.title}</h1>
				<p className="text-sm text-[#6b7280]">{data.applications.length} candidature{data.applications.length === 1 ? "" : "s"} • Publiée le {formatDate(data.offer.created_at)}{!data.offer.is_active && " • Offre clôturée"}</p>
			</header>
			{data.applications.length > 0 && (
				<div className="flex flex-col gap-1.5">
					<label htmlFor="applicant-search" className="text-sm font-medium">Rechercher un candidat</label>
					<input id="applicant-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, formation ou école…" className="min-h-11 w-full max-w-md rounded-xl border border-[#d1d5db] bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
				</div>
			)}
			<ExportPanel url="/api/recruiter/offers/export" params={{ offer: String(data.offer.id) }} fields={exportFields} defaults={{ content: "candidates" }} />
			<div role="group" aria-label="Filtrer les candidatures par statut" className="flex flex-wrap gap-2">
				{applicantFilters.map((filter) => (
					<button key={filter.key} type="button" aria-pressed={filter === selected} onClick={() => { const next = new URLSearchParams(params); next.set("status", filter.key); setParams(next, { replace: true }); }} className={`cursor-pointer rounded-full border px-4 py-2 text-xs sm:text-sm ${filter === selected ? "border-primary bg-[#dbeafe] font-semibold text-primary" : "border-[#d1d5db] bg-surface hover:bg-[#f9fafb]"} ${focus}`}>
						{filter.label} ({data.applications.filter(({ status }) => filter.statuses.length === 0 || filter.statuses.includes(status)).length})
					</button>
				))}
			</div>
			{visible.length === 0 ? (
				<p role="status" className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-5 text-sm text-[#6b7280]">{data.applications.length === 0 ? "Aucune candidature pour cette offre pour le moment." : search ? "Aucun candidat ne correspond à votre recherche." : "Aucune candidature avec ce statut."}</p>
			) : (
				<ul aria-label="Candidats ayant postulé" className="flex flex-col gap-2.5">
					{visible.map(({ id, candidate, status, submitted_at }) => (
						<li key={id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] px-5 py-3.5">
							<CandidateAvatar candidate={candidate} className="size-11 text-base" />
							<div className="min-w-0 flex-1 basis-40 lg:max-w-[314px]">
								<h2 className="text-base font-semibold break-words">{highlightText(fullName(candidate), query)}</h2>
								<p className="text-xs sm:text-sm text-[#6b7280]"><EducationLine candidate={candidate} highlightTerms={query} /></p>
							</div>
							<p className="text-xs sm:text-sm text-[#6b7280]">Reçue le <time dateTime={submitted_at}>{formatDate(submitted_at)}</time></p>
							<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusChip(status).className}`}>{statusChip(status).label}</span>
							<Link to={`/recruiter/applications/${id}`} className={`text-sm font-semibold text-primary hover:underline ${focus}`}>Ouvrir la candidature</Link>
							<Link to={`/recruiter/candidates/${candidate.id}?offer=${data.offer.id}`} className={`ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-primary hover:underline ${focus}`}>
								<img src="/static/img/recruiter-offers/arrow.svg" width={16} height={16} alt="" />Voir<span className="sr-only"> le profil de {fullName(candidate)}</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</>
	);
}

export default function OfferApplicantsPage() {
	const { id = "" } = useParams();
	const [result, setResult] = useState<{ id: string; response: OfferResult<OfferApplicants> } | null>(null);
	const [attempt, setAttempt] = useState(0);
	useEffect(() => {
		let ignore = false;
		getOfferApplicants(id).then((response) => { if (!ignore) setResult({ id, response }); });
		return () => { ignore = true; };
	}, [id, attempt]);
	// A route change must never display the previous offer while the next loads.
	const response = result?.id === id ? result.response : null;
	return (
		<RecruiterOffersLayout>
			<section className={offerPanel}>
				<Link to="/recruiter/offers" className={`flex w-fit items-center gap-2 rounded-xl px-1 py-2 text-sm font-semibold text-primary hover:underline ${focus}`}><img src="/static/img/recruiter-offers/back.svg" width={18} height={18} alt="" />Retour à vos offres</Link>
				{response?.ok ? <OfferApplicantsContent data={response.data} /> : <OfferRequestState result={response} retry={() => { setResult(null); setAttempt(attempt + 1); }} />}
			</section>
		</RecruiterOffersLayout>
	);
}
