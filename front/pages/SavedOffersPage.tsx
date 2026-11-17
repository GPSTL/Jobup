import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Button from "../components/Button";
import StudentNavbar from "../components/StudentNavbar";
import { saveDraft } from "../services/applications";
import { getOffers, type PublicOffer, type PublicOfferResult } from "../services/offers";
import { getSavedOffers, removeSavedOffer, type SavedOffer } from "../services/savedOffers";
import { MESSAGES } from "../utils/validation";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function SavedOfferList({
	offers,
	saved,
	onRemove,
	onApply,
	applyingId,
}: {
	offers: PublicOffer[];
	saved: SavedOffer[];
	onRemove: (id: number) => void;
	onApply: (offer: PublicOffer) => void;
	applyingId: number | null;
}) {
	const savedById = new Map(saved.map((item) => [item.offerId, item]));
	const rows = offers
		.filter((offer) => savedById.has(offer.id))
		.sort((a, b) => Date.parse(savedById.get(b.id)!.savedAt) - Date.parse(savedById.get(a.id)!.savedAt));

	if (rows.length === 0) return <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-8 text-center">
		<h2 className="text-lg font-semibold">Aucune offre sauvegardée</h2>
		<p className="mt-1.5 max-w-md text-sm text-[#6b7280]">Les offres ajoutées avec le cœur apparaîtront ici.</p>
		<Link to="/offers" className={"mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary " + focus}>Découvrir les offres</Link>
	</div>;

	return <ul className="flex flex-col gap-3" aria-label="Vos offres sauvegardées">
		{rows.map((offer) => {
			const savedAt = savedById.get(offer.id)!.savedAt;
			const city = offer.company?.city;
			const company = offer.company?.name || "Entreprise non renseignée";
			return <li key={offer.id} className="flex flex-col gap-4 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4 sm:flex-row sm:items-center">
				<Link to={"/offers/" + offer.id} className={"flex min-w-0 flex-1 items-center gap-3.5 " + focus}>
					<img src="/static/img/recruiter-offers/offer.webp" alt="" className="h-16 w-24 shrink-0 rounded-xl object-cover" />
					<span className="flex min-w-0 flex-col gap-0.5">
						<span className="truncate text-base font-semibold text-ink">{offer.title}</span>
						<span className="text-sm text-[#6b7280]">{company}{city && " • " + city}</span>
						<span className="text-xs text-[#9ca3af]">Ajoutée le {new Date(savedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</span>
					</span>
				</Link>
				<div className="flex shrink-0 items-center justify-end gap-2">
					<button type="button" onClick={() => onRemove(offer.id)} aria-label={"Retirer " + offer.title + " des offres sauvegardées"} className={"inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#d1d5db] bg-surface px-3.5 text-sm font-semibold text-ink hover:bg-[#f9fafb] " + focus}>
						<img src="/static/img/offer-bookmarks/trash.svg" alt="" width="16" height="16" />Retirer
					</button>
					<Button onClick={() => onApply(offer)} disabled={applyingId === offer.id}>{applyingId === offer.id ? "Préparation…" : "Postuler"}</Button>
				</div>
			</li>;
		})}
	</ul>;
}

export default function SavedOffersPage() {
	const navigate = useNavigate();
	const [saved, setSaved] = useState<SavedOffer[]>([]);
	const [savedResult, setSavedResult] = useState<{ ok: true } | { ok: false; reason: string } | null>(null);
	const [result, setResult] = useState<PublicOfferResult<PublicOffer[]> | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [applyingId, setApplyingId] = useState<number | null>(null);
	const [error, setError] = useState("");
	useEffect(() => {
		let ignore = false;
		getOffers().then((response) => { if (!ignore) setResult(response); });
		getSavedOffers().then((response) => {
			if (ignore) return;
			if (response.ok) {
				setSaved(response.data);
				setSavedResult({ ok: true });
			} else setSavedResult(response);
		});
		return () => { ignore = true; };
	}, [attempt]);
	const savedCount = useMemo(() => result?.ok ? saved.filter(({ offerId }) => result.data.some((offer) => offer.id === offerId)).length : saved.length, [result, saved]);
	const remove = async (id: number) => {
		const response = await removeSavedOffer(id);
		if (!response.ok) {
			setError("Impossible de retirer cette offre. Réessayez.");
			return;
		}
		setError("");
		setSaved((items) => items.filter((item) => item.offerId !== id));
	};
	const apply = async (offer: PublicOffer) => {
		if (applyingId !== null) return;
		setApplyingId(offer.id);
		setError("");
		const draft = await saveDraft(offer.id, "");
		setApplyingId(null);
		if (draft.ok) navigate("/applications/" + draft.application.id + "/edit");
		else if (draft.reason === "alreadySubmitted") setError("Vous avez déjà envoyé une candidature pour cette offre.");
		else if (draft.reason === "noSession") navigate("/login", { state: { studentReturnTo: "/student/saved-offers" } });
		else setError(draft.reason === "network" ? MESSAGES.networkError : MESSAGES.serverError);
	};
	return <div className="min-h-dvh bg-[#f8fafc] px-4 pt-4 pb-16 text-ink md:px-6 md:pt-6">
		<header><StudentNavbar /></header>
		<main className="mx-auto mt-8 flex max-w-[1000px] flex-col gap-5 rounded-2xl border border-[#e5e7eb] bg-surface px-5 py-7 shadow-xs md:px-10 md:py-8">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Offres sauvegardées</h1>
					<p className="mt-1 text-sm text-[#6b7280]">Les offres que vous avez aimées d’un ♥ ou d’un swipe à droite.</p>
				</div>
				<span className="rounded-full bg-[#f3f4f6] px-3 py-1 text-xs font-semibold text-[#6b7280]">{savedCount} {savedCount === 1 ? "offre" : "offres"}</span>
			</div>
			{error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
			{result === null || savedResult === null ? <p role="status" className="text-sm text-[#6b7280]">Chargement de vos offres sauvegardées…</p> : !result.ok || !savedResult.ok ? <div role="alert" className="flex flex-col items-start gap-3">
				<p className="text-sm">{result?.ok === false && result.reason === "network" || savedResult?.ok === false && savedResult.reason === "network" ? MESSAGES.networkError : MESSAGES.serverError}</p>
				<Button onClick={() => { setResult(null); setAttempt((value) => value + 1); }}>Réessayer</Button>
			</div> : <SavedOfferList offers={result.data} saved={saved} onRemove={remove} onApply={apply} applyingId={applyingId} />}
			<Link to="/offers" className={"w-fit text-sm font-semibold text-primary hover:underline " + focus}>← Retour aux offres</Link>
		</main>
	</div>;
}
