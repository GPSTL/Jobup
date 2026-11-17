import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { Link } from "react-router-dom";

import BanIcon from "../components/BanIcon";
import ChevronDownIcon from "../components/ChevronDownIcon";
import HeartIcon from "../components/HeartIcon";
import MapPinIcon from "../components/MapPinIcon";
import SearchIcon from "../components/SearchIcon";
import type { PublicOffer, PublicOfferFilters } from "../services/offers";
import { SECTOR_OPTIONS } from "../utils/companies";
import { filterPublicOffers } from "../services/offers";
import { getSavedOffers, saveOffer } from "../services/savedOffers";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function EditIcon() {
	return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6"><path d="m15 5 4 4M4 20l4.5-1 11-11a2.12 2.12 0 0 0-3-3l-11 11L4 20Z" /></svg>;
}

function FilterIcon() {
	return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]"><path d="M4 5h16M7 12h10m-7 7h4" /></svg>;
}

function SavedOffersButton({ count }: { count: number }) {
	return <Link to="/student/saved-offers" className={`flex items-center gap-2 rounded-sm text-sm font-semibold text-primary hover:underline ${focus}`}>
		<HeartIcon width={18} height={18} fill="currentColor" />Offres sauvegardées ({count})
	</Link>;
}

function OfferFilters({
	offers,
	onApply,
}: {
	offers: PublicOffer[];
	onApply: (filters: PublicOfferFilters) => void;
}) {
	const [query, setQuery] = useState("");
	const [city, setCity] = useState("");
	const [sector, setSector] = useState("");
	const [filters, setFilters] = useState<PublicOfferFilters>({ query: "", city: "", sector: "" });
	const count = filterPublicOffers(offers, filters).length;
	const apply = (event: FormEvent) => {
		event.preventDefault();
		const next = { query, city, sector };
		setFilters(next);
		onApply(next);
	};
	const reset = () => {
		setQuery("");
		setCity("");
		setSector("");
		setFilters({ query: "", city: "", sector: "" });
		onApply({ query: "", city: "", sector: "" });
	};

	return <form onSubmit={apply} aria-label="Filtres des offres" className="flex w-full flex-col gap-4 rounded-2xl border border-[#e5e7eb] bg-surface p-6 shadow-xs lg:w-[320px]">
		<div className="flex items-center gap-2 text-lg font-semibold"><FilterIcon />Filtres</div>
		<label className="flex flex-col gap-1.5 text-sm font-medium">
			Secteur d’activité
			<span className="relative flex items-center">
				<select value={sector} onChange={(event) => setSector(event.target.value)} className="w-full appearance-none rounded-xl border border-[#d1d5db] bg-surface py-2.5 pr-10 pl-3.5 text-sm font-normal text-ink outline-none focus:border-primary">
					<option value="">Sélectionnez un secteur</option>
					{SECTOR_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
				</select>
				<ChevronDownIcon className="pointer-events-none absolute right-3 size-[18px] text-[#6b7280]" />
			</span>
		</label>
		<label className="flex flex-col gap-1.5 text-sm font-medium">
			Poste recherché
			<span className="flex items-center gap-2 rounded-xl border border-[#d1d5db] bg-surface px-3.5 py-2.5 focus-within:border-primary">
				<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex. développeur, designer…" className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-[#9ca3af]" />
				<SearchIcon width={18} height={18} className="shrink-0 text-[#6b7280]" />
			</span>
		</label>
		<label className="flex flex-col gap-1.5 text-sm font-medium">
			Lieu de travail
			<span className="flex items-center gap-2 rounded-xl border border-[#d1d5db] bg-surface px-3.5 py-2.5 focus-within:border-primary">
				<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ville ou code postal" className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-[#9ca3af]" />
				<MapPinIcon className="shrink-0 text-[#6b7280]" />
			</span>
		</label>
		<div className="flex gap-2.5 pt-1">
			<button type="button" onClick={reset} className={`flex-1 rounded-xl border border-[#d1d5db] bg-surface py-2.5 text-sm font-semibold hover:bg-[#f9fafb] ${focus}`}>Réinitialiser</button>
			<button type="submit" className={`flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-on-primary hover:bg-primary/90 ${focus}`}>Appliquer</button>
		</div>
		<p className="text-xs text-[#6b7280]">Aucun filtre obligatoire • {count} {count === 1 ? "offre" : "offres"}</p>
	</form>;
}

export default function StudentOfferSwipe({ offers }: { offers: PublicOffer[] }) {
	const [filters, setFilters] = useState<PublicOfferFilters>({ query: "", city: "", sector: "" });
	const [seen, setSeen] = useState<number[]>([]);
	const [saved, setSaved] = useState<number[]>([]);
	const [savedError, setSavedError] = useState("");
	const [saving, setSaving] = useState(false);
	useEffect(() => {
		let ignore = false;
		getSavedOffers().then((result) => {
			if (ignore) return;
			if (result.ok) setSaved(result.data.map((item) => item.offerId));
			else setSavedError("Impossible de charger tes offres sauvegardées.");
		});
		return () => { ignore = true; };
	}, []);
	const swipeStart = useRef<number | null>(null);
	const cardRef = useRef<HTMLElement>(null);
	const busyRef = useRef(false);
	const [drag, setDrag] = useState(0);
	const matchingOffers = useMemo(() => filterPublicOffers(offers, filters), [offers, filters]);
	const current = matchingOffers.find((offer) => !seen.includes(offer.id));
	const remaining = matchingOffers.filter((offer) => !seen.includes(offer.id)).length;
	const markSeen = async (offer: PublicOffer, like: boolean) => {
		if (busyRef.current) return;
		busyRef.current = true;
		if (like) {
			setSaving(true);
			const result = await saveOffer(offer.id);
			setSaving(false);
			if (!result.ok) {
				setSavedError("Impossible d’enregistrer cette offre. Réessaie.");
				busyRef.current = false;
				setDrag(0);
				return;
			}
			setSavedError("");
			setSaved((items) => items.includes(offer.id) ? items : [...items, offer.id]);
		}
		const card = cardRef.current;
		if (card && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			const direction = like ? 1 : -1;
			await card.animate([
				{ transform: `translateX(${drag}px) rotate(${drag / 25}deg)`, opacity: 1 },
				{ transform: `translateX(${direction * 360}px) rotate(${direction * 18}deg)`, opacity: 0 },
			], { duration: 260, easing: "ease-in", fill: "forwards" }).finished.catch(() => {});
		}
		setDrag(0);
		busyRef.current = false;
		setSeen((items) => [...items, offer.id]);
	};
	const startSwipe = (event: PointerEvent<HTMLElement>) => {
		if (busyRef.current || event.button !== 0) return;
		if ((event.target as HTMLElement).closest("a, button, input, select")) return;
		swipeStart.current = event.clientX;
		event.currentTarget.setPointerCapture(event.pointerId);
	};
	const finishSwipe = (event: PointerEvent<HTMLElement>) => {
		if (!current || swipeStart.current === null) return;
		const distance = event.clientX - swipeStart.current;
		swipeStart.current = null;
		if (distance > 90) markSeen(current, true);
		else if (distance < -90) markSeen(current, false);
		else setDrag(0);
	};
	const resetSeen = () => setSeen([]);

	return <div className="mx-auto mt-8 grid max-w-[1236px] items-start gap-6 pb-12 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-8">
		<OfferFilters offers={offers} onApply={(next) => { setFilters(next); setSeen([]); }} />
		<section aria-label="Découvrir les offres" aria-live="polite" className="mx-auto w-full max-w-[480px] lg:col-start-2">
			<div className="mx-auto mb-4 flex max-w-[480px] justify-end">
				<SavedOffersButton count={saved.length} />
			</div>
			{savedError && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{savedError}</p>}
			{current ? <article ref={cardRef} key={current.id} onPointerDown={startSwipe} onPointerMove={event => { if (swipeStart.current !== null && !busyRef.current) setDrag(event.clientX - swipeStart.current); }} onPointerCancel={() => { swipeStart.current = null; setDrag(0); }} onPointerUp={finishSwipe} style={{ transform: `translateX(${drag}px) rotate(${drag / 25}deg)` }} className="student-swipe-card relative flex min-h-[560px] touch-pan-y flex-col items-center gap-4 rounded-2xl border border-[#e5e7eb] bg-surface p-6 shadow-xs sm:p-7">
				<div className="w-full text-center">
					<h1 className="text-xl leading-tight font-bold text-ink sm:text-2xl">{current.title}</h1>
					<p className="mt-1.5 text-sm font-medium text-[#6b7280] sm:text-base">{current.company?.name || "Entreprise non renseignée"}{current.company?.city && ` • ${current.company.city}`}</p>
				</div>
				{Math.abs(drag) > 25 && <span aria-hidden="true" className={`pointer-events-none absolute top-4 z-10 rounded-xl border-2 bg-surface px-3 py-2 text-sm font-bold ${drag > 0 ? "right-4 border-primary text-primary" : "left-4 border-red-600 text-red-600"}`}>{drag > 0 ? "♥ Sauvegarder" : "Passer"}</span>}
				<img draggable={false} src="/static/img/recruiter-offers/offer.webp" alt="Une équipe échange autour d’une table dans ses bureaux" className="h-56 w-full rounded-xl object-cover sm:h-64" />
				<div className="w-full text-sm leading-relaxed text-[#4b5563] sm:text-base">
					<p className="line-clamp-5 whitespace-pre-line">{current.description || current.requirements || "Découvrez cette offre d’alternance et son équipe."}</p>
					<Link to={`/offers/${current.id}`} className={`mt-2.5 inline-block text-sm font-semibold text-primary hover:underline ${focus}`}>Plus d’informations</Link>
				</div>
				<div className="mt-auto flex w-full flex-wrap items-center justify-center gap-3 border-t border-[#e5e7eb] pt-4">
					<button type="button" onClick={() => void markSeen(current, false)} aria-label={`Passer l’offre ${current.title}`} disabled={saving} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#e5e7eb] px-4 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 ${focus}`}><BanIcon className="size-5" />Passer</button>
					<Link to="/student" aria-label="Modifier mon CV et mes documents" title="Modifier mon CV et mes documents" className={`flex size-12 items-center justify-center rounded-full border border-[#e5e7eb] text-primary transition-colors hover:bg-[#dbeafe] ${focus}`}><EditIcon /></Link>
					<button type="button" onClick={() => void markSeen(current, true)} aria-label={`Sauvegarder l’offre ${current.title}`} aria-disabled={saving} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/90 aria-disabled:opacity-60 ${focus}`}><HeartIcon className="size-5 fill-current" />{saving ? "Enregistrement…" : "Sauvegarder"}</button>
				</div>
			</article> : <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-[#e5e7eb] bg-surface p-8 text-center shadow-xs">
				<h1 className="text-xl font-semibold">{matchingOffers.length ? "Tu as vu toutes les offres !" : "Aucune offre ne correspond à tes filtres."}</h1>
				<p className="mt-2 text-sm text-[#6b7280]">{saved.length ? `${saved.length} offre${saved.length > 1 ? "s" : ""} sauvegardée${saved.length > 1 ? "s" : ""} sur cet appareil.` : "Modifie tes filtres ou reviens découvrir les offres."}</p>
				{matchingOffers.length > 0 && <button type="button" onClick={resetSeen} className={`mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary ${focus}`}>Revoir les offres</button>}
			</div>}
			{current && <p className="mt-3 text-center text-xs sm:text-sm text-[#6b7280]">Glisse à gauche pour passer, à droite pour sauvegarder. • {remaining} {remaining === 1 ? "offre" : "offres"} à découvrir</p>}
		</section>
	</div>;
}
