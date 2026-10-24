import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import Button from "../components/Button";
import LoginBanner from "../components/LoginBanner";
import Navbar, { NavbarLink } from "../components/Navbar";

// Sample offers from the mockup, until they come from the backend
const OFFERS = [
	{ title: "Développeur Java en alternance", company: "Atelier Studio", city: "Paris", duration: "12 mois" },
	{ title: "Data analyst junior", company: "Horizon Tech", city: "Nantes", duration: "24 mois" },
	{ title: "Chef de projet digital", company: "Nova Tech", city: "Lyon", duration: "12 mois" },
	{ title: "Développeur Angular", company: "Cité Énergie", city: "La Défense", duration: "24 mois" },
	{ title: "Designer UI/UX", company: "Lumina Design", city: "Lille", duration: "12 mois" },
	{ title: "Chargé de recrutement", company: "Maison Verte", city: "Bordeaux", duration: "12 mois" },
];

// Placeholder options until they come from the backend
const SECTEURS = ["Informatique", "Data / IA", "Marketing / Communication", "Design", "Ressources humaines", "Autre"];

// Static until the offers come from the backend
const PAGES = ["1", "2", "3", "…", "42"];

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const field = [
	"flex items-center gap-2.5 rounded-[14px] border border-[#d1d5db] bg-white py-3.5 pr-3.5 pl-[18px]",
	"focus-within:border-primary",
].join(" ");

const input = "min-w-0 flex-1 bg-transparent text-[17px] text-[#111827] outline-none placeholder:text-[#9ca3af]";

// Same look as `field`, with room on the right for the chevron
const select = [
	"w-full cursor-pointer appearance-none rounded-[14px] border border-[#d1d5db] bg-white py-3.5 pr-11 pl-[18px]",
	"text-[17px] outline-none focus:border-primary",
].join(" ");

const pageItem = "flex size-[34px] items-center justify-center rounded-lg text-[15px] font-semibold";

export default function OffersPage() {
	const [secteur, setSecteur] = useState<string>("");

	// Not connected to the backend yet
	const onSearch = (e: FormEvent) => {
		e.preventDefault();
		// TODO: search the offers once the API exists
	};

	return (
		<div className="min-h-dvh bg-[#f0f0f0] px-4 pt-4 pb-16 leading-[normal] text-[#111827] md:px-6 md:pt-[50px]">
			<header className="mx-auto max-w-[1236px]">
				<Navbar>
					{/* Hidden on small screens: the full bar does not fit on a phone. */}
					<div className="hidden gap-12 lg:flex">
						<NavbarLink to="/offers">Trouver une alternance</NavbarLink>
						<NavbarLink to="/companies">Explorer les entreprises</NavbarLink>
						<NavbarLink to="/pricing">Tarifs</NavbarLink>
					</div>
					<NavbarLink to="/signup" className="ml-auto">Inscription</NavbarLink>
					<Button to="/login">Connexion</Button>
				</Navbar>
			</header>

			<main className="mx-auto mt-10 flex max-w-[1236px] flex-col gap-[22px]">
				<div className="flex flex-col gap-1.5">
					<h1 className="text-[40px] font-bold">Trouver une alternance</h1>
					<p className="text-[17px] text-[#6b7280]">248 offres d’alternance publiées par des entreprises partenaires.</p>
				</div>

				<form role="search" onSubmit={onSearch} className="flex flex-col gap-3 md:flex-row md:items-start">
					<label className={`${field} md:flex-1`}>
						<img src="/static/img/offers/search.svg" alt="" width={20} height={20} />
						<span className="sr-only">Poste, compétence ou entreprise</span>
						<input placeholder="Poste, compétence ou entreprise" className={input} />
					</label>
					<label className={`${field} md:w-[260px]`}>
						<span className="sr-only">Ville ou code postal</span>
						<input placeholder="Ville ou code postal" className={input} />
						<img src="/static/img/offers/pin.svg" alt="" width={20} height={20} />
					</label>
					{/* The select fills the whole field so a click on the chevron opens it too */}
					<label className="relative md:w-[220px]">
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
						<img
							src="/static/img/offers/chevron_down.svg"
							alt=""
							width={20}
							height={20}
							className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2"
						/>
					</label>
					<button
						type="submit"
						className={`cursor-pointer rounded-[14px] bg-primary px-[22px] py-3.5 text-[16px] font-semibold text-on-primary hover:bg-primary/90 ${focus}`}
					>
						Rechercher
					</button>
				</form>

				<LoginBanner>Connecte-toi pour swiper les offres, les sauvegarder et postuler en un clic.</LoginBanner>

				{/* Saving or opening an offer needs an account: these links lead to the login page */}
				<ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{OFFERS.map(({ title, company, city, duration }) => (
						<li key={title} className="flex flex-col gap-2.5 rounded-[20px] bg-white px-4 pt-4 pb-[18px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
							<img src="/static/img/offers/offer_image.jpg" alt="" className="h-[150px] w-full rounded-[14px] object-cover" />
							<div className="flex items-center gap-2">
								<h2 className="flex-1 text-[19px] font-semibold">{title}</h2>
								<Link to="/login" aria-label={`Sauvegarder l’offre ${title}`} className={`shrink-0 rounded-sm ${focus}`}>
									<img src="/static/img/offers/heart.svg" alt="" width={20} height={20} />
								</Link>
							</div>
							<p className="text-[15px] text-[#6b7280]">
								{company} • {city}
							</p>
							<div className="flex gap-2">
								<span className="rounded-full bg-[#dbeafe] px-2.5 py-[5px] text-[13px] font-semibold text-[#1d4ed8]">Alternance</span>
								<span className="rounded-full bg-[#f3f4f6] px-2.5 py-[5px] text-[13px] font-semibold text-[#6b7280]">{duration}</span>
							</div>
							<Link
								to="/login"
								className={`rounded-[10px] border-[1.5px] border-[#d1d5db] bg-white px-3.5 py-[9px] text-center text-[14px] font-semibold hover:bg-[#f9fafb] ${focus}`}
							>
								Voir l’offre<span className="sr-only"> {title}</span>
							</Link>
						</li>
					))}
				</ul>

				<nav aria-label="Pagination" className="flex justify-center gap-2">
					<button type="button" aria-label="Page précédente" className={`${pageItem} cursor-pointer bg-white ${focus}`}>
						‹
					</button>
					{PAGES.map((page) =>
						page === "…" ? (
							<span key={page} className={`${pageItem} bg-white`}>
								…
							</span>
						) : (
							<button
								key={page}
								type="button"
								aria-current={page === "1" ? "page" : undefined}
								className={`${pageItem} cursor-pointer ${page === "1" ? "bg-primary text-on-primary" : "bg-white"} ${focus}`}
							>
								{page}
							</button>
						),
					)}
					<button type="button" aria-label="Page suivante" className={`${pageItem} cursor-pointer bg-white ${focus}`}>
						›
					</button>
				</nav>
			</main>
		</div>
	);
}
