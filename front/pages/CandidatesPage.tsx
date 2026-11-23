import { filterRecommendations } from "../utils/recommendations";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import RecommendationSwitch from "../components/RecommendationSwitch";
import Button from "../components/Button";
import CandidateCard from "../components/CandidateCard";
import CandidateFilterPanel, { NoMatchingCandidates } from "../components/CandidateFilters";
import HeartIcon from "../components/HeartIcon";
import RecruiterNavbar from "../components/RecruiterNavbar";
import {
	excludeCandidate,
	filterQuery,
	getCandidates,
	getCandidateRecommendations,
	getFilterOptions,
	keepCandidate,
	type CandidateFilters,
	type CandidateSummary,
	type CandidatesResult,
	type FilterOptions,
	type RecommendedCandidate,
} from "../services/candidates";
import { filtersFromParams, hasFilters, NO_FILTERS, withCandidate, withFilters } from "../utils/candidateFilters";
import { cardIndex, fullName, swipeAction } from "../utils/candidates";
import { focus } from "../utils/searchPageStyles";
import { REQUEST_ERRORS } from "../utils/validation";

const shadow = "shadow-xs border border-[#e5e7eb]";
const statePanel = `mx-auto flex max-w-[464px] flex-col items-center gap-4 rounded-2xl bg-surface p-8 text-center ${shadow}`;

type CandidateDeckProps = {
	candidates: CandidateSummary[];
	recommended?: RecommendedCandidate[];
	highlightTerms?: string[];
	/** Index of the card shown */
	index: number;
	/** ♥ sur la carte affichée (JOB-037) */
	onKeep?: () => void;
	keeping?: boolean;
	/** 🚫 sur la carte affichée (JOB-038) */
	onExclude?: () => void;
	excluding?: boolean;
};

// Cards shown one at a time, the next one peeking out underneath (mockup "Swipe – carte 2").
// ♥ and 🚫 (JOB-037, JOB-038) take the card out of the deck and show the next one.
// Swiping the card to the right does the same as ♥, to the left the same as 🚫.
export function CandidateDeck({ candidates, index, onKeep, keeping, onExclude, excluding, recommended = [], highlightTerms = [] }: CandidateDeckProps) {
	const candidate = candidates[index];
	const currentRecommendation = recommended.find((item) => item.id === candidate.id);
	const hasNext = index < candidates.length - 1;
	const busy = keeping || excluding;
	const swipeStart = useRef<number | null>(null);
	// Offset of the card while it is dragged; a drag is not a click on the link that covers the card
	const [drag, setDrag] = useState(0);
	const dragged = useRef(false);

	// The pointer is captured only once the card moves, so that a simple click still reaches the links
	const moveSwipe = (event: PointerEvent<HTMLElement>) => {
		if (swipeStart.current === null || busy) return;
		const distance = event.clientX - swipeStart.current;
		if (!dragged.current && Math.abs(distance) > 8) {
			dragged.current = true;
			event.currentTarget.setPointerCapture(event.pointerId);
		}
		if (dragged.current) setDrag(distance);
	};
	const endSwipe = (event: PointerEvent<HTMLElement>) => {
		if (swipeStart.current === null) return;
		const distance = event.clientX - swipeStart.current;
		swipeStart.current = null;
		setDrag(0);
		if (event.type === "pointercancel") return;
		const action = swipeAction(distance);
		if (action === "keep") onKeep?.();
		else if (action === "exclude") onExclude?.();
	};

	return (
		<div className="mx-auto flex max-w-[480px] flex-col gap-4">
			<p role="status" className="sr-only">
				Candidat {index + 1} sur {candidates.length}
				<span> : {fullName(candidate)}</span>
			</p>

			<div className={`relative isolate ${hasNext ? "student-swipe-stack" : ""}`}>
				{hasNext && <div aria-hidden="true" className="absolute inset-x-3 top-3 bottom-20 -z-10 rounded-[2rem] bg-[#edf1f7] candidate-stack-back" />}
				<div
					onPointerDown={(event) => {
						if (busy || event.button !== 0 || (event.target as HTMLElement).closest("button, [download]")) return;
						swipeStart.current = event.clientX;
						dragged.current = false;
					}}
					onPointerMove={moveSwipe}
					onPointerUp={endSwipe}
					onPointerCancel={endSwipe}
					// The link and the picture would start a native drag, which cancels the swipe
					onDragStart={(event) => event.preventDefault()}
					onClickCapture={(event) => {
						if (dragged.current) event.preventDefault();
						dragged.current = false;
					}}
					style={{ transform: `translateX(${drag}px) rotate(${drag / 25}deg)` }}
					className="relative touch-pan-y"
				>
					{Math.abs(drag) > 25 && (
						<span aria-hidden="true" className={`pointer-events-none absolute top-4 z-20 rounded-xl border-2 bg-surface px-3 py-2 text-sm font-bold ${drag > 0 ? "right-4 border-primary text-primary" : "left-4 border-[#b91c1c] text-[#b91c1c]"}`}>
							{drag > 0 ? "♥ Retenir" : "Écarter"}
						</span>
					)}
					<CandidateCard matchPercentage={currentRecommendation?.match_percentage} reasons={currentRecommendation?.reasons} highlightTerms={highlightTerms} candidate={candidate} onKeep={onKeep} keeping={keeping} onExclude={onExclude} excluding={excluding} />
				</div>
			</div>
			{(onKeep || onExclude) && (
				<p className="text-center text-xs text-[#6b7280] sm:text-sm">
					Glissez à gauche pour écarter, à droite pour retenir.
				</p>
			)}
		</div>
	);
}

