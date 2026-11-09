import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import Button from "../components/Button";
import CandidateCard from "../components/CandidateCard";
import ChevronDownIcon from "../components/ChevronDownIcon";
import HeartIcon from "../components/HeartIcon";
import RecruiterNavbar from "../components/RecruiterNavbar";
import { getCandidates, keepCandidate, type CandidateSummary, type CandidatesResult } from "../services/candidates";
import { cardIndex, fullName } from "../utils/candidates";
import { focus } from "../utils/searchPageStyles";
import { REQUEST_ERRORS } from "../utils/validation";

const arrow = [
	"flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-primary bg-surface text-primary shadow-sm",
	"hover:bg-primary hover:text-on-primary motion-safe:transition-colors",
	// aria-disabled rather than disabled: on the first and last card, the button keeps the keyboard focus
	"aria-disabled:cursor-default aria-disabled:border-[#d1d5db] aria-disabled:text-[#9ca3af] aria-disabled:hover:bg-surface",
	focus,
].join(" ");

const shadow = "shadow-[0_4px_12px_rgba(0,0,0,0.1)]";
const statePanel = `mx-auto flex max-w-[464px] flex-col items-center gap-4 rounded-[20px] bg-surface p-8 text-center ${shadow}`;

type CandidateDeckProps = {
	candidates: CandidateSummary[];
	/** Index of the card shown */
	index: number;
	onSelect: (index: number) => void;
	/** ♥ sur la carte affichée (JOB-037) */
	onKeep?: () => void;
	keeping?: boolean;
};

// Cards shown one at a time, the next one peeking out underneath (mockup "Swipe – carte 2").
// TODO JOB-037, JOB-038: ♥ and 🚫 will show the next card; until then, the arrows browse the cards.
export function CandidateDeck({ candidates, index, onSelect, onKeep, keeping }: CandidateDeckProps) {
	const candidate = candidates[index];
	const hasPrevious = index > 0;
	const hasNext = index < candidates.length - 1;

	return (
		// Small screens: arrows and position above the card. Large screens: arrows on each side of the card.
		<div className="mx-auto grid max-w-[464px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 sm:max-w-none sm:grid-cols-[auto_minmax(0,464px)_auto] sm:justify-center sm:gap-x-8">
			<button
				type="button"
				aria-label="Candidat précédent"
				aria-disabled={!hasPrevious}
				onClick={() => hasPrevious && onSelect(index - 1)}
				className={`col-start-1 row-start-1 ${arrow}`}
			>
				<ChevronDownIcon className="rotate-90" />
			</button>
			<p role="status" className="col-start-2 row-start-1 text-center text-[#6b7280] sm:sr-only">
				Candidat {index + 1} sur {candidates.length}
				<span className="sr-only"> : {fullName(candidate)}</span>
			</p>
			<button
				type="button"
				aria-label="Candidat suivant"
				aria-disabled={!hasNext}
				onClick={() => hasNext && onSelect(index + 1)}
				className={`col-start-3 row-start-1 ${arrow}`}
			>
				<ChevronDownIcon className="-rotate-90" />
			</button>

			<div className={`relative isolate col-span-3 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1 ${hasNext ? "mb-10" : ""}`}>
				{hasNext && <div aria-hidden="true" className={`absolute inset-x-0 top-10 -bottom-10 -z-10 rounded-[20px] bg-surface ${shadow}`} />}
				<CandidateCard candidate={candidate} onKeep={onKeep} keeping={keeping} />
			</div>
		</div>
	);
}

