import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import Button from "../components/Button";
import LoginBanner from "../components/LoginBanner";
import Navbar, { NavbarLink } from "../components/Navbar";

// Sample companies from the mockup, until they come from the backend.
// `emblem`: letters shown in the colored square instead of a logo.
const COMPANIES = [
	{
		name: "Doctolib",
		emblem: "d",
		colors: "bg-[#eaf4f9] text-[#237aa5]",
		city: "Paris, France",
		description: "Faciliter l’accès aux soins et accompagner les professionnels de santé.",
		sector: "Santé",
		employees: "2 800",
	},
	{
		name: "Back Market",
		emblem: "B.",
		colors: "bg-[#eef2e6] text-[#343e30]",
		city: "Paris, France",
		description: "Donner une seconde vie aux appareils et une autre voie à la technologie.",
		sector: "Économie circulaire",
		employees: "700",
	},
	{
		name: "Qonto",
		emblem: "Q",
		colors: "bg-[#f0edf7] text-[#504477]",
		city: "Paris, France",
		description: "Simplifier la gestion financière des indépendants et des entreprises.",
		sector: "Finance",
		employees: "1 600",
	},
	{
		name: "BlaBlaCar",
		emblem: "bl",
		colors: "bg-[#eaf5f6] text-[#147a8f]",
		city: "Paris, France",
		description: "Connecter les voyageurs pour une mobilité plus accessible et partagée.",
		sector: "Mobilité",
		employees: "800",
	},
	{
		name: "Alan",
		emblem: "a",
		colors: "bg-[#fbf0e9] text-[#8c6049]",
		city: "Paris, France",
		description: "Prendre soin de la santé et du bien-être, simplement et au quotidien.",
		sector: "Assurance santé",
		employees: "600",
	},
	{
		name: "Mistral AI",
		emblem: "M",
		colors: "bg-[#fff2e6] text-[#a95b31]",
		city: "Paris, France",
		description: "Créer une intelligence artificielle ouverte, utile et accessible à tous.",
		sector: "Intelligence artificielle",
		employees: "250",
	},
];

// Placeholder options until they come from the backend
const REGIONS = ["Île-de-France", "Auvergne-Rhône-Alpes", "Hauts-de-France", "Nouvelle-Aquitaine", "Occitanie", "Provence-Alpes-Côte d’Azur"];
const SECTEURS = ["Santé", "Économie circulaire", "Finance", "Mobilité", "Assurance santé", "Intelligence artificielle"];
const TAILLES = ["Moins de 50 salariés", "50 à 250 salariés", "250 à 1 000 salariés", "Plus de 1 000 salariés"];
const TRIS = ["Pertinence", "Nom", "Nombre de salariés"];

// Static until the companies come from the backend
const PAGES = ["1", "2", "3", "4", "5", "...", "10"];

// Darker blue used by this page in the mockup
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2864a6]";

// As wide as the chosen option rather than the longest one, so the chevron stays next to the text
const fit = "field-sizing-content";

const filter = [
	`${fit} cursor-pointer appearance-none rounded-[6px] border border-[#d1d5db] bg-white py-[9px] pr-[35px] pl-3`,
	"text-[12px] text-[#202936]",
	focus,
].join(" ");

const pageItem = "flex size-6 items-center justify-center rounded-[5px] text-[16px] leading-[19px]";

