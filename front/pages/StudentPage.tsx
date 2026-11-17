import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import PublicNavbar from "../components/PublicNavbar";
import HandshakeIcon from "../components/HandshakeIcon";
import Filter from "../components/Filter";
import Megaphone from "../components/Megaphone";
import HeartIcon from "../components/HeartIcon";

const features = [
	{
		title: "Swipe les offres",
		description: "❤️ pour sauvegarder, 🚫 pour passer : tu tries des dizaines d’offres vérifiées en quelques minutes.",
		Icon: Megaphone,
	},
	{
		title: "Postule en un clic",
		description: "Ton CV et ta présentation sont enregistrés une fois pour toutes dans ton espace candidat.",
		Icon: Filter,
	},
	{
		title: "Suis tes candidatures",
		description: "Statuts en temps réel, messagerie directe avec les recruteurs et notifications par e-mail.",
		Icon: HandshakeIcon,
	},
];

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function StudentPage() {
	return (
		<div className="flex min-h-dvh flex-col bg-[#f8fafc] font-sans text-ink">
			<div className="hero-mesh border-b border-[#e5e7eb]">
				<header className="px-4 pt-4 md:px-6 md:pt-6">
					<PublicNavbar variant="glass" signupTo="/signup?role=student" />
				</header>

				<section aria-labelledby="student-title" className="mx-auto grid max-w-[1236px] items-center gap-10 px-4 pt-10 pb-16 md:px-6 md:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
					<div className="flex flex-col items-start">
						<span className="inline-block rounded-full bg-[#dbeafe] px-3.5 py-1 text-xs sm:text-sm font-semibold text-[#1d4ed8]">
							Pour les étudiants
						</span>
						<h1 id="student-title" className="hero-title mt-4 text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
							Trouve ton alternance,<br className="hidden xl:block" /> une offre à la fois.
						</h1>
						<p className="mt-4 max-w-[590px] text-base leading-relaxed text-[#6b7280] sm:text-lg">
							Swipe les offres qui te correspondent, postule avec ton CV en un clic et suis toutes tes candidatures au même endroit.
						</p>
						<div className="mt-6 flex flex-wrap gap-3">
							<Link to="/signup?role=student" className={`rounded-xl bg-primary px-6 py-3 text-sm sm:text-base font-semibold text-on-primary shadow-xs transition-all hover:bg-primary/90 ${focus}`}>
								Créer mon compte étudiant
							</Link>
							<Link to="/offers" className={`rounded-xl border border-[#d1d5db] bg-surface px-6 py-3 text-sm sm:text-base font-semibold text-ink transition-colors hover:bg-[#f9fafb] ${focus}`}>
								Voir toutes les offres
							</Link>
						</div>
						<Link to="/login" className={`mt-4 inline-block text-sm font-medium text-primary hover:underline ${focus}`}>
							Déjà inscrit ? Se connecter
						</Link>
					</div>

					{/* Interactive Student Experience Preview Card */}
					<div className="animate-float flex flex-col gap-4 rounded-3xl border border-[#e5e7eb] bg-surface p-6 shadow-xl">
						<div className="flex items-center justify-between">
							<span className="rounded-full bg-[#dbeafe] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">Aperçu Mode Swipe</span>
							<span className="flex items-center gap-1 text-xs font-semibold text-primary">
								<HeartIcon width={14} height={14} fill="currentColor" /> 4 offres sauvegardées
							</span>
						</div>
						<div className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
							<p className="text-base font-bold text-ink">Product Designer UI/UX en alternance</p>
							<p className="mt-0.5 text-xs text-[#6b7280]">Atelier Studio • Lyon • 12 mois</p>
							<p className="mt-2.5 text-xs leading-relaxed text-[#4b5563]">
								Conception de parcours utilisateurs modernes, ateliers design system et prototypage interactif au sein de l’équipe produit.
							</p>
						</div>
						<div className="grid grid-cols-2 gap-3 text-xs">
							<div className="rounded-xl border border-[#e5e7eb] bg-surface p-3">
								<p className="font-semibold text-ink">CV pré-enregistré</p>
								<p className="mt-0.5 text-[#15803d]">✓ Prêt pour envoi 1-clic</p>
							</div>
							<div className="rounded-xl border border-[#e5e7eb] bg-surface p-3">
								<p className="font-semibold text-ink">Suivi temps réel</p>
								<p className="mt-0.5 text-primary">Notifications actives</p>
							</div>
						</div>
					</div>
				</section>
			</div>

			<main className="mx-auto flex w-full max-w-[1236px] flex-1 flex-col gap-16 px-4 py-16 md:px-6 md:py-20">
				<section aria-label="Les avantages JobUp pour les étudiants" className="grid gap-6 md:grid-cols-3">
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
