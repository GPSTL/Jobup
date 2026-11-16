import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Button from "../components/Button";
import ChevronDownIcon from "../components/ChevronDownIcon";
import HeartIcon from "../components/HeartIcon";
import LoginBanner from "../components/LoginBanner";
import MapPinIcon from "../components/MapPinIcon";
import Navbar, { NavbarLink } from "../components/Navbar";
import SearchIcon from "../components/SearchIcon";
import StudentNavbar from "../components/StudentNavbar";
import RecruiterNavbar from "../components/RecruiterNavbar";
import Pagination from "../components/Pagination";
import { getSession, type SessionResult } from "../services/auth";
import { saveDraft } from "../services/applications";
import { filterPublicOffers, getOffer, getOffers, type PublicOffer, type PublicOfferFilters, type PublicOfferResult } from "../services/offers";
export { filterPublicOffers } from "../services/offers";
import { card, field, focus, input, searchButton, select } from "../utils/searchPageStyles";
import { SECTOR_OPTIONS, sectorLabel } from "../utils/companies";
import { MESSAGES, REQUEST_ERRORS } from "../utils/validation";
import StudentOfferSwipe from "./StudentOfferSwipe";

const PAGE_SIZE = 6;

export function PublicOfferRequestState({ result, retry, detail = false }: { result: PublicOfferResult<unknown> | null; retry: () => void; detail?: boolean }) {
	if (result === null) return <p role="status">Chargement des offres…</p>;
	if (result.ok) return null;
	if (detail && result.reason === "notFound") return <h2 role="alert" className="text-2xl font-semibold">Offre introuvable ou retirée</h2>;
	return <div role="alert"><p>{REQUEST_ERRORS[result.reason === "notFound" ? "server" : result.reason]}</p><Button className="mt-3" onClick={retry}>Réessayer</Button></div>;
}

export function PublicOfferList({ offers, page, onPageChange, emptyMessage = "Aucune offre publiée pour le moment. Revenez bientôt découvrir de nouvelles opportunités." }: { offers: PublicOffer[]; page: number; onPageChange: (page: number) => void; emptyMessage?: string }) {
	if (offers.length === 0) return <p role="status" className={card}>{emptyMessage}</p>;
	const totalPages = Math.ceil(offers.length / PAGE_SIZE);
	const current = Math.max(1, Math.min(page, totalPages));
	return <>
		<ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{offers.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map(({ id, title, company }) => (
				<li key={id} className={card}>
					<img src="/static/img/home_bg_image.webp" alt="" loading="lazy" className="h-[150px] w-full rounded-[14px] object-cover" />
					<div className="flex items-center gap-2">
						<h2 className="flex-1 text-[19px] font-semibold">{title}</h2>
						<Link to="/login" state={{ studentReturnTo: `/offers/${id}` }} aria-label={`Sauvegarder l’offre ${title}`} className={`group shrink-0 rounded-sm ${focus}`}>
							<HeartIcon width={20} height={20} className="text-gray-400 group-hover:text-primary group-focus-visible:text-primary" />
						</Link>
					</div>
					<p className="text-[15px] text-[#6b7280]">{company?.name || "Entreprise non renseignée"}{company?.city && ` • ${company.city}`}</p>
					<div className="flex items-start gap-2">
						<span className="rounded-full bg-[#dbeafe] px-[10px] py-[5px] text-[13px] font-semibold text-[#1d4ed8]">Alternance</span>
					</div>
					<Link to={`/offers/${id}`} className={`rounded-[10px] border-[1.5px] border-[#d1d5db] bg-white px-3.5 py-[9px] text-center text-[14px] font-semibold hover:bg-[#f9fafb] ${focus}`}>Voir l’offre<span className="sr-only"> {title}</span></Link>
				</li>
			))}
		</ul>
		<Pagination currentPage={current} totalPages={totalPages} onPageChange={onPageChange} />
	</>;
}

