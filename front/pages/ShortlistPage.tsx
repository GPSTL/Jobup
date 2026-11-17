import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import Button from "../components/Button";
import { CandidateAvatar, EducationLine } from "../components/CandidateIdentity";
import HeartIcon from "../components/HeartIcon";
import RecruiterNavbar from "../components/RecruiterNavbar";
import { getShortlist, removeFromShortlist, type ShortlistedCandidate, type ShortlistResult } from "../services/candidates";
import { fullName } from "../utils/candidates";
import { focus } from "../utils/searchPageStyles";
import { REQUEST_ERRORS } from "../utils/validation";

const panel = "mx-auto flex max-w-[1236px] flex-col gap-6 rounded-2xl border border-[#e5e7eb] bg-surface p-5 shadow-xs md:p-8";
const action = `flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold ${focus}`;

type ShortlistCardProps = {
	candidate: ShortlistedCandidate;
	onRemove: () => void;
	/** Retrait en cours d'envoi */
	removing: boolean;
};

// Carte d'un candidat retenu (maquette « Candidats retenus »)
export function ShortlistCard({ candidate, onRemove, removing }: ShortlistCardProps) {
	const name = fullName(candidate);
	return (
		<li className="flex flex-col gap-3 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-5">
			<div className="flex items-start justify-between">
				<CandidateAvatar candidate={candidate} className="size-13 text-lg" />
				{/* Rappel du ♥ donné sur la carte : décoratif */}
				<HeartIcon width={22} height={22} fill="currentColor" className="text-[#dc2626]" />
			</div>
			<div>
				<h2 className="text-base sm:text-lg font-semibold">{name}</h2>
				<p className="text-xs sm:text-sm text-[#6b7280]">
					<EducationLine candidate={candidate} />
				</p>
			</div>
			{/* Offre pour laquelle il est retenu : pas encore renseignée (JOB-036) */}
			{candidate.offer && (
				<span className="w-fit rounded-full bg-[#dbeafe] px-3 py-1 text-xs font-semibold text-primary">
					Pour : {candidate.offer.title}
				</span>
			)}
			<div className="mt-auto flex items-center gap-2.5 pt-1">
				<Link to={`/recruiter/candidates/${candidate.id}`} className={`${action} flex-1 border border-[#d1d5db] bg-surface text-ink hover:bg-[#f9fafb]`}>
					Voir le profil<span className="sr-only"> de {name}</span>
				</Link>
				<button
					type="button"
					aria-disabled={removing}
					onClick={() => !removing && onRemove()}
					className={`${action} cursor-pointer text-[#dc2626] hover:bg-[#fef2f2] aria-disabled:cursor-wait aria-disabled:opacity-60`}
				>
					<span aria-hidden="true">✕</span> Retirer<span className="sr-only"> {name} des candidats retenus</span>
				</button>
			</div>
		</li>
	);
}

type ShortlistViewProps = {
	candidates: ShortlistedCandidate[];
	onRemove: (candidate: ShortlistedCandidate) => void;
	/** Candidat dont le retrait est en cours */
	removingId: number | null;
};

// Contenu de la page une fois la liste chargée : compteur, grille ou état vide
export function ShortlistView({ candidates, onRemove, removingId }: ShortlistViewProps) {
	if (candidates.length === 0) {
		return (
			<div className="flex flex-col items-center gap-3 py-10 text-center">
				<h2 className="text-xl font-semibold">Aucun candidat retenu pour le moment</h2>
				<p className="text-sm text-[#6b7280]">Retenez un profil avec ♥ depuis les cartes des candidats pour le retrouver ici.</p>
				<Button to="/recruiter/candidates">Parcourir les candidats</Button>
			</div>
		);
	}
	return (
		<ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{candidates.map((candidate) => (
				<ShortlistCard key={candidate.id} candidate={candidate} onRemove={() => onRemove(candidate)} removing={removingId === candidate.id} />
			))}
		</ul>
	);
}

// Présélection du recruteur (JOB-037, REC-03)
export default function ShortlistPage() {
	// null pendant le chargement
	const [result, setResult] = useState<ShortlistResult | null>(null);
	// Incrémenté par « Réessayer » pour recharger la liste
	const [attempt, setAttempt] = useState(0);
	const [removingId, setRemovingId] = useState<number | null>(null);
	const [removeError, setRemoveError] = useState("");
	const [removed, setRemoved] = useState("");

	useEffect(() => {
		// Ignore la réponse si la page a été quittée entre-temps
		let ignore = false;
		getShortlist().then((response) => {
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

	const remove = async (candidate: ShortlistedCandidate) => {
		if (removingId !== null) return;
		setRemovingId(candidate.id);
		setRemoveError("");
		setRemoved("");
		const response = await removeFromShortlist(candidate.id);
		setRemovingId(null);
		if (!response.ok) {
			if (response.reason === "unauthenticated") {
				setResult({ ok: false, reason: "unauthenticated" });
				return;
			}
			// La carte reste affichée pour pouvoir réessayer
			setRemoveError(`${fullName(candidate)} n’a pas pu être retiré. ${REQUEST_ERRORS[response.reason === "notFound" ? "server" : response.reason]}`);
			return;
		}
		setResult((current) => (current?.ok ? { ok: true, candidates: current.candidates.filter((other) => other.id !== candidate.id) } : current));
		setRemoved(`${fullName(candidate)} a été retiré de vos candidats retenus.`);
	};

	// Session expirée entre-temps
	if (result?.ok === false && result.reason === "unauthenticated") return <Navigate to="/login" replace />;

	const count = result?.ok ? result.candidates.length : 0;

	return (
		<div className="min-h-dvh bg-[#f8fafc] px-4 pt-4 pb-16 text-ink md:px-6 md:pt-6">
			<header>
				<RecruiterNavbar />
			</header>

			<main className="mt-8">
				<section aria-labelledby="shortlist-title" className={panel}>
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="flex flex-col gap-1">
							<h1 id="shortlist-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
								Candidats retenus
							</h1>
							<p className="text-sm sm:text-base text-[#6b7280]">
								Votre présélection : les profils que vous avez retenus avec{" "}
								<HeartIcon width={16} height={16} fill="currentColor" className="inline align-[-2px] text-[#dc2626]" />
								<span className="sr-only">♥</span>.
							</p>
						</div>
						{result?.ok && (
							<span className="rounded-full bg-[#f1f3f6] px-3 py-1 text-xs font-semibold text-[#6b7280]">
								{count} {count > 1 ? "candidats" : "candidat"}
							</span>
						)}
					</div>

					<p role="status" className="sr-only">
						{result === null ? "Chargement des candidats retenus…" : removed}
					</p>
					{removeError && (
						<p role="alert" className="rounded-xl bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
							{removeError}
						</p>
					)}

					{result === null && <div className="h-48 rounded-2xl bg-[#f1f3f6] motion-safe:animate-pulse" />}

					{result?.ok === false && (
						<div role="alert" className="flex flex-col items-center gap-4 py-10 text-center">
							<p className="text-sm">{REQUEST_ERRORS[result.reason]}</p>
							<Button onClick={retry}>Réessayer</Button>
						</div>
					)}

					{result?.ok && <ShortlistView candidates={result.candidates} onRemove={remove} removingId={removingId} />}
				</section>
			</main>
		</div>
	);
}
