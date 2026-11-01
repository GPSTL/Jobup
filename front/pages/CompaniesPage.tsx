import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import ArrowUpRightIcon from "../components/ArrowUpRightIcon";
import BookmarkIcon from "../components/BookmarkIcon";
import Button from "../components/Button";
import ChevronDownIcon from "../components/ChevronDownIcon";
import LoginBanner from "../components/LoginBanner";
import MapPinIcon from "../components/MapPinIcon";
import Navbar, { NavbarLink } from "../components/Navbar";
import Pagination from "../components/Pagination";
import SearchIcon from "../components/SearchIcon";
import SortIcon from "../components/SortIcon";
import UsersIcon from "../components/UsersIcon";
import { card, field, focus, input, searchButton, select } from "../utils/searchPageStyles";

// TODO: replace these provisional sample companies with backend results.
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

// TODO: replace these provisional filter options with backend reference data.
const REGIONS = ["Île-de-France", "Auvergne-Rhône-Alpes", "Hauts-de-France", "Nouvelle-Aquitaine", "Occitanie", "Provence-Alpes-Côte d’Azur"];
const SECTEURS = ["Santé", "Économie circulaire", "Finance", "Mobilité", "Assurance santé", "Intelligence artificielle"];
// TODO: replace provisional company-size options with backend reference data.
const TAILLES = ["Moins de 50 salariés", "50 à 250 salariés", "250 à 1 000 salariés", "Plus de 1 000 salariés"];
// TODO: connect these provisional sort options to backend sorting.
const TRIS = ["Pertinence", "Nom", "Nombre de salariés"];

const fit = "field-sizing-content";
const filter = `${select} ${fit}`;

