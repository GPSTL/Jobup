import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import ArrowLeftIcon from "../components/ArrowLeftIcon";
import Button from "../components/Button";
import CompanyLogo from "../components/CompanyLogo";
import Footer from "../components/Footer";
import GlobeIcon from "../components/GlobeIcon";
import MapPinIcon from "../components/MapPinIcon";
import PublicNavbar from "../components/PublicNavbar";
import UsersIcon from "../components/UsersIcon";
import { getCompany, type Company } from "../services/companies";
import { formatDate, formatEmployees, sectorLabel, websiteLabel } from "../utils/companies";
import { focus } from "../utils/searchPageStyles";
import { MESSAGES } from "../utils/validation";

type State =
	| { status: "loading" }
	| { status: "ready"; company: Company }
	| { status: "notFound" }
	| { status: "error"; message: string };

const backLink = `flex items-center gap-2 self-start rounded-sm text-sm font-semibold text-primary hover:underline ${focus}`;

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
		<div className="flex min-h-dvh flex-col bg-[#f8fafc] text-ink">
			<header className="px-4 pt-4 md:px-6 md:pt-6">
				<PublicNavbar />
			</header>

			<main className="mx-auto mt-8 mb-16 flex w-full max-w-[1000px] flex-1 flex-col gap-6 px-4 md:px-6">
				<Link to="/companies" className={backLink}>
					<ArrowLeftIcon width={18} height={18} />
					Retour aux entreprises
				</Link>

				{state.status === "loading" && (
					<div className="rounded-2xl border border-[#e5e7eb] bg-surface p-10 text-center shadow-xs">
						<p aria-busy="true" className="text-sm sm:text-base text-[#6b7280]">Chargement de l’entreprise…</p>
					</div>
				)}

				{state.status === "error" && (
					<div role="alert" className="flex flex-col items-center gap-4 rounded-2xl border border-[#e5e7eb] bg-surface p-10 text-center shadow-xs">
						<p className="text-sm sm:text-base">{state.message}</p>
						<Button onClick={() => setAttempt(attempt + 1)}>Réessayer</Button>
					</div>
				)}

				{state.status === "notFound" && (
					<div className="flex flex-col items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-surface p-10 text-center shadow-xs">
						<h1 className="text-2xl font-bold">Entreprise introuvable</h1>
						<p className="text-sm sm:text-base text-[#6b7280]">Cette entreprise n’existe pas ou n’est plus disponible.</p>
					</div>
				)}

				{state.status === "ready" && <CompanyDetails company={state.company} />}
			</main>

			<Footer />
		</div>
	);
}

function CompanyDetails({ company }: { company: Company }) {
	const { name, sector, city, employees, website, description, offers } = company;
	return (
		<>
			{/* Company Cover Header Card */}
			<header className="overflow-hidden rounded-3xl border border-[#e5e7eb] bg-surface shadow-xs">
				<div className="auth-mesh h-28 w-full sm:h-36" />
				<div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end sm:gap-6 sm:px-8">
					<div className="-mt-10 shrink-0 rounded-2xl border-4 border-surface bg-surface shadow-md">
						<CompanyLogo name={name} logoUrl={company.logo_url} className="size-20 rounded-xl text-2xl" />
					</div>
					<div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
						<div className="flex flex-wrap items-center gap-2.5">
							<h1 className="text-2xl font-bold sm:text-3xl">{name}</h1>
							{sector !== null && (
								<span className="rounded-full bg-[#dbeafe] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
									{sectorLabel(sector)}
								</span>
							)}
						</div>
						<ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs sm:text-sm text-[#6b7280]">
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
									<a href={website} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1.5 rounded-sm font-medium text-primary hover:underline ${focus}`}>
										<GlobeIcon width={16} height={16} />
										{websiteLabel(website)}
										<span className="sr-only"> (nouvel onglet)</span>
									</a>
								</li>
							)}
						</ul>
					</div>
				</div>
			</header>

			<div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
				{description && (
					<section aria-labelledby="about" className="flex flex-col gap-3 rounded-2xl border border-[#e5e7eb] bg-surface p-6 shadow-xs">
						<h2 id="about" className="text-lg font-semibold">À propos</h2>
						<p className="text-sm sm:text-base leading-relaxed whitespace-pre-line text-[#6b7280]">{description}</p>
					</section>
				)}

				<section aria-labelledby="offers" className={`flex flex-col gap-4 rounded-2xl border border-[#e5e7eb] bg-surface p-6 shadow-xs ${description ? "" : "lg:col-span-2"}`}>
					<h2 id="offers" className="flex items-center gap-2.5 text-lg font-semibold">
						Offres en cours
						<span className="rounded-full bg-[#dbeafe] px-2.5 py-0.5 text-xs font-semibold text-[#1d4ed8]">{offers.length}</span>
					</h2>
					{offers.length === 0 ? (
						<p className="text-sm text-[#6b7280]">Cette entreprise n’a pas d’offre en cours.</p>
					) : (
						<ul className="flex flex-col gap-3">
							{offers.map((offer) => (
								<li key={offer.id} className="flex flex-col gap-1.5 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-5 py-4 transition-colors hover:border-primary">
									<div className="flex items-start justify-between gap-2">
										<h3 className="text-base font-semibold text-ink">{offer.title}</h3>
										<Link to={`/offers/${offer.id}`} className={`shrink-0 text-xs font-semibold text-primary hover:underline ${focus}`}>
											Voir →
										</Link>
									</div>
									<p className="text-xs sm:text-sm text-[#6b7280]">
										{sectorLabel(offer.category)} • Publiée le {formatDate(offer.created_at)}
									</p>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</>
	);
}
