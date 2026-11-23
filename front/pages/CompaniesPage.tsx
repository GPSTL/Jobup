import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import ArrowUpRightIcon from "../components/ArrowUpRightIcon";
import BookmarkIcon from "../components/BookmarkIcon";
import Button from "../components/Button";
import ChevronDownIcon from "../components/ChevronDownIcon";
import CompanyLogo from "../components/CompanyLogo";
import Footer from "../components/Footer";
import LoginBanner from "../components/LoginBanner";
import MapPinIcon from "../components/MapPinIcon";
import PublicNavbar from "../components/PublicNavbar";
import StudentNavbar from "../components/StudentNavbar";
import RecruiterNavbar from "../components/RecruiterNavbar";
import SchoolNavbar from "../components/SchoolNavbar";
import AdminNavbar from "../components/AdminNavbar";
import Pagination from "../components/Pagination";
import SearchIcon from "../components/SearchIcon";
import SortIcon from "../components/SortIcon";
import UsersIcon from "../components/UsersIcon";
import { getSession, type SessionResult } from "../services/auth";
import { card, field, focus, input, searchButton, select } from "../utils/searchPageStyles";
import { getCities, getCompanies, PAGE_SIZE, type CompanyFilters, type CompanyList } from "../services/companies";
import { companyEmblem, emblemColors, formatEmployees, SECTOR_OPTIONS, sectorLabel } from "../utils/companies";
import { highlightText } from "../utils/highlight";
import { MESSAGES } from "../utils/validation";

// TODO: replace provisional company-size options with backend reference data.
const TAILLES = ["Moins de 50 salariés", "50 à 250 salariés", "250 à 1 000 salariés", "Plus de 1 000 salariés"];
// TODO: connect these provisional sort options to backend sorting.
const TRIS = ["Pertinence", "Nom", "Nombre de salariés"];

const fit = "field-sizing-content";
const filter = `min-h-10 cursor-pointer appearance-none rounded-xl border border-[#d1d5db] bg-surface py-2 pr-9 pl-3.5 text-xs sm:text-sm text-ink outline-none focus:border-primary ${fit}`;

