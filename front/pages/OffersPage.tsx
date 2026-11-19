import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Button from "../components/Button";
import ChevronDownIcon from "../components/ChevronDownIcon";
import ExportPanel from "../components/ExportPanel";
import Footer from "../components/Footer";
import HeartIcon from "../components/HeartIcon";
import LoginBanner from "../components/LoginBanner";
import MapPinIcon from "../components/MapPinIcon";
import PublicNavbar from "../components/PublicNavbar";
import SearchIcon from "../components/SearchIcon";
import StudentNavbar from "../components/StudentNavbar";
import RecruiterNavbar from "../components/RecruiterNavbar";
import Pagination from "../components/Pagination";
import { getSession, type SessionResult } from "../services/auth";
import { saveDraft } from "../services/applications";
import { isOfferSaved, removeSavedOffer, saveOffer } from "../services/savedOffers";
import { filterPublicOffers, getOffer, getOffers, type PublicOffer, type PublicOfferFilters, type PublicOfferResult } from "../services/offers";
export { filterPublicOffers } from "../services/offers";
import { card, field, focus, input, searchButton, select } from "../utils/searchPageStyles";
import { companyEmblem, emblemColors, SECTOR_OPTIONS, sectorLabel } from "../utils/companies";
import { MESSAGES, REQUEST_ERRORS } from "../utils/validation";
import StudentOfferSwipe from "./StudentOfferSwipe";

const PAGE_SIZE = 6;

export function PublicOfferRequestState({ result, retry, detail = false }: { result: PublicOfferResult<unknown> | null; retry: () => void; detail?: boolean }) {
	if (result === null) return <p role="status" className="py-10 text-center text-sm text-[#6b7280]">Chargement des offres…</p>;
	if (result.ok) return null;
	if (detail && result.reason === "notFound") return <h2 role="alert" className="text-xl font-semibold">Offre introuvable ou retirée</h2>;
	return <div role="alert" className="py-8 text-center"><p className="text-sm">{REQUEST_ERRORS[result.reason === "notFound" ? "server" : result.reason]}</p><Button className="mt-3" onClick={retry}>Réessayer</Button></div>;
}

