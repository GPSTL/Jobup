import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Button from "../components/Button";
import HeartIcon from "../components/HeartIcon";
import LoginBanner from "../components/LoginBanner";
import Navbar, { NavbarLink } from "../components/Navbar";
import StudentNavbar from "../components/StudentNavbar";
import RecruiterNavbar from "../components/RecruiterNavbar";
import Pagination from "../components/Pagination";
import { getSession, type SessionResult } from "../services/auth";
import { getOffer, getOffers, type PublicOffer, type PublicOfferResult } from "../services/offers";
import { card, field, focus, input, searchButton, select } from "../utils/searchPageStyles";
import { REQUEST_ERRORS } from "../utils/validation";

const PAGE_SIZE = 6;

export function PublicOfferRequestState({ result, retry, detail = false }: { result: PublicOfferResult<unknown> | null; retry: () => void; detail?: boolean }) {
	if (result === null) return <p role="status">Chargement des offres…</p>;
	if (result.ok) return null;
	if (detail && result.reason === "notFound") return <h2 role="alert" className="text-2xl font-semibold">Offre introuvable ou retirée</h2>;
	return <div role="alert"><p>{REQUEST_ERRORS[result.reason === "notFound" ? "server" : result.reason]}</p><Button className="mt-3" onClick={retry}>Réessayer</Button></div>;
}

export function PublicOfferList({ offers, page, onPageChange }: { offers: PublicOffer[]; page: number; onPageChange: (page: number) => void }) {
	if (offers.length === 0) return <p role="status" className={card}>Aucune offre publiée pour le moment. Revenez bientôt découvrir de nouvelles opportunités.</p>;
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
					<Link to={`/offers/${id}`} className={`rounded-[10px] border-[1.5px] border-[#d1d5db] bg-white px-3.5 py-[9px] text-center text-[14px] font-semibold hover:bg-[#f9fafb] ${focus}`}>Voir l’offre<span className="sr-only"> {title}</span></Link>
				</li>
			))}
		</ul>
		<Pagination currentPage={current} totalPages={totalPages} onPageChange={onPageChange} />
	</>;
}

export function PublicOfferDetail({ offer }: { offer: PublicOffer }) {
	return <>
		<h2 id="offer-detail-title" className="text-3xl font-semibold">{offer.title}</h2>
		<p className="mt-3 text-[#6b7280]">{offer.company?.name || "Entreprise non renseignée"}{offer.company?.city && ` • ${offer.company.city}`}</p>
		<p className="mt-6 whitespace-pre-wrap">{offer.description}</p>
		{offer.requirements && <div className="mt-5"><h3 className="font-semibold">Profil recherché</h3><p className="mt-2 whitespace-pre-wrap">{offer.requirements}</p></div>}
		<div className="mt-6 flex flex-wrap justify-end gap-3">
			<Button variant="outline" to="/offers">Retour aux offres</Button>
			<Link to="/login" state={{ studentReturnTo: `/offers/${offer.id}` }} className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-1 text-base font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Se connecter pour postuler</Link>
		</div>
	</>;
}

// The keyed component starts a fresh request on every detail URL, independently of the list page.
function OfferDetailRequest({ id }: { id: string }) {
	const navigate = useNavigate();
	const dialog = useRef<HTMLElement>(null);
	useEffect(() => {
		const previous = document.activeElement;
		dialog.current?.focus();
		return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
	}, []);
	const [result, setResult] = useState<PublicOfferResult<PublicOffer> | null>(null);
	const [attempt, setAttempt] = useState(0);
	useEffect(() => {
		let ignore = false;
		getOffer(id).then((response) => { if (!ignore) setResult(response); });
		return () => { ignore = true; };
	}, [id, attempt]);
	return <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
		<section ref={dialog} tabIndex={-1} onKeyDown={(event) => {
			if (event.key === "Escape") { event.preventDefault(); navigate("/offers"); }
			if (event.key !== "Tab") return;
			const controls = dialog.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex="0"]');
			if (!controls?.length) { event.preventDefault(); return; }
			const first = controls[0];
			const last = controls[controls.length - 1];
			if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
			else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
		}} role="dialog" aria-modal="true" aria-label="Détail de l’offre" className="my-auto max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-7 shadow-xl">
			{result?.ok ? <PublicOfferDetail offer={result.data} /> : <>
				<PublicOfferRequestState result={result} detail retry={() => { setResult(null); setAttempt((value) => value + 1); }} />
				<Button className="mt-5" to="/offers">Retour aux offres</Button>
			</>}
		</section>
	</div>;
}

export default function OffersPage() {
	const { id } = useParams();
	const [session, setSession] = useState<SessionResult | null>(null);
	const [result, setResult] = useState<PublicOfferResult<PublicOffer[]> | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [page, setPage] = useState(1);
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

	return (
		<div className="min-h-dvh bg-[#f0f0f0] px-4 pt-4 pb-16 text-[#111827] md:px-6 md:pt-6">
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

			<main className="mx-auto mt-10 flex max-w-[1236px] flex-col gap-[22px] leading-[normal]">
				<div className="flex flex-col gap-1.5">
					<h1 className="text-[40px] font-bold">Trouver une alternance</h1>
					{result?.ok && <p className="text-[17px] text-[#6b7280]">{result.data.length} offres d’alternance publiées par des entreprises partenaires.</p>}
				</div>
				<fieldset disabled aria-describedby="offer-search-unavailable" className="flex flex-col gap-3 md:flex-row md:items-start">
					<label className={`${field} md:flex-1`}><span className="sr-only">Poste, compétence ou entreprise</span><input placeholder="Poste, compétence ou entreprise" className={input} /></label>
					<label className={`${field} md:w-[260px]`}><span className="sr-only">Ville ou code postal</span><input placeholder="Ville ou code postal" className={input} /></label>
					<label className="md:w-[220px]"><span className="sr-only">Secteur</span><select className={`${select} text-[#9ca3af]`}><option>Secteur</option></select></label>
					<button type="button" className={`${searchButton} disabled:cursor-default disabled:opacity-50`}>Rechercher</button>
				</fieldset>
				<p id="offer-search-unavailable" className="text-sm text-[#6b7280]">La recherche et les filtres seront bientôt disponibles.</p>
				{session !== null && !session.ok && <LoginBanner>Connecte-toi pour swiper les offres, les sauvegarder et postuler en un clic.</LoginBanner>}
				{result?.ok ? <PublicOfferList offers={result.data} page={page} onPageChange={setPage} /> : <PublicOfferRequestState result={result} retry={() => { setResult(null); setPage(1); setAttempt((value) => value + 1); }} />}
			</main>
			{id && <OfferDetailRequest key={id} id={id} />}
		</div>
	);
}
