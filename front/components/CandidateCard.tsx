import { Link, useLocation } from "react-router-dom";

import BanIcon from "./BanIcon";
import { CandidateAvatar, EducationLine } from "./CandidateIdentity";
import HeartIcon from "./HeartIcon";
import type { CandidateSummary } from "../services/candidates";
import { fullName } from "../utils/candidates";
import { focus } from "../utils/searchPageStyles";

const cardLink = `w-fit text-sm font-semibold text-primary hover:underline underline-offset-4 ${focus}`;

// Card of a candidate, as in the mockups "Tri des candidats (cartes)" and "Swipe – carte 2".
// A click anywhere on the card opens the profile: the "Consulter le profil" link stretches over the
// whole card (after:absolute), and the CV link is placed above it (relative z-10).
type CandidateCardProps = {
	candidate: CandidateSummary;
	/** ♥ : retenir le candidat (JOB-037) ; sans cette fonction, pas de bouton */
	onKeep?: () => void;
	/** Présélection en cours d'envoi : le bouton est inactif mais garde le focus */
	keeping?: boolean;
	/** 🚫 : écarter le candidat (JOB-038) ; sans cette fonction, pas de bouton */
	onExclude?: () => void;
	/** Exclusion en cours d'envoi : les deux boutons sont inactifs mais gardent le focus */
	excluding?: boolean;
};

export default function CandidateCard({ candidate, onKeep, keeping = false, onExclude, excluding = false }: CandidateCardProps) {
	// Une seule action à la fois : pendant l'envoi de l'une, l'autre est inactive
	const busy = keeping || excluding;
	// Recherche en cours (critères des filtres, JOB-036), reprise par « Retour aux candidats » sur le profil
	const { search } = useLocation();
	return (
		<article className="animate-scale-in relative flex min-h-[520px] flex-col items-center rounded-2xl border border-[#e5e7eb] bg-surface px-6 pt-8 pb-8 shadow-xs motion-safe:transition-shadow hover:shadow-md sm:px-10">
			<h2 className="text-center text-2xl leading-tight font-bold text-ink">{fullName(candidate)}</h2>
			<p className="mt-1.5 text-center text-sm sm:text-base font-medium text-[#6b7280]">
				<EducationLine candidate={candidate} />
			</p>
			<CandidateAvatar candidate={candidate} className="mt-5 size-36 text-4xl ring-4 ring-[#dbeafe]" />

			{/* The whole presentation is on the profile */}
			<p className={`mt-5 line-clamp-5 self-stretch text-sm sm:text-base leading-relaxed ${candidate.description ? "text-ink" : "text-[#6b7280]"}`}>
				{candidate.description || "Présentation non renseignée."}
			</p>

			<div className="mt-4 flex flex-col gap-2.5 self-stretch">
				<Link
					to={`/recruiter/candidates/${candidate.id}`}
					state={{ candidatesSearch: search }}
					className={`${cardLink} after:absolute after:inset-0 after:rounded-2xl`}
				>
					Consulter le profil
				</Link>
				{candidate.cv_url ? (
					<a href={candidate.cv_url} download className={`relative z-10 ${cardLink}`}>
						Télécharger le CV
					</a>
				) : (
					<p className="text-sm text-[#6b7280]">CV non fourni</p>
				)}
			</div>

			{(onKeep || onExclude) && (
				// Deux colonnes comme la maquette : 🚫 à gauche (JOB-038), ♥ à droite (JOB-037) ; au-dessus du lien étiré sur la carte
				<div className="relative z-10 mt-auto grid w-full grid-cols-2 place-items-center border-t border-[#e5e7eb] pt-5">
					{onExclude && (
						<button
							type="button"
							aria-label={`Écarter ${fullName(candidate)}`}
							aria-disabled={busy}
							onClick={() => !busy && onExclude()}
							className={`col-start-1 flex size-12 cursor-pointer items-center justify-center rounded-full border border-[#e5e7eb] text-[#b91c1c] transition-colors hover:bg-[#b91c1c]/10 aria-disabled:cursor-wait aria-disabled:opacity-60 ${focus}`}
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
							className={`col-start-2 flex size-12 cursor-pointer items-center justify-center rounded-full border border-[#e5e7eb] text-primary transition-colors hover:bg-primary/10 aria-disabled:cursor-wait aria-disabled:opacity-60 ${focus}`}
						>
							<HeartIcon width={28} height={28} fill="currentColor" />
						</button>
					)}
				</div>
			)}
		</article>
	);
}
