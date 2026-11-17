import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import PublicNavbar from "../components/PublicNavbar";
import HandshakeIcon from "../components/HandshakeIcon";
import Filter from "../components/Filter";
import Megaphone from "../components/Megaphone";

const features = [
	{
		title: "Suivez vos étudiants",
		Icon: Megaphone,
		description: "Statuts, candidatures envoyées et taux de placement en un coup d’œil.",
	},
	{
		title: "Centralisez les contrats",
		Icon: Filter,
		description: "Les contrats déposés par les entreprises arrivent directement dans votre espace.",
	},
	{
		title: "Accompagnez au bon moment",
		Icon: HandshakeIcon,
		description: "Échangez avec vos étudiants et leurs entreprises depuis la messagerie.",
	},
];

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function SchoolPage() {
	return (
		<div className="flex min-h-dvh flex-col bg-[#f8fafc] font-sans text-ink">
			<div className="hero-mesh border-b border-[#e5e7eb]">
				<header className="px-4 pt-4 md:px-6 md:pt-6">
					<PublicNavbar variant="glass" signupTo="/signup?role=school" />
				</header>

				<section aria-labelledby="school-title" className="mx-auto grid max-w-[1236px] items-center gap-10 px-4 pt-10 pb-16 md:px-6 md:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
					<div className="flex flex-col items-start">
						<span className="inline-block rounded-full bg-[#dbeafe] px-3.5 py-1 text-xs sm:text-sm font-semibold text-[#1d4ed8]">
							Pour les écoles et CFA
						</span>
						<h1 id="school-title" className="hero-title mt-4 text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
							Suivez l’alternance de vos étudiants en temps réel.
						</h1>
						<p className="mt-4 max-w-[590px] text-base leading-relaxed text-[#6b7280] sm:text-lg">
							Validez vos étudiants, suivez leurs candidatures et retrouvez tous leurs contrats d’alternance au même endroit.
						</p>
						<div className="mt-6 flex flex-wrap gap-3">
							<Link to="/signup?role=school" className={`rounded-xl bg-primary px-6 py-3 text-sm sm:text-base font-semibold text-on-primary shadow-xs transition-all hover:bg-primary/90 ${focus}`}>
								Inscrire mon établissement
							</Link>
							<Link to="/pricing" className={`rounded-xl border border-[#d1d5db] bg-surface px-6 py-3 text-sm sm:text-base font-semibold text-ink transition-colors hover:bg-[#f9fafb] ${focus}`}>
								Voir les tarifs
							</Link>
						</div>
						<Link to="/login" className={`mt-4 inline-block text-sm font-medium text-primary hover:underline ${focus}`}>
							Déjà inscrit ? Se connecter
						</Link>
					</div>

					{/* Interactive School Dashboard Preview */}
					<div className="animate-float flex flex-col gap-4 rounded-3xl border border-[#e5e7eb] bg-surface p-6 shadow-xl">
						<div className="flex items-center justify-between border-b border-[#e5e7eb] pb-3">
							<div>
								<p className="text-sm font-bold text-ink">Tableau de bord Promotion M2</p>
								<p className="text-xs text-[#6b7280]">Suivi des placements en alternance</p>
							</div>
							<span className="rounded-full bg-[#dcfce7] px-3 py-1 text-xs font-semibold text-[#15803d]">
								86% placés
							</span>
						</div>
						<div className="grid grid-cols-3 gap-3 text-center">
							<div className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-3">
								<p className="text-lg font-bold text-primary">142</p>
								<p className="text-xs text-[#6b7280]">Étudiants</p>
							</div>
							<div className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-3">
								<p className="text-lg font-bold text-[#15803d]">122</p>
								<p className="text-xs text-[#6b7280]">Contrats signés</p>
							</div>
							<div className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-3">
								<p className="text-lg font-bold text-ink">20</p>
								<p className="text-xs text-[#6b7280]">En recherche</p>
							</div>
						</div>
						<div className="rounded-2xl bg-[#eff6ff] px-4 py-3 text-xs text-ink">
							<span className="font-semibold text-primary">Alertes automatiques :</span> identifiez immédiatement les étudiants ayant besoin d’accompagnement.
						</div>
					</div>
				</section>
			</div>

			<main className="mx-auto flex w-full max-w-[1236px] flex-1 flex-col gap-16 px-4 py-16 md:px-6 md:py-20">
				<section aria-label="Les avantages JobUp pour les écoles" className="grid gap-6 md:grid-cols-3">
					{features.map(({ title, description, Icon }) => (
						<article key={title} className="group flex flex-col gap-3 rounded-2xl border border-[#e5e7eb] bg-surface p-6 shadow-xs motion-safe:transition-all motion-safe:duration-300 motion-safe:hover:-translate-y-1 hover:shadow-md">
							<div className="flex size-12 items-center justify-center rounded-xl bg-[#dbeafe] text-primary motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-110">
								<Icon className="size-6" />
							</div>
							<h2 className="text-lg font-semibold text-ink">{title}</h2>
							<p className="text-sm leading-relaxed text-[#6b7280]">{description}</p>
						</article>
					))}
				</section>
			</main>

			<Footer />
		</div>
	);
}