export function PublicOfferList({ offers, page, onPageChange, emptyMessage = "Aucune offre publiée pour le moment. Revenez bientôt découvrir de nouvelles opportunités." }: { offers: PublicOffer[]; page: number; onPageChange: (page: number) => void; emptyMessage?: string }) {
	if (offers.length === 0) return <p role="status" className={`${card} py-10 text-center text-sm text-[#6b7280]`}>{emptyMessage}</p>;
	const totalPages = Math.ceil(offers.length / PAGE_SIZE);
	const current = Math.max(1, Math.min(page, totalPages));
	return <>
		<ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{offers.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map(({ id, title, description, category, created_at, company }) => {
				const companyName = company?.name || "Entreprise non renseignée";
				const initials = company ? companyEmblem(company.name) : "JU";
				const badgeColor = company ? emblemColors(company.id) : "bg-[#dbeafe] text-[#1d4ed8]";
				return (
					<li key={id} className={card}>
						<div className="flex items-start justify-between gap-3">
							<div className="flex min-w-0 items-center gap-3">
								<span aria-hidden="true" className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${badgeColor}`}>
									{initials}
								</span>
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold text-ink">{companyName}</p>
									{company?.city && (
										<p className="flex items-center gap-1 text-xs text-[#6b7280]">
											<MapPinIcon width={12} height={12} className="shrink-0" />
											{company.city}
										</p>
									)}
								</div>
							</div>
							<Link to="/login" state={{ studentReturnTo: `/offers/${id}` }} aria-label={`Sauvegarder l’offre ${title}`} className={`group shrink-0 rounded-lg p-1.5 hover:bg-[#f3f4f6] ${focus}`}>
								<HeartIcon width={18} height={18} className="text-gray-400 transition-colors group-hover:text-primary group-focus-visible:text-primary" />
							</Link>
						</div>

						<div className="flex flex-col gap-2 pt-1">
							<h2 className="text-lg leading-snug font-bold text-ink">{title}</h2>
							<div className="flex flex-wrap items-center gap-1.5">
								<span className="rounded-md bg-[#dbeafe] px-2.5 py-0.5 text-xs font-semibold text-[#1d4ed8]">Alternance</span>
								<span className="rounded-md bg-[#f3f4f6] px-2.5 py-0.5 text-xs font-medium text-[#6b7280]">{sectorLabel(category)}</span>
							</div>
							{description && <p className="line-clamp-2 text-sm leading-relaxed text-[#6b7280]">{description}</p>}
						</div>

						<div className="mt-auto flex items-center justify-between border-t border-[#e5e7eb] pt-3.5">
							<span className="text-xs text-[#6b7280]">
								{new Date(created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
							</span>
							<Link to={`/offers/${id}`} className={`inline-flex items-center gap-1.5 rounded-xl bg-[#f9fafb] px-3.5 py-2 text-xs sm:text-sm font-semibold text-primary transition-colors hover:bg-[#dbeafe] ${focus}`}>
								Voir l’offre<span className="sr-only"> {title}</span> <span aria-hidden="true">→</span>
							</Link>
						</div>
					</li>
				);
			})}
		</ul>
		<Pagination currentPage={current} totalPages={totalPages} onPageChange={onPageChange} />
	</>;
}

export function PublicOfferDetail({ offer }: { offer: PublicOffer }) {
	return <>
		<Link to="/offers" className="flex w-fit items-center gap-2 rounded-sm px-1 py-1 text-sm font-semibold text-primary hover:underline">
			<span aria-hidden="true">←</span>Retour aux offres
		</Link>
		<div className="grid gap-6 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-5 md:grid-cols-[320px_minmax(0,1fr)] md:gap-8 sm:p-6">
			<img src="/static/img/recruiter-offers/offer.webp" alt="Une équipe échange autour d’une table dans ses bureaux" className="h-56 w-full rounded-xl object-cover" />
			<div className="flex min-w-0 flex-col justify-center gap-3">
				<div className="flex flex-wrap gap-2">
					<span className="rounded-full bg-[#dbeafe] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">Alternance</span>
					<span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-[#6b7280]">{sectorLabel(offer.category)}</span>
				</div>
				<h1 id="offer-detail-title" className="text-2xl leading-tight font-bold sm:text-3xl">{offer.title}</h1>
				{offer.company && <Link to={`/companies/${offer.company.id}`} className="w-fit text-sm sm:text-base font-semibold text-primary hover:underline">{offer.company.name} — voir la page entreprise</Link>}
				<div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs sm:text-sm text-[#6b7280]">
					{offer.company?.city && <p className="flex items-center gap-1.5"><MapPinIcon className="shrink-0 text-[#6b7280]" />{offer.company.city}</p>}
					<p>Publiée le {new Date(offer.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
				</div>
			</div>
		</div>
		<div className="grid gap-6 md:grid-cols-2">
			<section aria-labelledby="offer-description-title" className={`flex flex-col gap-2.5 rounded-2xl border border-[#e5e7eb] bg-surface p-5 ${offer.requirements ? "" : "md:col-span-2"}`}>
				<h2 id="offer-description-title" className="text-lg font-semibold">Description du poste</h2>
				<p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed text-[#6b7280]">{offer.description}</p>
			</section>
			{offer.requirements && <section aria-labelledby="offer-requirements-title" className="flex flex-col gap-2.5 rounded-2xl border border-[#e5e7eb] bg-surface p-5">
				<h2 id="offer-requirements-title" className="text-lg font-semibold">Profil recherché</h2>
				<p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed text-[#6b7280]">{offer.requirements}</p>
			</section>}
		</div>
	</>;
}

function OfferDetailRequest({ id }: { id: string }) {
	const navigate = useNavigate();
	const [session, setSession] = useState<SessionResult | null>(null);
	const [result, setResult] = useState<PublicOfferResult<PublicOffer> | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [applying, setApplying] = useState(false);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
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
	useEffect(() => {
		let ignore = false;
		if (session?.ok && session.user.role === 1) {
			isOfferSaved(Number(id)).then((result) => {
				if (!ignore && result.ok) setSaved(result.data);
			});
		} else setSaved(false);
		return () => { ignore = true; };
	}, [id, session]);
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
	const toggleSaved = async () => {
		if (saving) return;
		setSaving(true);
		const result = saved ? await removeSavedOffer(Number(id)) : await saveOffer(Number(id));
		setSaving(false);
		if (!result.ok) {
			setActionError("Impossible de mettre à jour cette offre sauvegardée.");
			return;
		}
		setActionError("");
		setSaved(!saved);
	};
	return <div className="flex min-h-dvh flex-col bg-[#f8fafc] text-ink">
		{session !== null && <header className="px-4 pt-4 md:px-6 md:pt-6">
			{student ? <StudentNavbar /> : recruiter ? <RecruiterNavbar /> : session.ok ? null : <PublicNavbar />}
		</header>}
		<main className="mx-auto mt-8 mb-16 flex w-full max-w-[1000px] flex-col gap-6 rounded-2xl border border-[#e5e7eb] bg-surface px-5 py-7 shadow-xs md:px-10 md:py-8">
			{result?.ok ? <>
				<PublicOfferDetail offer={result.data} />
				{actionError && <p role="alert" className="text-sm font-medium text-red-700">{actionError}</p>}
				<div className="flex flex-wrap items-center gap-3 border-t border-[#e5e7eb] pt-4">
					{student ? <Button onClick={startApplication} disabled={applying}>{applying ? "Préparation…" : "Postuler"}</Button> : <Link to="/login" state={{ studentReturnTo: `/offers/${result.data.id}` }} className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Se connecter pour postuler</Link>}
					{student ? <Button variant="outline" onClick={toggleSaved} disabled={saving}>{saving ? "Mise à jour…" : saved ? "Retirer des sauvegardées" : "Sauvegarder"}</Button> : <Button variant="outline" disabled title="Connectez-vous avec un compte étudiant pour sauvegarder cette offre">Sauvegarder</Button>}
					{student && <ExportPanel url={`/api/offers/${result.data.id}/export`} fields={[]} />}
					<Button variant="outline" disabled title="Le signalement des offres sera disponible prochainement">Signaler l’offre</Button>
				</div>
			</> : <>
				<PublicOfferRequestState result={result} detail retry={() => { setResult(null); setAttempt((value) => value + 1); }} />
				{result !== null && <Button variant="outline" to="/offers">Retour aux offres</Button>}
			</>}
		</main>
		<Footer />
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
	const isStudent = session?.ok && session.user.role === 1;

	return (
		<div className="flex min-h-dvh flex-col bg-[#f8fafc] text-ink">
			<div className={isStudent ? "" : "hero-mesh border-b border-[#e5e7eb]"}>
				{session !== null && <header className="px-4 pt-4 md:px-6 md:pt-6">
					{isStudent ? <StudentNavbar /> : session.ok && session.user.role === 3 ? <RecruiterNavbar /> : session.ok ? null : <PublicNavbar variant="glass" />}
				</header>}

				{!isStudent && (
					<div className="mx-auto flex max-w-[1236px] flex-col gap-6 px-4 pt-8 pb-10 md:px-6 md:pt-10 md:pb-12">
						<div className="flex flex-col gap-2">
							<span className="w-fit rounded-full bg-[#dbeafe] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
								 Opportunités d’alternance
							</span>
							<h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Trouver une alternance</h1>
							{result?.ok && <p className="text-sm sm:text-base text-[#6b7280]">{visibleOffers.length} offres d’alternance publiées par des entreprises partenaires.</p>}
						</div>
						<form role="search" onSubmit={onSearch} className="flex flex-col gap-2.5 rounded-2xl border border-[#e5e7eb] bg-surface p-2.5 shadow-md md:flex-row md:items-center">
							<label className={`${field} border-transparent bg-[#f9fafb] md:flex-1`}>
								<SearchIcon width={20} height={20} className="shrink-0 text-gray-500" />
								<span className="sr-only">Poste, compétence ou entreprise</span>
								<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Poste, compétence ou entreprise" className={input} />
							</label>
							<label className={`${field} border-transparent bg-[#f9fafb] md:w-[240px]`}>
								<span className="sr-only">Ville ou code postal</span>
								<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ville ou code postal" className={input} />
								<MapPinIcon className="shrink-0 text-gray-500" />
							</label>
							<label className="relative md:w-[220px]">
								<span className="sr-only">Secteur</span>
								<select value={sector} onChange={(event) => setSector(event.target.value)} className={`${select} border-transparent bg-[#f9fafb]`}>
									<option value="">Secteur</option>
									{SECTOR_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
								</select>
								<ChevronDownIcon width={20} height={20} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-gray-500" />
							</label>
							<button type="submit" className={searchButton}>Rechercher</button>
						</form>
					</div>
				)}
			</div>

			{isStudent ? result?.ok ? <div className="px-4 md:px-6"><StudentOfferSwipe offers={result.data} /></div> : <main className="mx-auto mt-8 w-full max-w-[1236px] flex-1 px-4 pb-16 md:px-6"><PublicOfferRequestState result={result} retry={() => { setResult(null); setAttempt((value) => value + 1); }} /></main> : <main className="mx-auto mt-8 flex w-full max-w-[1236px] flex-1 flex-col gap-6 px-4 pb-16 md:px-6">
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
			<Footer />
		</div>
	);
}

export default function OffersPage() {
	const { id } = useParams();
	return id ? <OfferDetailRequest key={id} id={id} /> : <OffersIndexPage />;
}