// "Candidats" tab of the recruiter (JOB-035, REC-01), with its filters (JOB-036, REC-02)
export default function CandidatesPage() {
	// null while the candidates load
	const [result, setResult] = useState<CandidatesResult | null>(null);
	// Incremented by "Réessayer" to load the candidates again
	const [attempt, setAttempt] = useState(0);
	// The card shown and the criteria of the search are kept in the URL, so that "Retour aux candidats"
	// on the profile comes back to them
	const [params, setParams] = useSearchParams();
	const applied = filtersFromParams(params);
	// Same string for the same criteria: the search is run again only when they change
	const query = filterQuery(applied);
	// Values of the lists of the filters (JOB-036)
	const [options, setOptions] = useState<FilterOptions | null>(null);
	const [optionsError, setOptionsError] = useState("");
	const [optionsAttempt, setOptionsAttempt] = useState(0);
	// ♥ ou 🚫 en cours d'envoi, message d'échec et annonce du succès (JOB-037, JOB-038)
	const [pending, setPending] = useState<"keep" | "exclude" | null>(null);
	const [actionError, setActionError] = useState("");
	const [announcement, setAnnouncement] = useState("");
	// Toutes les cartes ont été retenues ou écartées : un message différent de « aucun candidat »
	const [allDone, setAllDone] = useState(false);
	const [onlyRecommended, setOnlyRecommended] = useState(true);
	const [recommended, setRecommended] = useState<RecommendedCandidate[] | null>(null);
	const [recommendationError, setRecommendationError] = useState(false);
	const [recommendationAttempt, setRecommendationAttempt] = useState(0);

	useEffect(() => {
		let ignore = false;
		getCandidateRecommendations().then((response) => {
			if (ignore) return;
			if (response.ok) setRecommended(response.data);
			else setRecommendationError(true);
		});
		return () => { ignore = true; };
	}, [recommendationAttempt]);

	useEffect(() => {
		// Ignores the answer if the page was left, or the criteria changed, in the meantime
		let ignore = false;
		// New search, from the button, a filter chip or the arrows of the browser
		setResult(null);
		setAllDone(false);
		setActionError("");
		getCandidates(filtersFromParams(new URLSearchParams(query))).then((response) => {
			if (!ignore) setResult(response);
		});
		return () => {
			ignore = true;
		};
	}, [attempt, query]);

	useEffect(() => {
		let ignore = false;
		setOptionsError("");
		getFilterOptions().then((response) => {
			if (ignore) return;
			if (response.ok) setOptions(response.options);
			// Session expired: back to the login page, as for the cards
			else if (response.reason === "unauthenticated") setResult(response);
			else setOptionsError(`Les listes des filtres n’ont pas pu être chargées. ${REQUEST_ERRORS[response.reason]}`);
		});
		return () => {
			ignore = true;
		};
	}, [optionsAttempt]);

	const retry = () => {
		setResult(null);
		setAttempt(attempt + 1);
	};

	// "Rechercher les candidats", a chip removed or "Réinitialiser": a new entry in the history, so that
	// the "back" arrow of the browser gives the previous search back
	const search = (filters: CandidateFilters) => setParams(withFilters(params, filters));

	// ♥ (retenir) ou 🚫 (écarter) sur la carte affichée : la carte quitte la pile et la suivante s'affiche
	const dismiss = async (kind: "keep" | "exclude", candidates: CandidateSummary[], index: number) => {
		if (pending) return;
		const candidate = candidates[index];
		setPending(kind);
		setActionError("");
		setAnnouncement("");
		const response = await (kind === "keep" ? keepCandidate : excludeCandidate)(candidate.id);
		setPending(null);
		if (!response.ok) {
			if (response.reason === "unauthenticated") {
				// Session expirée : retour à la connexion, comme au chargement des cartes
				setResult({ ok: false, reason: "unauthenticated" });
				return;
			}
			// Un candidat devenu indisponible n'a plus rien à faire dans la pile quand on voulait l'écarter
			if (!(kind === "exclude" && response.reason === "notFound")) {
				// La carte reste affichée : le recruteur peut réessayer avec le même bouton
				const failed = kind === "keep" ? "retenu" : "écarté";
				setActionError(
					response.reason === "notFound"
						? `${fullName(candidate)} n’est plus disponible.`
						: `${fullName(candidate)} n’a pas pu être ${failed}. ${REQUEST_ERRORS[response.reason]}`,
				);
				return;
			}
		}
		// Carte suivante : celle qui prend la place de la carte retirée, ou la précédente s'il s'agissait de la dernière
		const rest = candidates.filter((other) => other.id !== candidate.id);
		setRecommended((current) => current?.filter((item) => item.id !== candidate.id) ?? null);
		setResult((current) => current?.ok ? { ok: true, candidates: current.candidates.filter((other) => other.id !== candidate.id) } : current);
		setAnnouncement(
			kind === "keep"
				? `${fullName(candidate)} a été ajouté à vos candidats retenus.`
				: `${fullName(candidate)} a été écarté de vos candidats.`,
		);
		if (rest.length === 0) setAllDone(true);
		else setParams(withCandidate(params, rest[Math.min(index, rest.length - 1)].id), { replace: true });
	};

	const visibleCandidates = result?.ok ? filterRecommendations(result.candidates, recommended, onlyRecommended) : [];

	// Session expired in the meantime
	if (result?.ok === false && result.reason === "unauthenticated") return <Navigate to="/login" replace />;

	return (
		<div className="min-h-dvh bg-[#f8fafc] px-4 pt-4 pb-16 text-ink md:px-6 md:pt-6">
			<header>
				<RecruiterNavbar />
			</header>

			<main className="mx-auto mt-6 max-w-[1100px] lg:mt-10">

				{/* Large screens: the filters on the left of the cards, as in the mockup. Small screens: above them */}
				<div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-12">
					<div><div className="mb-5 hidden lg:block"><p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">Découvrir</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Trouvez votre prochain talent.</h1><p className="mt-2 text-sm leading-relaxed text-gray-500">Découvrez les profils et retenez ceux qui vous intéressent.</p></div><details className="lg:hidden"><summary className="cursor-pointer rounded-2xl border border-gray-200 bg-surface px-5 py-4 font-semibold">Affiner ma recherche</summary><div className="mt-3"><CandidateFilterPanel key={`mobile-${query}`} applied={applied} options={options} optionsError={optionsError} onRetryOptions={() => setOptionsAttempt(optionsAttempt + 1)} onSearch={search} count={result?.ok ? visibleCandidates.length : null} /></div></details><div className="hidden lg:block"><CandidateFilterPanel
						key={query}
						applied={applied}
						options={options}
						optionsError={optionsError}
						onRetryOptions={() => setOptionsAttempt(optionsAttempt + 1)}
						onSearch={search}
						count={result?.ok ? visibleCandidates.length : null}
						className="lg:w-[320px] lg:shrink-0"
					/></div></div>
					<div className="mx-auto w-full min-w-0 max-w-[480px]">
						<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
							<h2 className="text-2xl font-extrabold tracking-tight">{onlyRecommended ? "Candidats pour vous" : "Tous les candidats"}</h2>
							<Link to="/recruiter/shortlist" className={`flex items-center gap-2 rounded-sm text-sm font-semibold text-primary hover:underline ${focus}`}>
								<HeartIcon width={18} height={18} fill="currentColor" />
								Candidats retenus
							</Link>
						</div>
						<div className="mb-4"><RecommendationSwitch checked={onlyRecommended} disabled={pending !== null || (recommended === null && !recommendationError)} onChange={(checked) => { setOnlyRecommended(checked); setAllDone(false); }} /></div>
						{recommendationError ? <p role="alert" className="mb-4">Impossible de charger les recommandations. <button className="text-primary underline" onClick={() => { setRecommendationError(false); setRecommendationAttempt((n) => n + 1); }}>Réessayer</button></p> : recommended === null && <p role="status" className="mb-4">Chargement des recommandations…</p>}
						{/* Succès du ♥ ou du 🚫 annoncé aux lecteurs d'écran */}
						<p role="status" className="sr-only">
							{announcement}
						</p>
						{actionError && (
							<p role="alert" className="mx-auto mb-4 max-w-[464px] rounded-xl bg-[#fef2f2] px-4 py-3 text-center text-sm text-[#b91c1c]">
								{actionError}
							</p>
						)}

						{result === null && (
							// Gray block with the shape of a card, while the candidates load
							<>
								<p role="status" className="sr-only">
									Chargement des candidats…
								</p>
								<div className="mx-auto h-[520px] max-w-[464px] rounded-2xl bg-surface/60 motion-safe:animate-pulse" />
							</>
						)}

						{result?.ok === false && (
							<div role="alert" className={statePanel}>
								<p className="text-sm">{REQUEST_ERRORS[result.reason]}</p>
								<Button onClick={retry}>Réessayer</Button>
							</div>
						)}

						{result?.ok && visibleCandidates.length === 0 && !allDone && !hasFilters(applied) && (
							<div className={statePanel}>
								<h2 className="text-xl font-semibold">{onlyRecommended ? "Aucun candidat recommandé pour le moment" : "Aucun candidat pour le moment"}</h2>
								<p className="text-sm text-[#6b7280]">{onlyRecommended ? "Publiez une offre avec ses critères ou désactivez les recommandations pour voir tous les profils." : "Les profils des étudiants apparaîtront ici."}</p>
							</div>
						)}

						{result?.ok && visibleCandidates.length === 0 && !allDone && hasFilters(applied) && (
							<NoMatchingCandidates
								filters={applied}
								options={options}
								onRemove={(key) => search({ ...applied, [key]: "" })}
								onReset={() => search(NO_FILTERS)}
							/>
						)}

						{result?.ok && visibleCandidates.length === 0 && allDone && (
							<div className={statePanel}>
								{/* Le bouton de la dernière carte vient de disparaître : le focus clavier se pose ici */}
								<h2 ref={(heading) => heading?.focus()} tabIndex={-1} className="text-xl font-semibold outline-none">
									Vous avez parcouru tous les candidats
								</h2>
								<p className="text-sm text-[#6b7280]">Retrouvez les profils que vous avez retenus dans votre présélection. Ceux que vous avez écartés n’apparaîtront plus.</p>
								<Button to="/recruiter/shortlist">Voir les candidats retenus</Button>
							</div>
						)}

						{result?.ok && visibleCandidates.length > 0 && (
							<CandidateDeck
								recommended={recommended ?? []}
								highlightTerms={[applied.position, applied.skill, applied.region].filter(Boolean)}
								candidates={visibleCandidates}
								index={cardIndex(visibleCandidates, params.get("candidate"))}

								onKeep={() => dismiss("keep", visibleCandidates, cardIndex(visibleCandidates, params.get("candidate")))}
								keeping={pending === "keep"}
								onExclude={() => dismiss("exclude", visibleCandidates, cardIndex(visibleCandidates, params.get("candidate")))}
								excluding={pending === "exclude"}
							/>
						)}
					</div>
				</div>
			</main>
		</div>
	);
}
