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

	if (rows.length === 0) return <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl bg-[#f9fafb] p-8 text-center">
		<h2 className="text-xl font-semibold">Aucune offre sauvegardée</h2>
		<p className="mt-2 max-w-md text-[15px] text-[#6b7280]">Les offres ajoutées avec le cœur apparaîtront ici.</p>
		<Link to="/offers" className={"mt-5 rounded-[14px] bg-primary px-5 py-3 font-semibold text-white " + focus}>Découvrir les offres</Link>
	</div>;

	return <ul className="flex flex-col gap-3" aria-label="Vos offres sauvegardées">
		{rows.map((offer) => {
			const savedAt = savedById.get(offer.id)!.savedAt;
			const city = offer.company?.city;
			const company = offer.company?.name || "Entreprise non renseignée";
			return <li key={offer.id} className="flex flex-col gap-4 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4 sm:flex-row sm:items-center">
				<Link to={"/offers/" + offer.id} className={"flex min-w-0 flex-1 items-center gap-3 " + focus}>
					<img src="/static/img/recruiter-offers/offer.webp" alt="" className="h-[68px] w-[96px] shrink-0 rounded-xl object-cover" />
					<span className="flex min-w-0 flex-col gap-1">
						<span className="truncate text-[18px] font-semibold text-[#111827]">{offer.title}</span>
						<span className="text-[14px] text-[#6b7280]">{company}{city && " • " + city}</span>
						<span className="text-[13px] text-[#9ca3af]">Ajoutée le {new Date(savedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</span>
					</span>
				</Link>
				<div className="flex shrink-0 items-center justify-end gap-2">
					<button type="button" onClick={() => onRemove(offer.id)} aria-label={"Retirer " + offer.title + " des offres sauvegardées"} className={"inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#d1d5db] bg-white px-4 text-[15px] font-semibold text-[#111827] hover:bg-gray-50 " + focus}>
						<img src="/static/img/offer-bookmarks/trash.svg" alt="" width="18" height="18" />Retirer
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
	return <div className="min-h-dvh bg-[#f0f0f0] px-4 pt-4 pb-16 text-[#111827] md:px-6 md:pt-[50px]">
		<header><StudentNavbar /></header>
		<main className="mx-auto mt-10 flex max-w-[1000px] flex-col gap-5 rounded-[25px] bg-white px-5 py-8 shadow-[0_4px_12px_rgba(0,0,0,0.1)] md:px-10 md:pt-8 md:pb-9">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-[28px] font-semibold leading-normal md:text-[32px]">Offres sauvegardées</h1>
					<p className="text-[15px] text-[#6b7280]">Les offres que vous avez aimées d’un ♥ ou d’un swipe à droite.</p>
				</div>
				<span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[13px] font-semibold text-[#6b7280]">{savedCount} {savedCount === 1 ? "offre" : "offres"}</span>
			</div>
			{error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
			{result === null || savedResult === null ? <p role="status">Chargement de vos offres sauvegardées…</p> : !result.ok || !savedResult.ok ? <div role="alert" className="flex flex-col items-start gap-3">
				<p>{result?.ok === false && result.reason === "network" || savedResult?.ok === false && savedResult.reason === "network" ? MESSAGES.networkError : MESSAGES.serverError}</p>
				<Button onClick={() => { setResult(null); setAttempt((value) => value + 1); }}>Réessayer</Button>
			</div> : <SavedOfferList offers={result.data} saved={saved} onRemove={remove} onApply={apply} applyingId={applyingId} />}
			<Link to="/offers" className={"w-fit font-semibold text-primary hover:underline " + focus}>← Retour aux offres</Link>
		</main>
	</div>;
}
