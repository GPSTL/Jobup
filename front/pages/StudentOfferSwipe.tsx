import { useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { Link } from "react-router-dom";

import BanIcon from "../components/BanIcon";
import ChevronDownIcon from "../components/ChevronDownIcon";
import HeartIcon from "../components/HeartIcon";
import MapPinIcon from "../components/MapPinIcon";
import SearchIcon from "../components/SearchIcon";
import type { PublicOffer, PublicOfferFilters } from "../services/offers";
import { SECTOR_OPTIONS } from "../utils/companies";
import { filterPublicOffers } from "../services/offers";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

function EditIcon() {
	return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-8"><path d="m15 5 4 4M4 20l4.5-1 11-11a2.12 2.12 0 0 0-3-3l-11 11L4 20Z" /></svg>;
}

function FilterIcon() {
	return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]"><path d="M4 5h16M7 12h10m-7 7h4" /></svg>;
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

	return <form onSubmit={apply} aria-label="Filtres des offres" className="flex w-full flex-col gap-3.5 rounded-[22px] bg-white p-6 shadow-[0_4px_6px_rgba(0,0,0,0.1)] lg:w-[320px]">
		<div className="flex items-center gap-2 text-[20px] font-semibold"><FilterIcon />Filtres</div>
		<label className="flex flex-col gap-1.5 text-[14px] font-semibold">
			Secteur d’activité
			<span className="relative flex items-center">
				<select value={sector} onChange={(event) => setSector(event.target.value)} className="w-full appearance-none rounded-[12px] border border-[#d1d5db] bg-white py-2.5 pr-10 pl-3.5 text-[15px] font-normal text-[#6b7280]">
					<option value="">Sélectionnez un secteur</option>
					{SECTOR_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
				</select>
				<ChevronDownIcon className="pointer-events-none absolute right-3 size-[18px] text-[#6b7280]" />
			</span>
		</label>
		<label className="flex flex-col gap-1.5 text-[14px] font-semibold">
			Poste recherché
			<span className="flex items-center gap-2 rounded-[12px] border border-[#d1d5db] px-3.5 py-2.5">
				<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex. développeur, designer…" className="min-w-0 flex-1 text-[15px] font-normal outline-none placeholder:text-[#9ca3af]" />
				<SearchIcon width={18} height={18} className="shrink-0 text-[#6b7280]" />
			</span>
		</label>
		<label className="flex flex-col gap-1.5 text-[14px] font-semibold">
			Lieu de travail
			<span className="flex items-center gap-2 rounded-[12px] border border-[#d1d5db] px-3.5 py-2.5">
				<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ville ou code postal" className="min-w-0 flex-1 text-[15px] font-normal outline-none placeholder:text-[#9ca3af]" />
				<MapPinIcon className="shrink-0 text-[#6b7280]" />
			</span>
		</label>
		<div className="flex gap-2.5 pt-1">
			<button type="button" onClick={reset} className={`flex-1 rounded-[12px] border border-[#d1d5db] bg-white py-3 text-[15px] font-semibold hover:bg-gray-50 ${focus}`}>Réinitialiser</button>
			<button type="submit" className={`flex-1 rounded-[12px] bg-primary py-3 text-[15px] font-semibold text-white hover:bg-blue-600 ${focus}`}>Appliquer</button>
		</div>
		<p className="text-[13px] text-[#6b7280]">Aucun filtre obligatoire • {count} {count === 1 ? "offre" : "offres"}</p>
	</form>;
}

export default function StudentOfferSwipe({ offers }: { offers: PublicOffer[] }) {
	const [filters, setFilters] = useState<PublicOfferFilters>({ query: "", city: "", sector: "" });
	const [seen, setSeen] = useState<number[]>([]);
	const [saved, setSaved] = useState<number[]>([]);
	const swipeStart = useRef<number | null>(null);
	const matchingOffers = useMemo(() => filterPublicOffers(offers, filters), [offers, filters]);
	const current = matchingOffers.find((offer) => !seen.includes(offer.id));
	const remaining = matchingOffers.filter((offer) => !seen.includes(offer.id)).length;
	const markSeen = (offer: PublicOffer, like: boolean) => {
		if (like) setSaved((items) => items.includes(offer.id) ? items : [...items, offer.id]);
		setSeen((items) => [...items, offer.id]);
	};
	const startSwipe = (event: PointerEvent<HTMLElement>) => {
		if ((event.target as HTMLElement).closest("a, button, input, select")) return;
		swipeStart.current = event.clientX;
	};
	const finishSwipe = (event: PointerEvent<HTMLElement>) => {
		if (!current || swipeStart.current === null) return;
		const distance = event.clientX - swipeStart.current;
		swipeStart.current = null;
		if (distance > 90) markSeen(current, true);
		else if (distance < -90) markSeen(current, false);
	};
	const resetSeen = () => setSeen([]);

	return <div className="mx-auto mt-8 grid max-w-[1236px] items-start gap-6 pb-12 lg:grid-cols-[320px_minmax(0,464px)_1fr] lg:gap-0">
		<OfferFilters offers={offers} onApply={(next) => { setFilters(next); setSeen([]); }} />
		<section aria-label="Découvrir les offres" aria-live="polite" className="mx-auto w-full max-w-[464px] lg:col-start-2 lg:ml-[226px]">
			{current ? <article onPointerDown={startSwipe} onPointerUp={finishSwipe} className="flex min-h-[620px] touch-pan-y flex-col items-center gap-[15px] rounded-[25px] bg-white px-6 py-8 shadow-[0_4px_12px_rgba(0,0,0,0.1)] sm:px-[28px]">
				<h1 className="w-full text-center text-[30px] leading-[1] font-semibold text-black sm:text-[36px]">{current.title}</h1>
				<p className="w-full text-center text-[19px] font-medium text-black sm:text-[24px]">{current.company?.name || "Entreprise non renseignée"}{current.company?.city && ` • ${current.company.city}`}</p>
				<img src="/static/img/recruiter-offers/offer.webp" alt="Une équipe échange autour d’une table dans ses bureaux" className="h-[240px] w-full rounded-[15px] object-cover sm:h-[280px]" />
				<div className="w-full text-[18px] leading-tight text-black sm:text-[20px]">
					<p className="line-clamp-5 whitespace-pre-line">{current.description || current.requirements || "Découvrez cette offre d’alternance et son équipe."}</p>
					<Link to={`/offers/${current.id}`} className={`mt-3 inline-block font-semibold text-primary hover:underline ${focus}`}>Plus d’informations</Link>
				</div>
				<div className="mt-auto flex w-[222px] items-center justify-between pt-2">
					<button type="button" onClick={() => markSeen(current, false)} aria-label={`Passer l’offre ${current.title}`} className={`flex size-[51px] items-center justify-center rounded-full text-red-600 hover:bg-red-50 ${focus}`}><BanIcon className="size-9" /></button>
					<Link to="/student" aria-label="Modifier mon CV et mes documents" title="Modifier mon CV et mes documents" className={`flex size-[51px] items-center justify-center rounded-full text-primary hover:bg-blue-50 ${focus}`}><EditIcon /></Link>
					<button type="button" onClick={() => markSeen(current, true)} aria-label={`Sauvegarder l’offre ${current.title}`} className={`flex size-[51px] items-center justify-center rounded-full text-primary hover:bg-blue-50 ${focus}`}><HeartIcon className="size-9 fill-current" /></button>
				</div>
			</article> : <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[25px] bg-white p-8 text-center shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
				<h1 className="text-2xl font-semibold">{matchingOffers.length ? "Tu as vu toutes les offres !" : "Aucune offre ne correspond à tes filtres."}</h1>
				<p className="mt-2 text-[#6b7280]">{saved.length ? `${saved.length} offre${saved.length > 1 ? "s" : ""} sauvegardée${saved.length > 1 ? "s" : ""} pendant cette session.` : "Modifie tes filtres ou reviens découvrir les offres."}</p>
				{matchingOffers.length > 0 && <button type="button" onClick={resetSeen} className={`mt-5 rounded-xl bg-primary px-5 py-3 font-semibold text-white ${focus}`}>Revoir les offres</button>}
			</div>}
			{current && <p className="mt-3 text-center text-sm text-[#6b7280]">{remaining} {remaining === 1 ? "offre" : "offres"} à découvrir</p>}
		</section>
	</div>;
}
