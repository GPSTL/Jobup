import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import Button from "../components/Button";
import ChevronDownIcon from "../components/ChevronDownIcon";
import HeartIcon from "../components/HeartIcon";
import LoginBanner from "../components/LoginBanner";
import MapPinIcon from "../components/MapPinIcon";
import Navbar, { NavbarLink } from "../components/Navbar";
import StudentNavbar from "../components/StudentNavbar";
import RecruiterNavbar from "../components/RecruiterNavbar";
import Pagination from "../components/Pagination";
import SearchIcon from "../components/SearchIcon";
import { getSession, type SessionResult } from "../services/auth";
import { card, field, focus, input, searchButton, select } from "../utils/searchPageStyles";

// TODO: replace these provisional sample offers with backend results.
const OFFERS = [
	{ id: 1, title: "Développeur Java en alternance", company: "Atelier Studio", city: "Paris", duration: "12 mois" },
	{ id: 2, title: "Data analyst junior", company: "Horizon Tech", city: "Nantes", duration: "24 mois" },
	{ id: 3, title: "Chef de projet digital", company: "Nova Tech", city: "Lyon", duration: "12 mois" },
	{ id: 4, title: "Développeur Angular", company: "Cité Énergie", city: "La Défense", duration: "24 mois" },
	{ id: 5, title: "Designer UI/UX", company: "Lumina Design", city: "Lille", duration: "12 mois" },
	{ id: 6, title: "Chargé de recrutement", company: "Maison Verte", city: "Bordeaux", duration: "12 mois" },
];

// TODO: replace these provisional filter options with backend reference data.
const SECTEURS = ["Informatique", "Data / IA", "Marketing / Communication", "Design", "Ressources humaines", "Autre"];

