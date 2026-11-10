import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";

import Button from "../components/Button";
import CalendarIcon from "../components/CalendarIcon";
import { CandidateAvatar, EducationLine } from "../components/CandidateIdentity";
import DownloadIcon from "../components/DownloadIcon";
import GraduationCapIcon from "../components/GraduationCapIcon";
import MapPinIcon from "../components/MapPinIcon";
import MessageIcon from "../components/MessageIcon";
import RecruiterNavbar from "../components/RecruiterNavbar";
import { getCandidate, type Candidate, type CandidateResult } from "../services/candidates";
import { candidatesLink } from "../utils/candidateFilters";
import { availability, degreeLabel, exchangeDate, exchangeText, fullName } from "../utils/candidates";
import { focus } from "../utils/searchPageStyles";
import { REQUEST_ERRORS } from "../utils/validation";

const panel = "mx-auto flex max-w-6xl flex-col gap-6 rounded-[25px] bg-surface p-5 shadow-[0_4px_12px_rgba(0,0,0,0.1)] md:p-10";
const sectionTitle = "text-[20px] font-semibold";
const box = "rounded-2xl border border-[#e5e7eb] bg-[#f9fafb]";
const metaItem = "flex items-center gap-1.5";
const action = `flex items-center justify-center gap-2 rounded-[14px] px-[22px] py-3 text-[16px] font-semibold ${focus}`;
const outlineAction = `${action} border border-[#d1d5db] bg-surface text-[#111827] hover:bg-slate-50`;

// Back to the cards, on the card of this candidate when there is one, with the criteria of the
// search when the profile was opened from a card (JOB-036)
function BackToCandidates({ id }: { id?: number }) {
	const state = useLocation().state as { candidatesSearch?: unknown } | null;
	const search = typeof state?.candidatesSearch === "string" ? state.candidatesSearch : "";
	return (
		<Link
			to={candidatesLink(search, id)}
			className={`flex w-fit items-center gap-2 rounded-[14px] py-1 text-[16px] font-semibold text-primary ${focus}`}
		>
			<img src="/static/img/applications/back.svg" width={18} height={18} alt="" />
			Retour aux candidats
		</Link>
	);
}

