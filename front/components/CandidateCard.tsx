import { Link, useLocation } from "react-router-dom";

import BanIcon from "./BanIcon";
import { CandidateAvatar, EducationLine } from "./CandidateIdentity";
import HeartIcon from "./HeartIcon";
import type { CandidateSummary } from "../services/candidates";
import { fullName } from "../utils/candidates";
import { focus } from "../utils/searchPageStyles";

const cardLink = `w-fit text-sm font-semibold text-primary hover:underline underline-offset-4 ${focus}`;

// Candidate swipe card and its actions.
// A click anywhere on the card opens the profile: the "Consulter le profil" link stretches over the
// whole card (after:absolute), and the CV link is placed above it (relative z-10).
type CandidateCardProps = {
	candidate: CandidateSummary;
	recommended?: boolean;
	reasons?: string[];
	/** ♥ : retenir le candidat (JOB-037) ; sans cette fonction, pas de bouton */
	onKeep?: () => void;
	/** Présélection en cours d'envoi : le bouton est inactif mais garde le focus */
	keeping?: boolean;
	/** 🚫 : écarter le candidat (JOB-038) ; sans cette fonction, pas de bouton */
	onExclude?: () => void;
	/** Exclusion en cours d'envoi : les deux boutons sont inactifs mais gardent le focus */
	excluding?: boolean;
};

export default function CandidateCard({ candidate, recommended = false, reasons = [], onKeep, keeping = false, onExclude, excluding = false }: CandidateCardProps) {
	// Une seule action à la fois : pendant l'envoi de l'une, l'autre est inactive
	const busy = keeping || excluding;
	// Recherche en cours (critères des filtres, JOB-036), reprise par « Retour aux candidats » sur le profil
	const { search } = useLocation();
	return (
		<div>
		<article className="relative flex min-h-[520px] flex-col overflow-hidden rounded-[2rem] bg-surface shadow-xl sm:min-h-[560px]">
			<div className="relative flex min-h-[300px] flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#263f78] via-[#23334d] to-[#101b2e] px-6 pt-8 pb-24">
				{recommended && <p className="absolute top-5 left-5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-primary">✦ Recommandé pour vous</p>}
				<CandidateAvatar candidate={candidate} className="size-36 text-4xl ring-4 ring-white/30 sm:size-40" />
				<div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-[#101b2e] to-transparent px-6 pt-8 pb-6 text-white">
					<h2 className="text-2xl leading-tight font-extrabold sm:text-3xl">{fullName(candidate)}</h2>
					<p className="mt-2 text-sm font-medium text-white/90"><EducationLine candidate={candidate} /></p>
				</div>
			</div>
			<div className="p-6">
				{reasons.length > 0 && <p className="mb-3 text-sm font-medium text-primary">{reasons.join(" · ")}</p>}
				<p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Présentation</p>
				<p className={`mt-2 line-clamp-3 text-sm leading-relaxed ${candidate.description ? "text-ink" : "text-[#6b7280]"}`}>{candidate.description || "Présentation non renseignée."}</p>
				<div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
					<Link to={`/recruiter/candidates/${candidate.id}`} state={{ candidatesSearch: search }} className={`${cardLink} after:absolute after:inset-0 after:rounded-[2rem]`}>Consulter le profil</Link>
					{candidate.cv_url ? <a href={candidate.cv_url} download className={`relative z-10 ${cardLink}`}>Télécharger le CV</a> : <p className="text-sm text-[#6b7280]">CV non fourni</p>}
				</div>
			</div>
		</article>
			{(onKeep || onExclude) && (
				// Keep the actions outside the profile link.
				<div className="relative z-10 mt-5 flex items-center justify-center gap-8">
					{onExclude && (
						<button
							type="button"
							aria-label={`Écarter ${fullName(candidate)}`}
							aria-disabled={busy}
							onClick={() => !busy && onExclude()}
							className={`flex size-16 cursor-pointer items-center justify-center rounded-full border border-rose-100 bg-white text-rose-500 shadow-md transition hover:scale-105 hover:bg-rose-50 aria-disabled:cursor-wait aria-disabled:opacity-60 ${focus}`}
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