export default function OffersPage() {
	const { id } = useParams();
	const selectedOffer = OFFERS.find((offer) => String(offer.id) === id);
	const [session, setSession] = useState<SessionResult | null>(null);
	useEffect(() => {
		let ignore = false;
		getSession().then((result) => { if (!ignore) setSession(result); });
		return () => { ignore = true; };
	}, []);
	// Local pagination works on sample data.
	// TODO: use backend pagination and its total result count when the API is connected.
	const [page, setPage] = useState(1);
	const pageSize = 6;
	const totalPages = Math.ceil(OFFERS.length / pageSize);
	const startIndex = (page - 1) * pageSize;
	const visibleResults = OFFERS.slice(startIndex, startIndex + pageSize);
	const [secteur, setSecteur] = useState<string>("");

	// Not connected to the backend yet
	const onSearch = (e: FormEvent) => {
		e.preventDefault();
		// TODO: apply the keyword and city/postcode fields to results when the search API is connected.
	};

	return (
		<div className="min-h-dvh bg-[#f0f0f0] px-4 pt-4 pb-16 text-[#111827] md:px-6 md:pt-6">
			{session !== null && <header>
				{session.ok && session.user.role === 1 ? <StudentNavbar /> : session.ok && session.user.role === 3 ? <RecruiterNavbar /> : session.ok ? null : <Navbar>
					{/* Hidden on small screens: the full bar does not fit on a phone. */}
					<div className="hidden gap-12 lg:flex">
						<NavbarLink to="/offers">Trouver une alternance</NavbarLink>
						<NavbarLink to="/companies">Explorer les entreprises</NavbarLink>
						<NavbarLink to="/pricing">Tarifs</NavbarLink>
					</div>
					<NavbarLink to="/signup" className="ml-auto">Inscription</NavbarLink>
					<Button to="/login">Connexion</Button>
				</Navbar>}
			</header>}

			<main className="mx-auto mt-10 flex max-w-[1236px] flex-col gap-[22px] leading-[normal]">
				<div className="flex flex-col gap-1.5">
					<h1 className="text-[40px] font-bold">Trouver une alternance</h1>
					{/* Provisional count derived from sample data; replace with the API total. */}
					<p className="text-[17px] text-[#6b7280]">{OFFERS.length} offres d’alternance publiées par des entreprises partenaires.</p>
				</div>

				<form role="search" onSubmit={onSearch} className="flex flex-col gap-3 md:flex-row md:items-start">
					<label className={`${field} md:flex-1`}>
						<SearchIcon width={20} height={20} className="text-gray-500" />
						<span className="sr-only">Poste, compétence ou entreprise</span>
						<input placeholder="Poste, compétence ou entreprise" className={input} />
					</label>
					<label className={`${field} md:w-[260px]`}>
						<span className="sr-only">Ville ou code postal</span>
						<input placeholder="Ville ou code postal" className={input} />
						<MapPinIcon width={20} height={20} className="text-gray-500" />
					</label>
					{/* The select fills the whole field so a click on the chevron opens it too */}
					<label className="relative md:w-[220px]">
						{/* TODO: apply the selected sector to results; currently only the selected value changes. */}
						<span className="sr-only">Secteur</span>
						<select
							value={secteur}
							onChange={(e) => setSecteur(e.target.value)}
							className={`${select} ${secteur ? "text-[#111827]" : "text-[#9ca3af]"}`}
						>
							<option value="">Secteur</option>
							{SECTEURS.map((s) => (
								<option key={s} className="text-[#111827]">
									{s}
								</option>
							))}
						</select>
						<ChevronDownIcon width={20} height={20} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-gray-500" />
					</label>
					<button
						type="submit"
						className={searchButton}
					>
						Rechercher
					</button>
				</form>

				{session !== null && !session.ok && <LoginBanner>Connecte-toi pour swiper les offres, les sauvegarder et postuler en un clic.</LoginBanner>}

				{/* Offer details are available before sign-in; signing in to apply returns to that offer. */}
				<ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{visibleResults.map(({ title, company, city, duration }) => (
						<li key={title} className={card}>
							<img src="/static/img/home_bg_image.webp" alt="" loading="lazy" className="h-[150px] w-full rounded-[14px] object-cover" />
							<div className="flex items-center gap-2">
								<h2 className="flex-1 text-[19px] font-semibold">{title}</h2>
								<Link to="/login" state={{ studentReturnTo: `/offers/${OFFERS.find((offer) => offer.title === title)?.id}` }} aria-label={`Sauvegarder l’offre ${title}`} className={`group shrink-0 rounded-sm ${focus}`}>
									<HeartIcon width={20} height={20} className="text-gray-400 group-hover:text-primary group-focus-visible:text-primary" />
								</Link>
							</div>
							<p className="text-[15px] text-[#6b7280]">
								{company} • {city}
							</p>
							<div className="flex gap-2">
								<span className="rounded-full bg-primary/10 px-2.5 py-[5px] text-[13px] font-semibold text-primary">Alternance</span>
								<span className="rounded-full bg-[#f3f4f6] px-2.5 py-[5px] text-[13px] font-semibold text-[#6b7280]">{duration}</span>
							</div>
							<Link
								to={`/offers/${OFFERS.find((offer) => offer.title === title)?.id}`}
								className={`rounded-[10px] border-[1.5px] border-[#d1d5db] bg-white px-3.5 py-[9px] text-center text-[14px] font-semibold hover:bg-[#f9fafb] ${focus}`}
							>
								Voir l’offre<span className="sr-only"> {title}</span>
							</Link>
						</li>
					))}
				</ul>

				<Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
			</main>
			{id && <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) window.history.back(); }}>
				<section role="dialog" aria-modal="true" aria-labelledby="offer-detail-title" className="w-full max-w-xl rounded-3xl bg-white p-7 shadow-xl">
					{selectedOffer ? <>
						<h2 id="offer-detail-title" className="text-3xl font-semibold">{selectedOffer.title}</h2>
						<p className="mt-3 text-[#6b7280]">{selectedOffer.company} • {selectedOffer.city} • Alternance de {selectedOffer.duration}</p>
						<p className="mt-6">Découvrez cette opportunité et contactez l’entreprise pour en savoir plus.</p>
						<div className="mt-6 flex flex-wrap justify-end gap-3">
							<Button variant="outline" to="/offers">Retour aux offres</Button>
							<Link to="/login" state={{ studentReturnTo: `/offers/${selectedOffer.id}` }} className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-1 text-base font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Se connecter pour postuler</Link>
						</div>
					</> : <><h2 id="offer-detail-title" className="text-2xl font-semibold">Offre introuvable</h2><Button className="mt-5" to="/offers">Retour aux offres</Button></>}
				</section>
			</div>}
		</div>
	);
}