// Full profile of a candidate, as in the mockup "Profil du candidat".
// "Retenir" and "Écarter" belong to JOB-037 and JOB-038, "Signaler ce candidat" to REC-27.
export function CandidateProfile({ candidate }: { candidate: Candidate }) {
	return (
		<article className={panel}>
			<BackToCandidates id={candidate.id} />

			<header className="flex flex-wrap items-center gap-x-5 gap-y-4">
				<CandidateAvatar candidate={candidate} className="size-24 text-[32px]" />
				{/* basis: on a phone, the buttons go to the next line instead of squeezing the name */}
				<div className="flex min-w-0 flex-1 basis-48 flex-col gap-1.5">
					<h1 className="text-3xl leading-tight font-semibold">{fullName(candidate)}</h1>
					<p className="text-[17px] text-[#6b7280]">
						<EducationLine candidate={candidate} />
					</p>
					<ul className="flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-[#6b7280]">
						{candidate.region && (
							<li className={metaItem}>
								<MapPinIcon width={16} height={16} />
								{candidate.region}
							</li>
						)}
						{candidate.study_degree !== null && (
							<li className={metaItem}>
								<GraduationCapIcon width={16} height={16} />
								{degreeLabel(candidate.study_degree)}
							</li>
						)}
						{candidate.available_from && (
							<li className={metaItem}>
								<CalendarIcon width={16} height={16} />
								{availability(candidate.available_from)}
							</li>
						)}
					</ul>
				</div>
				<div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
					{/* TODO JOB-039: open the conversation with this candidate, or start it */}
					<Link to={`/recruiter/messages?candidate=${candidate.id}`} className={outlineAction}>
						<MessageIcon width={18} height={18} />
						Message
					</Link>
					{candidate.cv_url ? (
						<a href={candidate.cv_url} download className={`${action} bg-primary text-on-primary hover:bg-primary/90`}>
							<DownloadIcon width={18} height={18} />
							Télécharger le CV
						</a>
					) : (
						<p className="flex items-center text-[16px] text-[#6b7280]">CV non fourni</p>
					)}
				</div>
			</header>

			<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
				<div className="flex flex-col gap-6">
					<section className="flex flex-col gap-2">
						<h2 className={sectionTitle}>Présentation</h2>
						<p className={`whitespace-pre-line ${candidate.description ? "text-[#4b5563]" : "text-[#6b7280]"}`}>
							{candidate.description || "Présentation non renseignée."}
						</p>
					</section>

					<section className="flex flex-col gap-3">
						<h2 className={sectionTitle}>Compétences</h2>
						{candidate.skills.length > 0 ? (
							<ul className="flex flex-wrap gap-2">
								{candidate.skills.map((skill) => (
									<li key={skill} className="rounded-full bg-[#f3f4f6] px-3 py-1 text-[13px] font-medium text-[#4b5563]">
										{skill}
									</li>
								))}
							</ul>
						) : (
							<p className="text-[#6b7280]">Aucune compétence renseignée.</p>
						)}
					</section>

					<section className="flex flex-col gap-3">
						<h2 className={sectionTitle}>Expérience</h2>
						{candidate.experiences.length > 0 ? (
							<ul className="flex flex-col gap-3">
								{candidate.experiences.map((experience) => (
									<li key={experience.title} className={`flex flex-col gap-1 px-5 py-4 ${box}`}>
										<p className="font-semibold">{experience.title}</p>
										<p className="text-[14px] text-[#6b7280]">{experience.details}</p>
									</li>
								))}
							</ul>
						) : (
							<p className="text-[#6b7280]">Aucune expérience renseignée.</p>
						)}
					</section>
				</div>

				<section className="flex flex-col gap-3">
					<h2 className={sectionTitle}>Historique des échanges</h2>
					{candidate.exchanges.length > 0 ? (
						<>
							<ol className={`flex flex-col gap-3 px-5 py-4 ${box}`}>
								{candidate.exchanges.map((exchange) => (
									<li key={`${exchange.kind}-${exchange.id}`} className="flex flex-col">
										<time dateTime={exchange.date} className="text-[13px] font-semibold text-primary">
											{exchangeDate(exchange.date)}
										</time>
										<p className="line-clamp-2 text-[15px]">{exchangeText(exchange, candidate)}</p>
									</li>
								))}
							</ol>
							{/* TODO JOB-039: open the conversation with this candidate */}
							<Link to={`/recruiter/messages?candidate=${candidate.id}`} className={outlineAction}>
								<MessageIcon width={18} height={18} />
								Ouvrir la conversation
							</Link>
						</>
					) : (
						<p className={`px-5 py-4 text-[#6b7280] ${box}`}>Aucun échange avec ce candidat pour le moment.</p>
					)}
				</section>
			</div>
		</article>
	);
}

// Profile of a candidate, opened from their card (JOB-035, REC-01)
export default function CandidateProfilePage() {
	const { id } = useParams();
	// null while the profile loads
	const [result, setResult] = useState<CandidateResult | null>(null);
	// Incremented by "Réessayer" to load the profile again
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		// Ignores an answer that arrives after a change of profile
		let ignore = false;
		setResult(null);
		getCandidate(Number(id)).then((response) => {
			if (!ignore) setResult(response);
		});
		return () => {
			ignore = true;
		};
	}, [id, attempt]);

	// Session expired in the meantime
	if (result?.ok === false && result.reason === "unauthenticated") return <Navigate to="/login" replace />;

	return (
		<div className="min-h-dvh bg-[#f0f0f0]">
			<header className="p-4">
				<RecruiterNavbar />
			</header>

			<main className="px-4 pt-6 pb-16 md:px-6 md:pt-9">
				{result?.ok ? (
					<CandidateProfile candidate={result.candidate} />
				) : (
					<div className={panel}>
						<BackToCandidates />
						{result === null && (
							<p role="status" className="text-[#6b7280]">
								Chargement du profil…
							</p>
						)}
						{result?.reason === "notFound" && (
							<>
								<h1 className="text-3xl font-semibold">Profil introuvable</h1>
								<p className="text-[#6b7280]">Ce profil n’existe pas ou ne fait pas partie des candidats que vous pouvez consulter.</p>
							</>
						)}
						{(result?.reason === "server" || result?.reason === "network") && (
							<div role="alert" className="flex flex-col items-start gap-4">
								<p>{REQUEST_ERRORS[result.reason]}</p>
								<Button onClick={() => setAttempt(attempt + 1)}>Réessayer</Button>
							</div>
						)}
					</div>
				)}
			</main>
		</div>
	);
}