export default function CompaniesPage() {
	// Local pagination works on sample data.
	// TODO: use backend pagination and its total result count when the API is connected.
	const [page, setPage] = useState(1);
	const pageSize = 6;
	const totalPages = Math.ceil(COMPANIES.length / pageSize);
	const startIndex = (page - 1) * pageSize;
	const visibleResults = COMPANIES.slice(startIndex, startIndex + pageSize);
	// Not connected to the backend yet
	const onSearch = (e: FormEvent) => {
		e.preventDefault();
		// TODO: apply the keyword field to company results when the search API is connected.
	};

	return (
		<div className="min-h-dvh bg-[#f0f0f0] px-4 pt-4 pb-16 md:px-6 md:pt-6">
			<header>
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

			<main className="mx-auto mt-10 flex max-w-[1236px] flex-col gap-[22px] leading-[normal] text-[#111827]">
				<div className="flex flex-col gap-2">
					<h1 className="text-[40px] font-bold">Découvrez votre prochaine entreprise.</h1>
					<p className="text-[17px] text-[#6b7280]">Explorez les entreprises, leurs activités et les équipes qui les font grandir.</p>
				</div>

				<form role="search" onSubmit={onSearch} className="flex flex-col gap-3 md:flex-row md:items-start">
					<label className={`${field} md:flex-1`}>
						<SearchIcon width={20} height={20} className="text-gray-500" />
						<span className="sr-only">Rechercher une entreprise ou un secteur d’activité</span>
						<input placeholder="Rechercher une entreprise, un secteur d’activité…" className={input} />
					</label>
					<label className="relative md:w-[260px]">
						{/* TODO: apply the selected region to search results; this select is currently visual only. */}
						<span className="sr-only">Zone de recherche</span>
						<select defaultValue="" className={select}>
							<option value="">Toute la France</option>
							{REGIONS.map((r) => <option key={r}>{r}</option>)}
						</select>
						<ChevronDownIcon width={20} height={20} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-gray-500" />
					</label>
					<button type="submit" className={searchButton}>Rechercher</button>
				</form>

				<LoginBanner>Crée ton compte pour suivre des entreprises et leur écrire directement.</LoginBanner>

				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<nav aria-label="Collections" className="flex gap-1">
						<Link to="/companies" aria-current="page" className={`rounded-[6px] bg-primary/10 px-5 py-2 text-[12px] font-semibold text-primary ${focus}`}>
							Toutes les entreprises
						</Link>
						{/* Favorites need an account */}
						<Link to="/login" className={`rounded-[10px] px-5 py-2 text-[12px] text-[#6b7280] hover:bg-[#f1f3f6] ${focus}`}>
							Mes favoris
						</Link>
					</nav>
					<div className="flex flex-wrap gap-2">
						<label className="relative">
							{/* TODO: filter companies by the selected sector. */}
							<span className="sr-only">Secteur d’activité</span>
							<select defaultValue="" className={filter}>
								<option value="">Secteur d’activité</option>
								{SECTEURS.map((s) => (
									<option key={s}>{s}</option>
								))}
							</select>
							<ChevronDownIcon width={13} height={13} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-500" />
						</label>
						<label className="relative">
							{/* TODO: filter companies by the selected employee range. */}
							<span className="sr-only">Taille de l’entreprise</span>
							<select defaultValue="" className={filter}>
								<option value="">Taille de l’entreprise</option>
								{TAILLES.map((t) => (
									<option key={t}>{t}</option>
								))}
							</select>
							<ChevronDownIcon width={13} height={13} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-500" />
						</label>
						<label className="relative flex items-center pl-2">
							{/* TODO: sort company results by the selected criterion. */}
							<span className="sr-only">Trier par</span>
							<select className={`${fit} cursor-pointer appearance-none bg-transparent py-[9px] pr-[22px] text-[12px] text-[#6b7280] ${focus}`}>
								{TRIS.map((t) => (
									<option key={t}>{t}</option>
								))}
							</select>
							<SortIcon width={16} height={16} className="pointer-events-none absolute right-0 text-gray-500" />
						</label>
					</div>
				</div>

				{/* Saving or opening a company needs an account: these links lead to the login page */}
				<ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{visibleResults.map(({ name, emblem, colors, city, description, sector, employees }) => (
						<li key={name} className={card}>
							<div className="flex items-center gap-3">
								<span
									aria-hidden="true"
									className={`flex size-11 shrink-0 items-center justify-center rounded-[10px] font-bold ${colors} ${emblem.length > 1 ? "text-[22px]" : "text-[28px]"}`}
								>
									{emblem}
								</span>
								<div className="flex min-w-0 flex-1 flex-col gap-[5px]">
									<h2 className="text-[19px] font-semibold">{name}</h2>
									<p className="flex items-center gap-1 text-[12px] text-[#6b7280]">
										<MapPinIcon width={12} height={12} className="text-gray-500" />
										{city}
									</p>
								</div>
								{/* Grey bookmark, blue on hover */}
								<Link to="/login" aria-label={`Ajouter ${name} à mes favoris`} className={`group shrink-0 rounded-sm ${focus}`}>
									<BookmarkIcon width={18} height={18} className="text-gray-400 group-hover:text-primary group-focus-visible:text-primary" />
								</Link>
							</div>
							<p className="min-h-10 text-[15px] leading-5 text-[#6b7280]">{description}</p>
							<span className="self-start rounded-[5px] bg-[#f1f3f6] px-2 py-[5px] text-[11px] font-medium text-[#6b7280]">{sector}</span>
							<div className="flex items-center justify-between border-t border-[#d1d5db] pt-4">
								<p className="flex items-center gap-[5px] text-[11px] text-[#6b7280]">
									<UsersIcon width={14} height={14} className="text-gray-500" />
									{employees} salariés
								</p>
								<Link to="/login" className={`flex items-center gap-[5px] rounded-sm text-[12px] font-semibold text-primary hover:underline ${focus}`}>
									Voir la fiche<span className="sr-only"> de {name}</span>
									<ArrowUpRightIcon width={14} height={14} className="" />
								</Link>
							</div>
						</li>
					))}
				</ul>

				<div className="flex flex-col items-center gap-3 pt-0.5">
					<Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
				</div>
			</main>
		</div>
	);
}