export default function CompaniesPage() {
	// Not connected to the backend yet
	const onSearch = (e: FormEvent) => {
		e.preventDefault();
		// TODO: search the companies once the API exists
	};

	return (
		<div className="min-h-dvh bg-[#f0f0f0] px-4 pt-4 pb-16 leading-[normal] md:px-6 md:pt-[50px]">
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

			<main className="mx-auto mt-[25px] flex max-w-[1236px] flex-col gap-6 bg-white px-5 pt-[30px] pb-[26px] font-inter text-[#202936] md:px-10">
				<div className="flex flex-col gap-2">
					<h1 className="text-[28px] font-semibold">Découvrez votre prochaine entreprise.</h1>
					<p className="text-[13px] text-[#697382]">Explorez les entreprises, leurs activités et les équipes qui les font grandir.</p>
				</div>

				<form role="search" onSubmit={onSearch} className="border-b border-[#e3e7ec]">
					<div className="flex flex-col gap-3 rounded-lg border border-[#e3e7ec] p-1.5 focus-within:border-[#2864a6] md:h-14 md:flex-row md:items-center md:gap-4">
						<label className="flex min-w-0 flex-1 items-center gap-4 max-md:h-11">
							<img src="/static/img/companies/search.svg" alt="" width={20} height={20} />
							<span className="sr-only">Rechercher une entreprise ou un secteur d’activité</span>
							<input
								placeholder="Rechercher une entreprise, un secteur d’activité…"
								className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#697382]"
							/>
						</label>
						<span aria-hidden="true" className="hidden h-6 w-px bg-[#e3e7ec] md:block" />
						{/* Pin and chevron drawn over the select, which keeps the clicks */}
						<label className="relative flex items-center max-md:self-start">
							<span className="sr-only">Zone de recherche</span>
							<img src="/static/img/companies/map_pin.svg" alt="" width={17} height={17} className="pointer-events-none absolute left-0" />
							<select
								defaultValue=""
								className={`${fit} cursor-pointer appearance-none bg-transparent py-1 pr-[22px] pl-[25px] text-[13px] ${focus}`}
							>
								<option value="">Toute la France</option>
								{REGIONS.map((r) => (
									<option key={r}>{r}</option>
								))}
							</select>
							<img
								src="/static/img/companies/location_chevron.svg"
								alt=""
								width={14}
								height={14}
								className="pointer-events-none absolute right-0"
							/>
						</label>
						<button
							type="submit"
							className={`h-11 cursor-pointer rounded-[6px] bg-[#2864a6] px-[22px] text-[14px] font-semibold text-white hover:bg-[#2864a6]/90 ${focus}`}
						>
							Rechercher
						</button>
					</div>
				</form>

				<LoginBanner>Crée ton compte pour suivre des entreprises et leur écrire directement.</LoginBanner>

				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<nav aria-label="Collections" className="flex gap-1">
						<Link to="/companies" aria-current="page" className={`rounded-[6px] bg-[#edf3fa] px-5 py-2 text-[12px] font-semibold text-[#2864a6] ${focus}`}>
							Toutes les entreprises
						</Link>
						{/* Favorites need an account */}
						<Link to="/login" className={`rounded-[10px] px-5 py-2 text-[12px] text-[#697382] hover:bg-[#f1f3f6] ${focus}`}>
							Mes favoris
						</Link>
					</nav>
					<div className="flex flex-wrap gap-2">
						<label className="relative">
							<span className="sr-only">Secteur d’activité</span>
							<select defaultValue="" className={filter}>
								<option value="">Secteur d’activité</option>
								{SECTEURS.map((s) => (
									<option key={s}>{s}</option>
								))}
							</select>
							<img
								src="/static/img/companies/filter_chevron.svg"
								alt=""
								width={13}
								height={13}
								className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
							/>
						</label>
						<label className="relative">
							<span className="sr-only">Taille de l’entreprise</span>
							<select defaultValue="" className={filter}>
								<option value="">Taille de l’entreprise</option>
								{TAILLES.map((t) => (
									<option key={t}>{t}</option>
								))}
							</select>
							<img
								src="/static/img/companies/filter_chevron.svg"
								alt=""
								width={13}
								height={13}
								className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
							/>
						</label>
						<label className="relative flex items-center pl-2">
							<span className="sr-only">Trier par</span>
							<select className={`${fit} cursor-pointer appearance-none bg-transparent py-[9px] pr-[22px] text-[12px] text-[#697382] ${focus}`}>
								{TRIS.map((t) => (
									<option key={t}>{t}</option>
								))}
							</select>
							<img src="/static/img/companies/sort.svg" alt="" width={16} height={16} className="pointer-events-none absolute right-0" />
						</label>
					</div>
				</div>

				{/* Saving or opening a company needs an account: these links lead to the login page */}
				<ul className="grid gap-[18px] md:grid-cols-2 lg:grid-cols-3">
					{COMPANIES.map(({ name, emblem, colors, city, description, sector, employees }) => (
						<li key={name} className="flex flex-col gap-4 rounded-xl border border-[#d1d5db] p-5">
							<div className="flex items-center gap-3">
								<span
									aria-hidden="true"
									className={`flex size-11 shrink-0 items-center justify-center rounded-[10px] font-bold ${colors} ${emblem.length > 1 ? "text-[22px]" : "text-[28px]"}`}
								>
									{emblem}
								</span>
								<div className="flex min-w-0 flex-1 flex-col gap-[5px]">
									<h2 className="text-[17px] font-semibold">{name}</h2>
									<p className="flex items-center gap-1 text-[12px] text-[#697382]">
										<img src="/static/img/companies/city_pin.svg" alt="" width={12} height={12} />
										{city}
									</p>
								</div>
								{/* Grey bookmark, blue on hover */}
								<Link to="/login" aria-label={`Ajouter ${name} à mes favoris`} className={`group shrink-0 rounded-sm ${focus}`}>
									<img src="/static/img/companies/bookmark.svg" alt="" width={18} height={18} className="group-hover:hidden" />
									<img src="/static/img/companies/bookmark_saved.svg" alt="" width={18} height={18} className="hidden group-hover:block" />
								</Link>
							</div>
							<p className="min-h-10 text-[13px] leading-5 text-[#697382]">{description}</p>
							<span className="self-start rounded-[5px] bg-[#f1f3f6] px-2 py-[5px] text-[11px] font-medium text-[#697382]">{sector}</span>
							<div className="flex items-center justify-between border-t border-[#d1d5db] pt-4">
								<p className="flex items-center gap-[5px] text-[11px] text-[#697382]">
									<img src="/static/img/companies/users.svg" alt="" width={14} height={14} />
									{employees} salariés
								</p>
								<Link to="/login" className={`flex items-center gap-[5px] rounded-sm text-[12px] font-semibold text-[#2864a6] hover:underline ${focus}`}>
									Voir la fiche<span className="sr-only"> de {name}</span>
									<img src="/static/img/companies/arrow_up_right.svg" alt="" width={14} height={14} />
								</Link>
							</div>
						</li>
					))}
				</ul>

				<div className="flex flex-col items-center gap-3 pt-0.5 sm:flex-row sm:justify-between">
					<p className="text-[12px] text-[#697382]">1–6 sur 60 entreprises</p>
					<nav aria-label="Pagination" className="flex items-center gap-2.5 font-sans">
						<button type="button" aria-label="Page précédente" className={`cursor-pointer rounded-sm ${focus}`}>
							<img src="/static/img/companies/page_arrow.svg" alt="" width={30} height={30} />
						</button>
						{PAGES.map((page) =>
							page === "..." ? (
								<span key={page} className={pageItem}>
									...
								</span>
							) : (
								<button
									key={page}
									type="button"
									aria-current={page === "1" ? "page" : undefined}
									className={`${pageItem} cursor-pointer ${page === "1" ? "bg-[#2864a6] text-white" : "text-ink"} ${focus}`}
								>
									{page}
								</button>
							),
						)}
						{/* Same arrow as "previous", mirrored */}
						<button type="button" aria-label="Page suivante" className={`cursor-pointer rounded-sm ${focus}`}>
							<img src="/static/img/companies/page_arrow.svg" alt="" width={30} height={30} className="-scale-x-100" />
						</button>
					</nav>
				</div>
			</main>
		</div>
	);
}
