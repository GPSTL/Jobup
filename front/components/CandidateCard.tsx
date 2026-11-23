import { Link, useLocation } from "react-router-dom";

import BanIcon from "./BanIcon";
import { CandidateAvatar, EducationLine } from "./CandidateIdentity";
import HeartIcon from "./HeartIcon";
import MatchCardHeader from "./MatchCardHeader";
import type { CandidateSummary } from "../services/candidates";
import { fullName } from "../utils/candidates";
import { highlightText } from "../utils/highlight";
import { focus } from "../utils/searchPageStyles";

const cardLink = `w-fit text-sm font-semibold text-primary hover:underline underline-offset-4 ${focus}`;

// Candidate swipe card and its actions.
// A click anywhere on the card opens the profile: the "Consulter le profil" link stretches over the
// whole card (after:absolute), and the CV link is placed above it (relative z-10).
type CandidateCardProps = {
	candidate: CandidateSummary;
	matchPercentage?: number;
	reasons?: string[];
	highlightTerms?: string[];
	/** ♥ : retenir le candidat (JOB-037) ; sans cette fonction, pas de bouton */
	onKeep?: () => void;
	/** Présélection en cours d'envoi : le bouton est inactif mais garde le focus */
	keeping?: boolean;
	/** 🚫 : écarter le candidat (JOB-038) ; sans cette fonction, pas de bouton */
	onExclude?: () => void;
	/** Exclusion en cours d'envoi : les deux boutons sont inactifs mais gardent le focus */
	excluding?: boolean;
};

export default function CandidateCard({ candidate, matchPercentage, reasons = [], highlightTerms = [], onKeep, keeping = false, onExclude, excluding = false }: CandidateCardProps) {
	// Une seule action à la fois : pendant l'envoi de l'une, l'autre est inactive
	const busy = keeping || excluding;
	// Recherche en cours (critères des filtres, JOB-036), reprise par « Retour aux candidats » sur le profil
	const { search } = useLocation();
	return (
		<div>
		<article className="relative flex min-h-[520px] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-surface shadow-md">
			<div className="flex flex-1 flex-col bg-linear-to-br from-[#263f78] via-[#23334d] to-[#101b2e]">
				<MatchCardHeader label="Profil candidat" percentage={matchPercentage} />
				<div className="flex flex-1 items-center justify-center px-5 py-5">
					<CandidateAvatar candidate={candidate} className="size-28 text-3xl ring-4 ring-white/30 sm:size-36" />
				</div>
				<div className="px-5 pb-5 text-white sm:px-6">
					<h2 className="wrap-break-word text-2xl leading-tight font-extrabold sm:text-3xl">{highlightText(fullName(candidate), highlightTerms)}</h2>
					<p className="mt-1 text-sm text-white/90 [&_span]:text-inherit"><EducationLine candidate={candidate} highlightTerms={highlightTerms} /></p>
				</div>
			</div>
			<div className="px-5 py-5 sm:px-6">
				<p className="line-clamp-4 text-sm leading-relaxed match-card-description">{candidate.description ? highlightText(candidate.description, highlightTerms) : "Présentation non renseignée."}</p>
				{reasons.length > 0 && <p className="mt-4 rounded-xl bg-primary/5 px-3 py-2 text-sm leading-relaxed text-primary">{highlightText(reasons.join(" · "), highlightTerms)}</p>}
				<div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
					<Link to={`/recruiter/candidates/${candidate.id}`} state={{ candidatesSearch: search }} className={`${cardLink} after:absolute after:inset-0 after:rounded-3xl`}>Consulter le profil</Link>
					{candidate.cv_url ? <a href={candidate.cv_url} download className={`relative z-10 ${cardLink}`}>Télécharger le CV</a> : <p className="text-sm text-[#6b7280]">CV non fourni</p>}
				</div>
			</div>
		</article>
			{(onKeep || onExclude) && (
				// Keep the actions outside the profile link.
				<div className="relative z-10 mt-5 flex items-center justify-center gap-5">
					{onExclude && (
						<button
							type="button"
							aria-label={`Écarter ${fullName(candidate)}`}
							aria-disabled={busy}
							onClick={() => !busy && onExclude()}
							className={`flex size-16 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-surface text-gray-500 shadow-md transition hover:scale-105 hover:bg-rose-50 aria-disabled:cursor-wait aria-disabled:opacity-60 ${focus}`}
						>
							<BanIcon width={28} height={28} />
						</button>
					)}
					{onKeep && (
						<button
							type="button"
							aria-label={`Retenir ${fullName(candidate)}`}
							aria-disabled={busy}
							onClick={() => !busy && onKeep()}
							className={`flex size-16 cursor-pointer items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition hover:scale-105 aria-disabled:cursor-wait aria-disabled:opacity-60 ${focus}`}
						>
							<HeartIcon width={28} height={28} fill="currentColor" />
						</button>
					)}
				</div>
			)}
		</div>
	);
}
