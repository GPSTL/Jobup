import { useEffect, useState, type FormEvent } from "react";
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
import { getCities, getCompanies, PAGE_SIZE, type CompanyFilters, type CompanyList } from "../services/companies";
import { companyEmblem, emblemColors, formatEmployees, SECTOR_OPTIONS, sectorLabel } from "../utils/companies";
import { MESSAGES } from "../utils/validation";

// TODO: replace provisional company-size options with backend reference data.
const TAILLES = ["Moins de 50 salariés", "50 à 250 salariés", "250 à 1 000 salariés", "Plus de 1 000 salariés"];
// TODO: connect these provisional sort options to backend sorting.
const TRIS = ["Pertinence", "Nom", "Nombre de salariés"];

const fit = "field-sizing-content";
const filter = `${select} ${fit}`;

export default function CompaniesPage() {
	// Saisie en cours, appliquée seulement au clic sur « Rechercher »
	const [query, setQuery] = useState("");
	const [city, setCity] = useState("");
	const [filters, setFilters] = useState<CompanyFilters>({ q: "", city: "", sector: "" });
	const [page, setPage] = useState(1);
	const [cities, setCities] = useState<string[]>([]);
	const [list, setList] = useState<CompanyList | null>(null);
	const [error, setError] = useState("");
	// Incrémenté par « Réessayer » pour relancer la requête
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		// Sans la liste des villes, le menu garde seulement « Toute la France »
		getCities().then((result) => {
			if (result.ok) setCities(result.cities);
		});
	}, []);

	useEffect(() => {
		// Ignore une réponse arrivée après une nouvelle recherche
		let ignore = false;
		setList(null);
		setError("");
		getCompanies({ ...filters, page }).then((result) => {
			if (ignore) return;
			if (result.ok) setList(result.list);
			else setError(result.reason === "network" ? MESSAGES.networkError : MESSAGES.serverError);
		});
		return () => {
			ignore = true;
		};
	}, [filters, page, attempt]);

	const applyFilters = (next: CompanyFilters) => {
		setFilters({ ...filters, ...next });
		setPage(1);
	};

	const onSearch = (e: FormEvent) => {
		e.preventDefault();
		applyFilters({ q: query, city });
	};

	// « 1–6 sur 60 entreprises »
	const range = list && list.count > 0
		? `${(list.page - 1) * PAGE_SIZE + 1}–${(list.page - 1) * PAGE_SIZE + list.results.length} sur ${list.count} ${list.count > 1 ? "entreprises" : "entreprise"}`
		: "";

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
						<input
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Rechercher une entreprise, un secteur d’activité…"
							className={input}
						/>
					</label>
					<label className="relative md:w-[260px]">
						<span className="sr-only">Ville</span>
						<select value={city} onChange={(e) => setCity(e.target.value)} className={select}>
							<option value="">Toute la France</option>
							{cities.map((c) => <option key={c}>{c}</option>)}
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
							<span className="sr-only">Secteur d’activité</span>
							{/* Appliqué dès le choix, comme un filtre */}
							<select
								value={filters.sector ?? ""}
								onChange={(e) => applyFilters({ sector: e.target.value === "" ? "" : Number(e.target.value) })}
								className={filter}
							>
								<option value="">Secteur d’activité</option>
								{SECTOR_OPTIONS.map(({ value, label }) => (
									<option key={value} value={value}>{label}</option>
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

				{!list && !error && (
					<p aria-busy="true" className="py-10 text-center text-[17px] text-[#6b7280]">Chargement des entreprises…</p>
				)}
				{error && (
					<div role="alert" className="flex flex-col items-center gap-4 py-10 text-center">
						<p className="text-[17px]">{error}</p>
						<Button onClick={() => setAttempt(attempt + 1)}>Réessayer</Button>
					</div>
				)}
				{list?.count === 0 && (
					<p role="status" className="py-10 text-center text-[17px] text-[#6b7280]">
						Aucune entreprise ne correspond à votre recherche.
					</p>
				)}

				{/* Le favori demande un compte : le marque-page mène à la connexion */}
				<ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{list?.results.map(({ id, name, city, description, sector, employees }) => (
						<li key={id} className={card}>
							<div className="flex items-center gap-3">
								<span
									aria-hidden="true"
									className={`flex size-11 shrink-0 items-center justify-center rounded-[10px] font-bold ${emblemColors(id)} ${companyEmblem(name).length > 1 ? "text-[22px]" : "text-[28px]"}`}
								>
									{companyEmblem(name)}
								</span>
								<div className="flex min-w-0 flex-1 flex-col gap-[5px]">
									<h2 className="text-[19px] font-semibold">{name}</h2>
									{city && (
										<p className="flex items-center gap-1 text-[12px] text-[#6b7280]">
											<MapPinIcon width={12} height={12} className="text-gray-500" />
											{city}
										</p>
									)}
								</div>
								{/* Grey bookmark, blue on hover */}
								<Link to="/login" aria-label={`Ajouter ${name} à mes favoris`} className={`group shrink-0 rounded-sm ${focus}`}>
									<BookmarkIcon width={18} height={18} className="text-gray-400 group-hover:text-primary group-focus-visible:text-primary" />
								</Link>
							</div>
							{/* Présentation complète sur la page de l'entreprise : 2 lignes sur la carte, comme la maquette */}
							<p className="line-clamp-2 min-h-10 text-[15px] leading-5 text-[#6b7280]">{description}</p>
							{sector !== null && (
								<span className="self-start rounded-[5px] bg-[#f1f3f6] px-2 py-[5px] text-[11px] font-medium text-[#6b7280]">{sectorLabel(sector)}</span>
							)}
							<div className="mt-auto flex items-center justify-between border-t border-[#d1d5db] pt-4">
								<p className="flex items-center gap-[5px] text-[11px] text-[#6b7280]">
									{employees !== null && (
										<>
											<UsersIcon width={14} height={14} className="text-gray-500" />
											{formatEmployees(employees)}
										</>
									)}
								</p>
								<Link to={`/companies/${id}`} className={`flex items-center gap-[5px] rounded-sm text-[12px] font-semibold text-primary hover:underline ${focus}`}>
									Voir la fiche<span className="sr-only"> de {name}</span>
									<ArrowUpRightIcon width={14} height={14} className="" />
								</Link>
							</div>
						</li>
					))}
				</ul>

				{list && list.count > 0 && (
					<div className="flex flex-col items-center gap-3 pt-0.5 md:flex-row md:justify-between">
						<p className="text-[13px] text-[#6b7280]">{range}</p>
						<Pagination currentPage={page} totalPages={list.pages} onPageChange={setPage} />
					</div>
				)}
			</main>
		</div>
	);
}