// "Candidats" tab of the recruiter (JOB-035, REC-01)
export default function CandidatesPage() {
	// null while the candidates load
	const [result, setResult] = useState<CandidatesResult | null>(null);
	// Incremented by "Réessayer" to load the candidates again
	const [attempt, setAttempt] = useState(0);
	// The card shown is kept in the URL, so that "Retour aux candidats" on the profile comes back to it
	const [params, setParams] = useSearchParams();
	// ♥ en cours d'envoi, message d'échec et annonce du succès (JOB-037)
	const [keeping, setKeeping] = useState(false);
	const [keepError, setKeepError] = useState("");
	const [kept, setKept] = useState("");
	// Toutes les cartes ont été retenues : un message différent de « aucun candidat »
	const [allKept, setAllKept] = useState(false);

	useEffect(() => {
		// Ignores the answer if the page was left in the meantime
		let ignore = false;
		getCandidates().then((response) => {
			if (!ignore) setResult(response);
		});
		return () => {
			ignore = true;
		};
	}, [attempt]);

	const retry = () => {
		setResult(null);
		setAttempt(attempt + 1);
	};

	const keep = async (candidates: CandidateSummary[], index: number) => {
		if (keeping) return;
		const candidate = candidates[index];
		setKeeping(true);
		setKeepError("");
		setKept("");
		const response = await keepCandidate(candidate.id);
		setKeeping(false);
		if (!response.ok) {
			if (response.reason === "unauthenticated") {
				// Session expirée : retour à la connexion, comme au chargement des cartes
				setResult({ ok: false, reason: "unauthenticated" });
				return;
			}
			// La carte reste affichée : le recruteur peut réessayer avec ♥
			setKeepError(
				response.reason === "notFound"
					? `${fullName(candidate)} n’est plus disponible.`
					: `${fullName(candidate)} n’a pas pu être retenu. ${REQUEST_ERRORS[response.reason]}`,
			);
			return;
		}
		// Carte suivante : celle qui prend la place de la carte retenue, ou la précédente s'il s'agissait de la dernière
		const rest = candidates.filter((other) => other.id !== candidate.id);
		setResult({ ok: true, candidates: rest });
		setKept(`${fullName(candidate)} a été ajouté à vos candidats retenus.`);
		if (rest.length === 0) setAllKept(true);
		else setParams({ candidate: String(rest[Math.min(index, rest.length - 1)].id) }, { replace: true });
	};

	// Session expired in the meantime
	if (result?.ok === false && result.reason === "unauthenticated") return <Navigate to="/login" replace />;

	return (
		<div className="min-h-dvh bg-[#f0f0f0]">
			<header className="p-4">
				<RecruiterNavbar />
			</header>

			<main className="px-4 pt-6 pb-16 md:px-6 md:pt-9">
				<h1 className="sr-only">Candidats</h1>
				<div className="mx-auto mb-6 flex max-w-[464px] justify-end sm:max-w-[640px]">
					<Link to="/recruiter/shortlist" className={`flex items-center gap-2 rounded-sm font-medium text-primary hover:underline ${focus}`}>
						<HeartIcon width={18} height={18} fill="currentColor" />
						Candidats retenus
					</Link>
				</div>
				{/* Succès et échec du ♥ annoncés aux lecteurs d'écran */}
				<p role="status" className="sr-only">
					{kept}
				</p>
				{keepError && (
					<p role="alert" className="mx-auto mb-4 max-w-[464px] rounded-[12px] bg-[#fef2f2] px-4 py-3 text-center text-[#b91c1c]">
						{keepError}
					</p>
				)}

				{result === null && (
					// Gray block with the shape of a card, while the candidates load
					<>
						<p role="status" className="sr-only">
							Chargement des candidats…
						</p>
						<div className="mx-auto h-[540px] max-w-[464px] rounded-[20px] bg-surface/60 motion-safe:animate-pulse" />
					</>
				)}

				{result?.ok === false && (
					<div role="alert" className={statePanel}>
						<p>{REQUEST_ERRORS[result.reason]}</p>
						<Button onClick={retry}>Réessayer</Button>
					</div>
				)}

				{result?.ok && result.candidates.length === 0 && !allKept && (
					<div className={statePanel}>
						<h2 className="text-2xl font-semibold">Aucun candidat pour le moment</h2>
						<p className="text-[#6b7280]">Les profils des étudiants apparaîtront ici.</p>
					</div>
				)}

				{result?.ok && result.candidates.length === 0 && allKept && (
					<div className={statePanel}>
						<h2 className="text-2xl font-semibold">Vous avez parcouru tous les candidats</h2>
						<p className="text-[#6b7280]">Retrouvez les profils que vous avez retenus dans votre présélection.</p>
						<Button to="/recruiter/shortlist">Voir les candidats retenus</Button>
					</div>
				)}

				{result?.ok && result.candidates.length > 0 && (
					<CandidateDeck
						candidates={result.candidates}
						index={cardIndex(result.candidates, params.get("candidate"))}
						onSelect={(index) => {
							setKeepError("");
							setParams({ candidate: String(result.candidates[index].id) }, { replace: true });
						}}
						onKeep={() => keep(result.candidates, cardIndex(result.candidates, params.get("candidate")))}
						keeping={keeping}
					/>
				)}
			</main>
		</div>
	);
}
