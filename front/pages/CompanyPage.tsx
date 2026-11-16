import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import ArrowLeftIcon from "../components/ArrowLeftIcon";
import Button from "../components/Button";
import GlobeIcon from "../components/GlobeIcon";
import MapPinIcon from "../components/MapPinIcon";
import Navbar, { NavbarLink } from "../components/Navbar";
import UsersIcon from "../components/UsersIcon";
import { getCompany, type Company } from "../services/companies";
import { companyEmblem, formatDate, formatEmployees, sectorLabel, websiteLabel } from "../utils/companies";
import { focus } from "../utils/searchPageStyles";
import { MESSAGES } from "../utils/validation";

type State =
	| { status: "loading" }
	| { status: "ready"; company: Company }
	| { status: "notFound" }
	| { status: "error"; message: string };

const backLink = `flex items-center gap-2 self-start rounded-sm text-[15px] font-semibold text-primary hover:underline ${focus}`;

// Page de présentation d'une entreprise (JOB-021, maquette Page entreprise)
export default function CompanyPage() {
	const { id } = useParams();
	const [state, setState] = useState<State>({ status: "loading" });
	// Incrémenté par « Réessayer » pour relancer la requête
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		// Un identifiant non numérique ne peut correspondre à aucune entreprise
		const companyId = Number(id);
		if (!Number.isInteger(companyId) || companyId < 1) {
			setState({ status: "notFound" });
			return;
		}
		let ignore = false;
		setState({ status: "loading" });
		getCompany(companyId).then((result) => {
			if (ignore) return;
			if (result.ok) setState({ status: "ready", company: result.company });
			else if (result.reason === "notFound") setState({ status: "notFound" });
			else setState({ status: "error", message: result.reason === "network" ? MESSAGES.networkError : MESSAGES.serverError });
		});
		return () => {
			ignore = true;
		};
	}, [id, attempt]);

	return (
		<div className="min-h-dvh bg-[#f0f0f0] px-4 pt-4 pb-16 md:px-6 md:pt-6">
			{/* Même barre que le répertoire (CompaniesPage) */}
			<header>
				<Navbar>
					<div className="hidden gap-12 lg:flex">
						<NavbarLink to="/offers">Trouver une alternance</NavbarLink>
						<NavbarLink to="/companies">Explorer les entreprises</NavbarLink>
						<NavbarLink to="/pricing">Tarifs</NavbarLink>
					</div>
					<NavbarLink to="/signup" className="ml-auto">Inscription</NavbarLink>
					<Button to="/login">Connexion</Button>
				</Navbar>
			</header>

			<main className="mx-auto mt-10 flex max-w-[1236px] flex-col gap-6 rounded-[24px] bg-white px-5 py-8 leading-[normal] text-[#111827] shadow-[0_4px_12px_rgba(0,0,0,0.1)] md:px-10">
				<Link to="/companies" className={backLink}>
					<ArrowLeftIcon width={18} height={18} />
					Retour aux entreprises
				</Link>

				{state.status === "loading" && (
					<p aria-busy="true" className="py-10 text-center text-[17px] text-[#6b7280]">Chargement de l’entreprise…</p>
				)}

				{state.status === "error" && (
					<div role="alert" className="flex flex-col items-center gap-4 py-10 text-center">
						<p className="text-[17px]">{state.message}</p>
						<Button onClick={() => setAttempt(attempt + 1)}>Réessayer</Button>
					</div>
				)}

				{state.status === "notFound" && (
					<div className="flex flex-col items-center gap-2 py-10 text-center">
						<h1 className="text-[28px] font-bold">Entreprise introuvable</h1>
						<p className="text-[17px] text-[#6b7280]">Cette entreprise n’existe pas ou n’est plus disponible.</p>
					</div>
				)}

				{state.status === "ready" && <CompanyDetails company={state.company} />}
			</main>
		</div>
	);
}

function CompanyDetails({ company }: { company: Company }) {
	const { name, sector, city, employees, website, description, offers } = company;
	return (
		<>
			<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
				<span aria-hidden="true" className="flex size-[88px] shrink-0 items-center justify-center rounded-[20px] bg-primary text-[34px] font-bold text-on-primary">
					{companyEmblem(name)}
				</span>
				<div className="flex min-w-0 flex-col gap-1.5">
					<h1 className="text-[32px] font-bold">{name}</h1>
					{sector !== null && <p className="text-[17px] text-[#6b7280]">{sectorLabel(sector)}</p>}
					{/* Chaque information n'apparaît que si l'entreprise l'a renseignée */}
					<ul className="flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-[#6b7280]">
						{city && (
							<li className="flex items-center gap-1.5">
								<MapPinIcon width={16} height={16} />
								{city}
							</li>
						)}
						{employees !== null && (
							<li className="flex items-center gap-1.5">
								<UsersIcon width={16} height={16} />
								{formatEmployees(employees)}
							</li>
						)}
						{website && (
							<li>
								<a href={website} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1.5 rounded-sm hover:underline ${focus}`}>
									<GlobeIcon width={16} height={16} />
									{websiteLabel(website)}
									<span className="sr-only"> (nouvel onglet)</span>
								</a>
							</li>
						)}
					</ul>
				</div>
			</header>

			{description && (
				<section aria-labelledby="about" className="flex flex-col gap-3">
					<h2 id="about" className="text-[20px] font-semibold">À propos</h2>
					<p className="text-[15px] leading-6 whitespace-pre-line text-[#6b7280]">{description}</p>
				</section>
			)}

			<section aria-labelledby="offers" className="flex flex-col gap-3">
				<h2 id="offers" className="flex items-center gap-3 text-[20px] font-semibold">
					Offres en cours
					<span className="rounded-full bg-[#f1f3f6] px-2.5 py-0.5 text-[13px] font-medium text-[#6b7280]">{offers.length}</span>
				</h2>
				{offers.length === 0 ? (
					<p className="text-[15px] text-[#6b7280]">Cette entreprise n’a pas d’offre en cours.</p>
				) : (
					<ul className="flex flex-col gap-3">
						{/* TODO JOB-022 : ajouter « Voir l'offre » vers le détail de l'offre quand sa page existera */}
						{offers.map((offer) => (
							<li key={offer.id} className="flex flex-col gap-1 rounded-[14px] border border-[#e5e7eb] bg-[#f9fafb] px-5 py-4">
								<h3 className="text-[17px] font-semibold">{offer.title}</h3>
								<p className="text-[13px] text-[#6b7280]">
									{sectorLabel(offer.category)} • Publiée le {formatDate(offer.created_at)}
								</p>
							</li>
						))}
					</ul>
				)}
			</section>
		</>
	);
}
