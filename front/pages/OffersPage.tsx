import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import Button from "../components/Button";
import { offerRequest, type OfferPage } from "../services/offers";
import HeartIcon from "../components/HeartIcon";
import LoginBanner from "../components/LoginBanner";
import MapPinIcon from "../components/MapPinIcon";
import Navbar, { NavbarLink } from "../components/Navbar";
import Pagination from "../components/Pagination";
import SearchIcon from "../components/SearchIcon";
import { card, field, focus, input, searchButton, select } from "../utils/searchPageStyles";

const SECTEURS = [[1, "Informatique"], [2, "Data / IA"], [10, "Marketing / Communication"], [17, "Design"], [20, "Ressources humaines"], [99, "Autre"]] as const;

export default function OffersPage() {
	const [page, setPage] = useState(1);
	const [data, setData] = useState<OfferPage | null>(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);
	const [query, setQuery] = useState("");
	const [location, setLocation] = useState("");
	const [secteur, setSecteur] = useState("");
	const [search, setSearch] = useState("");
	const [revision, setRevision] = useState(0);
	useEffect(() => {
		let active = true;
		setLoading(true); setError(""); setData(null);
		offerRequest<OfferPage>(`/api/offers?page=${page}&${search}`).then(result => { if (active) setData(result); })
			.catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
		return () => { active = false; };
	}, [page, search, revision]);
	useEffect(() => {
		const refresh = () => { if (document.visibilityState === "visible") setRevision(value => value + 1); };
		document.addEventListener("visibilitychange", refresh);
		return () => document.removeEventListener("visibilitychange", refresh);
	}, []);
	const onSearch = (event: FormEvent) => {
		event.preventDefault(); setPage(1); setSearch(new URLSearchParams({ q: query, location, category: secteur }).toString());
	};

	return (
		<div className="min-h-dvh bg-[#f0f0f0] px-4 pt-4 pb-16 text-[#111827] md:px-6 md:pt-6">
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

			<main className="mx-auto mt-10 flex max-w-[1236px] flex-col gap-[22px] leading-[normal]">
				<div className="flex flex-col gap-1.5">
					<h1 className="text-[40px] font-bold">Trouver une alternance</h1>
					<p className="text-[17px] text-[#6b7280]">{data?.count ?? "…"} offres d’alternance publiées par des entreprises partenaires.</p>
				</div>

				<form role="search" onSubmit={onSearch} className="flex flex-col gap-3 md:flex-row md:items-start">
					<label className={`${field} md:flex-1`}>
						<SearchIcon width={20} height={20} className="text-gray-500" />
						<span className="sr-only">Poste, compétence ou entreprise</span>
						<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Poste, compétence ou entreprise" className={input} />
					</label>
					<label className={`${field} md:w-[260px]`}>
						<span className="sr-only">Ville ou code postal</span>
						<input value={location} onChange={event => setLocation(event.target.value)} placeholder="Ville ou code postal" className={input} />
						<MapPinIcon width={20} height={20} className="text-gray-500" />
					</label>
					<label className="md:w-[220px]">
						<span className="sr-only">Secteur</span>
						<select value={secteur} onChange={event => setSecteur(event.target.value)} className={select}>
							<option value="">Secteur</option>
							{SECTEURS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
						</select>
					</label>
					<button
						type="submit"
						className={searchButton}
					>
						Rechercher
					</button>
				</form>

				<LoginBanner>Connecte-toi pour swiper les offres, les sauvegarder et postuler en un clic.</LoginBanner>

				{loading && <p role="status">Chargement…</p>}
				{error && <div role="alert"><p>{error}</p><Button onClick={() => setRevision(value => value + 1)}>Réessayer</Button></div>}
				{data?.count === 0 && <p>Aucune offre disponible.</p>}
				<ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{(data?.results ?? []).map(({ id, title, company, location: city, duration, image_url, contract_type }) => (
						<li key={id} className={card}>
							{image_url && <img src={image_url} alt="" loading="lazy" className="h-[150px] w-full rounded-[14px] object-cover" />}
							<div className="flex items-center gap-2">
								<h2 className="flex-1 text-[19px] font-semibold">{title}</h2>
								<Link to="/login" aria-label={`Sauvegarder l’offre ${title}`} className={`group shrink-0 rounded-sm ${focus}`}>
									<HeartIcon width={20} height={20} className="text-gray-400 group-hover:text-primary group-focus-visible:text-primary" />
								</Link>
							</div>
							<p className="text-[15px] text-[#6b7280]">
								{company} • {city}
							</p>
							<div className="flex gap-2">
								{contract_type && <span className="rounded-full bg-primary/10 px-2.5 py-[5px] text-[13px] font-semibold text-primary">{contract_type.toUpperCase()}</span>}
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

				<Pagination currentPage={page} totalPages={Math.ceil((data?.count ?? 0) / 6)} onPageChange={setPage} />
			</main>
		</div>
	);
}