export function PublicOfferDetail({ offer }: { offer: PublicOffer }) {
	return <>
		<Link to="/offers" className="flex w-fit items-center gap-2 rounded-sm px-1 py-2 font-semibold text-primary hover:underline">
			<span aria-hidden="true">←</span>Retour aux offres
		</Link>
		<div className="grid gap-8 md:grid-cols-[380px_minmax(0,1fr)]">
			<img src="/static/img/recruiter-offers/offer.webp" alt="Une équipe échange autour d’une table dans ses bureaux" className="h-[250px] w-full rounded-2xl object-cover" />
			<div className="flex min-w-0 flex-col gap-3.5">
				<h1 id="offer-detail-title" className="text-[30px] leading-tight font-semibold">{offer.title}</h1>
				{offer.company && <Link to={`/companies/${offer.company.id}`} className="font-medium text-primary hover:underline">{offer.company.name} — voir la page entreprise</Link>}
				<div className="flex flex-wrap gap-2">
					<span className="rounded-full bg-[#dbeafe] px-2.5 py-1 text-[13px] font-semibold text-[#1d4ed8]">Alternance</span>
					<span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[13px] font-semibold text-[#6b7280]">{sectorLabel(offer.category)}</span>
				</div>
				{offer.company?.city && <p className="flex items-center gap-2 text-[16px]"><MapPinIcon className="shrink-0 text-[#6b7280]" />{offer.company.city}</p>}
				<p className="text-[14px] text-[#6b7280]">Publiée le {new Date(offer.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
			</div>
		</div>
		<section aria-labelledby="offer-description-title" className="flex flex-col gap-3">
			<h2 id="offer-description-title" className="text-[20px] font-semibold">Description du poste</h2>
			<p className="whitespace-pre-wrap text-[16px] leading-normal text-[#6b7280]">{offer.description}</p>
		</section>
		{offer.requirements && <section aria-labelledby="offer-requirements-title" className="flex flex-col gap-3">
			<h2 id="offer-requirements-title" className="text-[20px] font-semibold">Profil recherché</h2>
			<p className="whitespace-pre-wrap text-[16px] leading-normal text-[#6b7280]">{offer.requirements}</p>
		</section>}
	</>;
}

function OfferDetailRequest({ id }: { id: string }) {
	const navigate = useNavigate();
	const [session, setSession] = useState<SessionResult | null>(null);
	const [result, setResult] = useState<PublicOfferResult<PublicOffer> | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [applying, setApplying] = useState(false);
	const [actionError, setActionError] = useState("");
	useEffect(() => {
		let ignore = false;
		getSession().then((response) => { if (!ignore) setSession(response); });
		return () => { ignore = true; };
	}, []);
	useEffect(() => {
		let ignore = false;
		getOffer(id).then((response) => { if (!ignore) setResult(response); });
		return () => { ignore = true; };
	}, [id, attempt]);
	const startApplication = async () => {
		if (!result?.ok || !session?.ok || session.user.role !== 1 || applying) return;
		setApplying(true);
		setActionError("");
		const draft = await saveDraft(result.data.id, "");
		setApplying(false);
		if (draft.ok) navigate(`/applications/${draft.application.id}/edit`);
		else if (draft.reason === "alreadySubmitted") setActionError("Vous avez déjà envoyé une candidature pour cette offre.");
		else if (draft.reason === "noSession") navigate("/login", { state: { studentReturnTo: `/offers/${id}` } });
		else setActionError(draft.reason === "network" ? MESSAGES.networkError : MESSAGES.serverError);
	};
	const student = session?.ok && session.user.role === 1;
	const recruiter = session?.ok && session.user.role === 3;
	return <div className="min-h-dvh bg-[#f0f0f0] px-4 pt-4 pb-16 text-[#111827] md:px-6 md:pt-[50px]">
		{session !== null && <header>
			{student ? <StudentNavbar /> : recruiter ? <RecruiterNavbar /> : session.ok ? null : <Navbar>
				<div className="hidden gap-12 lg:flex"><NavbarLink to="/offers">Trouver une alternance</NavbarLink><NavbarLink to="/companies">Explorer les entreprises</NavbarLink><NavbarLink to="/pricing">Tarifs</NavbarLink></div>
				<NavbarLink to="/signup" className="ml-auto">Inscription</NavbarLink><Button to="/login">Connexion</Button>
			</Navbar>}
		</header>}
		<main className="mx-auto mt-10 flex max-w-[1000px] flex-col gap-5 rounded-[25px] bg-white px-5 py-8 shadow-[0_4px_12px_rgba(0,0,0,0.1)] md:px-10 md:pt-8 md:pb-9">
			{result?.ok ? <>
				<PublicOfferDetail offer={result.data} />
				{actionError && <p role="alert" className="text-[15px] font-medium text-red-700">{actionError}</p>}
				<div className="flex flex-wrap items-center gap-3">
					{student ? <Button onClick={startApplication} disabled={applying}>{applying ? "Préparation…" : "Postuler"}</Button> : <Link to="/login" state={{ studentReturnTo: `/offers/${result.data.id}` }} className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-1 text-base font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Se connecter pour postuler</Link>}
					<Button variant="outline" disabled title="La sauvegarde des offres sera disponible prochainement">Sauvegarder</Button>
					<Button variant="outline" disabled title="Le signalement des offres sera disponible prochainement">Signaler l’offre</Button>
				</div>
			</> : <>
				<PublicOfferRequestState result={result} detail retry={() => { setResult(null); setAttempt((value) => value + 1); }} />
				{result !== null && <Button variant="outline" to="/offers">Retour aux offres</Button>}
			</>}
		</main>
	</div>;
}

function OffersIndexPage() {
	const [session, setSession] = useState<SessionResult | null>(null);
	const [result, setResult] = useState<PublicOfferResult<PublicOffer[]> | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [page, setPage] = useState(1);
	const [query, setQuery] = useState("");
	const [city, setCity] = useState("");
	const [sector, setSector] = useState("");
	const [filters, setFilters] = useState<PublicOfferFilters>({ query: "", city: "", sector: "" });
	useEffect(() => {
		let ignore = false;
		getSession().then((response) => { if (!ignore) setSession(response); });
		return () => { ignore = true; };
	}, []);
	useEffect(() => {
		let ignore = false;
		getOffers().then((response) => { if (!ignore) setResult(response); });
		return () => { ignore = true; };
	}, [attempt]);
	const onSearch = (event: FormEvent) => {
		event.preventDefault();
		setFilters({ query, city, sector });
		setPage(1);
	};
	const visibleOffers = result?.ok ? filterPublicOffers(result.data, filters) : [];

	return (
		<div className="min-h-dvh bg-[#f0f0f0] px-4 pt-4 pb-16 text-[#111827] md:px-6 md:pt-[50px]">
			{session !== null && <header>
				{session.ok && session.user.role === 1 ? <StudentNavbar /> : session.ok && session.user.role === 3 ? <RecruiterNavbar /> : session.ok ? null : <Navbar>
					<div className="hidden gap-12 lg:flex">
						<NavbarLink to="/offers">Trouver une alternance</NavbarLink>
						<NavbarLink to="/companies">Explorer les entreprises</NavbarLink>
						<NavbarLink to="/pricing">Tarifs</NavbarLink>
					</div>
					<NavbarLink to="/signup" className="ml-auto">Inscription</NavbarLink>
					<Button to="/login">Connexion</Button>
				</Navbar>}
			</header>}

			{session?.ok && session.user.role === 1 ? result?.ok ? <StudentOfferSwipe offers={result.data} /> : <main className="mx-auto mt-10 max-w-[1236px]"><PublicOfferRequestState result={result} retry={() => { setResult(null); setAttempt((value) => value + 1); }} /></main> : <main className="mx-auto mt-10 flex max-w-[1236px] flex-col gap-[22px] leading-[normal]">
				<div className="flex flex-col gap-1.5">
					<h1 className="text-[40px] font-bold">Trouver une alternance</h1>
					{result?.ok && <p className="text-[17px] text-[#6b7280]">{visibleOffers.length} offres d’alternance publiées par des entreprises partenaires.</p>}
				</div>
				<form role="search" onSubmit={onSearch} className="flex flex-col gap-3 md:flex-row md:items-start">
					<label className={`${field} md:flex-1`}>
						<SearchIcon width={20} height={20} className="shrink-0 text-gray-500" />
						<span className="sr-only">Poste, compétence ou entreprise</span>
						<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Poste, compétence ou entreprise" className={input} />
					</label>
					<label className={`${field} md:w-[260px]`}>
						<span className="sr-only">Ville ou code postal</span>
						<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ville ou code postal" className={input} />
						<MapPinIcon className="shrink-0 text-gray-500" />
					</label>
					<label className="relative md:w-[220px]">
						<span className="sr-only">Secteur</span>
						<select value={sector} onChange={(event) => setSector(event.target.value)} className={select}>
							<option value="">Secteur</option>
							{SECTOR_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
						</select>
						<ChevronDownIcon width={20} height={20} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-gray-500" />
					</label>
					<button type="submit" className={searchButton}>Rechercher</button>
				</form>
				{session !== null && !session.ok && <LoginBanner actions>Connecte-toi pour swiper les offres, les sauvegarder et postuler en un clic.</LoginBanner>}
				{result?.ok ? <>
					<p className="sr-only" aria-live="polite">{visibleOffers.length} offres correspondent à votre recherche.</p>
					<PublicOfferList
						offers={visibleOffers}
						page={page}
						onPageChange={setPage}
						emptyMessage={filters.query || filters.city || filters.sector ? "Aucune offre ne correspond à votre recherche." : undefined}
					/>
				</> : <PublicOfferRequestState result={result} retry={() => { setResult(null); setPage(1); setAttempt((value) => value + 1); }} />}
			</main>}
		</div>
	);
}

export default function OffersPage() {
	const { id } = useParams();
	return id ? <OfferDetailRequest key={id} id={id} /> : <OffersIndexPage />;
}