export default function CompaniesPage() {
	const [session, setSession] = useState<SessionResult | null>(null);
	useEffect(() => {
		let ignore = false;
		getSession().then((result) => { if (!ignore) setSession(result); });
		return () => { ignore = true; };
	}, []);
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
		<div className="flex min-h-dvh flex-col bg-[#f8fafc] text-ink">
			<div className="hero-mesh border-b border-[#e5e7eb]">
				{session !== null && <header className="px-4 pt-4 md:px-6 md:pt-6">
					{session.ok && session.user.role === 1 ? <StudentNavbar variant="glass" /> : session.ok && session.user.role === 2 ? <SchoolNavbar variant="glass" /> : session.ok && session.user.role === 3 ? <RecruiterNavbar variant="glass" /> : session.ok && session.user.role === 127 ? <AdminNavbar /> : <PublicNavbar variant="glass" />}
				</header>}

				<div className="mx-auto flex max-w-[1236px] flex-col gap-6 px-4 pt-8 pb-10 md:px-6 md:pt-10 md:pb-12">
					<div className="flex flex-col gap-2">
						<span className="w-fit rounded-full bg-[#dbeafe] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
							Annuaire partenaires
						</span>
						<h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Découvrez votre prochaine entreprise.</h1>
						<p className="text-sm sm:text-base text-[#6b7280]">Explorez les entreprises, leurs activités et les équipes qui recrutent en alternance.</p>
					</div>

					<form role="search" onSubmit={onSearch} className="flex flex-col gap-2.5 rounded-2xl border border-[#e5e7eb] bg-surface p-2.5 shadow-md md:flex-row md:items-center">
						<label className={`${field} border-transparent bg-[#f9fafb] md:flex-1`}>
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
							<select value={city} onChange={(e) => setCity(e.target.value)} className={`${select} border-transparent bg-[#f9fafb]`}>
								<option value="">Toute la France</option>
								{cities.map((c) => <option key={c}>{c}</option>)}
							</select>
							<ChevronDownIcon width={20} height={20} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-gray-500" />
						</label>
						<button type="submit" className={searchButton}>Rechercher</button>
					</form>
				</div>
			</div>

			<main className="mx-auto mt-8 flex w-full max-w-[1236px] flex-1 flex-col gap-6 px-4 pb-16 md:px-6">
				{session !== null && !session.ok && <LoginBanner>Crée ton compte pour suivre des entreprises et leur écrire directement.</LoginBanner>}

				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<nav aria-label="Collections" className="flex gap-1.5">
						<Link to="/companies" aria-current="page" className={`rounded-lg bg-[#dbeafe] px-4 py-2 text-xs sm:text-sm font-semibold text-[#1d4ed8] ${focus}`}>
							Toutes les entreprises
						</Link>
						{/* Favorites need an account */}
						<Link to="/login" className={`rounded-lg px-4 py-2 text-xs sm:text-sm font-medium text-[#6b7280] hover:bg-[#f1f3f6] ${focus}`}>
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
							<ChevronDownIcon width={14} height={14} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-500" />
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
							<ChevronDownIcon width={14} height={14} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-500" />
						</label>
						<label className="relative flex items-center pl-2">
							{/* TODO: sort company results by the selected criterion. */}
							<span className="sr-only">Trier par</span>
							<select className={`${fit} cursor-pointer appearance-none bg-transparent py-2 pr-6 text-xs sm:text-sm text-[#6b7280] ${focus}`}>
								{TRIS.map((t) => (
									<option key={t}>{t}</option>
								))}
							</select>
							<SortIcon width={16} height={16} className="pointer-events-none absolute right-0 text-gray-500" />
						</label>
					</div>
				</div>

				{!list && !error && (
					<p aria-busy="true" className="py-10 text-center text-sm sm:text-base text-[#6b7280]">Chargement des entreprises…</p>
				)}
				{error && (
					<div role="alert" className="flex flex-col items-center gap-4 py-10 text-center">
						<p className="text-sm sm:text-base">{error}</p>
						<Button onClick={() => setAttempt(attempt + 1)}>Réessayer</Button>
					</div>
				)}
				{list?.count === 0 && (
					<p role="status" className="py-10 text-center text-sm sm:text-base text-[#6b7280]">
						Aucune entreprise ne correspond à votre recherche.
					</p>
				)}

				{/* Le favori demande un compte : le marque-page mène à la connexion */}
				<ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{list?.results.map(({ id, name, logo_url, city, description, sector, employees }) => (
						<li key={id} className={card}>
							<div className="flex items-center gap-3">
								<CompanyLogo
									name={name}
									logoUrl={logo_url}
									className={`size-12 rounded-xl ${companyEmblem(name).length > 1 ? "text-base" : "text-lg"}`}
									emblemClassName={emblemColors(id)}
								/>
								<div className="flex min-w-0 flex-1 flex-col gap-0.5">
									<h2 className="text-lg font-bold text-ink">{highlightText(name, filters.q)}</h2>
									{city && (
										<p className="flex items-center gap-1 text-xs text-[#6b7280]">
											<MapPinIcon width={12} height={12} className="text-gray-500" />
											{highlightText(city, [filters.city ?? "", filters.q ?? ""])}
										</p>
									)}
								</div>
								{/* Grey bookmark, blue on hover */}
								<Link to="/login" aria-label={`Ajouter ${name} à mes favoris`} className={`group shrink-0 rounded-lg p-1.5 hover:bg-[#f3f4f6] ${focus}`}>
									<BookmarkIcon width={18} height={18} className="text-gray-400 group-hover:text-primary group-focus-visible:text-primary" />
								</Link>
							</div>
							{/* Présentation complète sur la page de l'entreprise : 2 lignes sur la carte, comme la maquette */}
							<p className="line-clamp-2 min-h-10 text-sm leading-relaxed text-[#6b7280]">{highlightText(description, filters.q)}</p>
							{sector !== null && (
								<span className="self-start rounded-md bg-[#f1f3f6] px-2.5 py-1 text-xs font-medium text-[#6b7280]">{highlightText(sectorLabel(sector), filters.q)}</span>
							)}
							<div className="mt-auto flex items-center justify-between border-t border-[#e5e7eb] pt-3.5">
								<p className="flex items-center gap-1.5 text-xs text-[#6b7280]">
									{employees !== null && (
										<>
											<UsersIcon width={14} height={14} className="text-gray-500" />
											{formatEmployees(employees)}
										</>
									)}
								</p>
								<Link to={`/companies/${id}`} className={`inline-flex items-center gap-1 rounded-xl bg-[#f9fafb] px-3 py-1.5 text-xs sm:text-sm font-semibold text-primary transition-colors hover:bg-[#dbeafe] ${focus}`}>
									Voir la fiche<span className="sr-only"> de {name}</span>
									<ArrowUpRightIcon width={14} height={14} className="" />
								</Link>
							</div>
						</li>
					))}
				</ul>

				{list && list.count > 0 && (
					<div className="flex flex-col items-center gap-3 pt-1 md:flex-row md:justify-between">
						<p className="text-xs sm:text-sm text-[#6b7280]">{range}</p>
						<Pagination currentPage={page} totalPages={list.pages} onPageChange={setPage} />
					</div>
				)}
			</main>

			<Footer />
		</div>
	);
}
