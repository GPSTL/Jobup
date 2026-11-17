import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import Footer from "../components/Footer";
import PublicNavbar from "../components/PublicNavbar";
import StudentNavbar from "../components/StudentNavbar";
import RecruiterNavbar from "../components/RecruiterNavbar";
import HandshakeIcon from "../components/HandshakeIcon";
import Filter from "../components/Filter";
import Megaphone from "../components/Megaphone";
import GraduationCapIcon from "../components/GraduationCapIcon";
import UsersIcon from "../components/UsersIcon";
import SearchIcon from "../components/SearchIcon";
import { getSession, type SessionResult } from "../services/auth";
import { ROLES } from "../utils/roles";

const homeRoles = [...ROLES].sort((a, b) => a.homeOrder - b.homeOrder);

const popularSectors = [
	"Informatique & Tech",
	"Data & IA",
	"Design & Produit",
	"Marketing & Communication",
	"Finance & Audit",
	"Ingénierie",
];

const roleCards = [
	{
		badge: "Étudiants",
		title: "Trouvez l’alternance qui vous correspond",
		description: "Fini les dizaines d’onglets ouverts : swipez les offres vérifiées, sauvegardez vos coups de cœur et postulez en un clic.",
		points: [
			"Mode découverte par swipe ou recherche filtrée",
			"CV et présentation enregistrés une seule fois",
			"Suivi d’avancement de chaque candidature en direct",
		],
		cta: "Découvrir l’espace étudiant",
		to: "/students",
		Icon: GraduationCapIcon,
	},
	{
		badge: "Entreprises & Recruteurs",
		title: "Recrutez vos futurs talents simplement",
		description: "Diffusez vos offres d’alternance, parcourez des profils qualifiés et échangez sans intermédiaire avec les candidats.",
		points: [
			"Publication d’offres et page vitrine entreprise",
			"Tri rapide des candidats par compétences et région",
			"Messagerie directe avec indicateur de présence",
		],
		cta: "Créer un compte recruteur",
		to: "/signup?role=recruiter",
		Icon: UsersIcon,
	},
	{
		badge: "Écoles & CFA",
		title: "Pilotez le placement de vos promotions",
		description: "Accompagnez vos étudiants dans leur recherche et centralisez le suivi des contrats avec vos entreprises partenaires.",
		points: [
			"Visibilité temps réel sur les candidatures étudiantes",
			"Centralisation des contrats et conventions",
			"Canal privilégié avec les recruteurs partenaires",
		],
		cta: "Découvrir l’espace école",
		to: "/schools",
		Icon: HandshakeIcon,
	},
];

const steps = [
	{
		step: "01",
		title: "Créez votre profil",
		description: "Importez votre CV ou configurez votre fiche entreprise en moins de deux minutes.",
		Icon: Filter,
	},
	{
		step: "02",
		title: "Matchez & postulez",
		description: "Explorez les opportunités par secteur et par ville, ou utilisez le swipe pour trier rapidement.",
		Icon: Megaphone,
	},
	{
		step: "03",
		title: "Échangez & signez",
		description: "Suivez chaque étape du recrutement et discutez directement depuis la messagerie intégrée.",
		Icon: HandshakeIcon,
	},
];

export default function HomePage() {
	const [session, setSession] = useState<SessionResult | null>(null);
	useEffect(() => {
		let ignore = false;
		getSession().then((result) => { if (!ignore) setSession(result); });
		return () => { ignore = true; };
	}, []);

	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
		const sections = document.querySelectorAll<HTMLElement>(".landing-page main > section");
		const observer = new IntersectionObserver(entries => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					entry.target.classList.add("is-revealed");
					observer.unobserve(entry.target);
				}
			});
		}, { threshold: 0.08 });
		sections.forEach(section => { section.classList.add("reveal-on-scroll"); observer.observe(section); });
		return () => { observer.disconnect(); sections.forEach(section => section.classList.remove("reveal-on-scroll", "is-revealed")); };
	}, []);

	return (
		<div className="landing-page flex min-h-dvh flex-col bg-[#f8fafc] text-ink">
			<div className="hero-mesh border-b border-[#e5e7eb]">
				{session !== null && (
					<header className="px-4 pt-4 md:px-6 md:pt-6">
						{session.ok && session.user.role === 1 ? (
							<StudentNavbar variant="glass" />
						) : session.ok && session.user.role === 3 ? (
							<RecruiterNavbar variant="glass" />
						) : session.ok ? null : (
							<PublicNavbar variant="glass" />
						)}
					</header>
				)}

				{/* Hero section */}
				<section aria-labelledby="home-hero-title" className="mx-auto grid max-w-[1236px] items-center gap-12 px-4 pt-10 pb-16 md:px-6 md:pt-14 md:pb-24 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16">
					<div className="flex flex-col items-start gap-6">
						<span className="inline-flex items-center gap-2 rounded-full border border-[#d1d5db] bg-surface px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-primary shadow-2xs">
							<span className="size-2 rounded-full bg-primary" aria-hidden="true" />
							La plateforme d’alternance nouvelle génération
						</span>

						<h1 id="home-hero-title" className="hero-title text-4xl leading-[1.08] font-extrabold tracking-tight text-ink sm:text-5xl lg:text-6xl">
							Ton succès commence <span className="text-primary">ici</span>.
						</h1>

						<p className="max-w-xl text-base leading-relaxed text-[#6b7280] sm:text-lg">
							Inspirée des meilleures plateformes tech, JobUp connecte étudiants, recruteurs et écoles autour d’une expérience rapide : découverte par swipe, candidature en 1 clic et suivi temps réel.
						</p>

						{/* Quick search bar preview */}
						<div className=" flex w-full max-w-xl flex-col gap-2 rounded-2xl border border-[#e5e7eb] bg-surface p-2 shadow-md sm:flex-row sm:items-center">
							<div className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2">
								<SearchIcon width={18} height={18} className="shrink-0 text-primary" />
								<span className="truncate text-sm text-[#6b7280]">Développeur, Designer, Data, Finance…</span>
							</div>
							<div className="flex items-center gap-2">
								<Link
									to="/offers"
									className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-xs transition-all hover:bg-primary/90 sm:w-auto"
								>
									Explorer les offres
								</Link>
							</div>
						</div>

						{/* Role direct access buttons */}
						<div className="flex w-full flex-col gap-2.5 pt-1">
							<p className="text-xs font-bold tracking-wider text-[#6b7280] uppercase">Choisissez votre espace</p>
							<div className="flex flex-wrap gap-3">
								{homeRoles.map(({ homeLabel, value, homePath }, index) => (
									<Button
										key={value}
										to={homePath}
										variant={index === 0 ? "primary" : "outline"}
										size="md"
										className="min-w-[130px] flex-1 sm:flex-initial"
									>
										{homeLabel}
									</Button>
								))}
							</div>
						</div>

						{/* Popular sector tags */}
						<div className="flex flex-wrap items-center gap-2 pt-1">
							<span className="text-xs font-medium text-[#6b7280]">Secteurs phares :</span>
							{popularSectors.map((sector) => (
								<Link
									key={sector}
									to="/offers"
									className="rounded-lg border border-[#e5e7eb] bg-surface px-2.5 py-1 text-xs font-medium text-[#6b7280] transition-colors hover:border-primary hover:text-primary"
								>
									{sector}
								</Link>
							))}
						</div>
					</div>

					<div className="home-job-preview mx-auto flex w-full max-w-md flex-col gap-5 rounded-[30px] border border-[#334155] bg-[#121a28] p-5 text-white shadow-xl sm:p-6 lg:max-w-none">
						<div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-4">
							<div className="flex items-center gap-3">
								<span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#4f7fee] text-lg font-bold">HT</span>
								<div><p className="font-bold">Horizon Tech</p><p className="text-sm text-slate-400">Paris • Hybride</p></div>
							</div>
							<span className="rounded-full bg-emerald-900 px-3 py-1 text-xs font-semibold text-emerald-200">Compatibilité 98%</span>
						</div>
						<div className="flex flex-col gap-3">
							<span className="w-fit rounded-md bg-blue-900 px-2.5 py-1 text-xs font-semibold text-blue-200">Alternance • 12 à 24 mois</span>
							<p className="text-lg font-bold leading-tight">Développeur Full-Stack TypeScript &amp; Python</p>
							<p className="text-sm leading-relaxed text-slate-400">Rejoignez notre équipe produit pour concevoir des interfaces réactives et des API performantes. Rythme 3 jours / 2 jours.</p>
						</div>
						<div className="flex flex-wrap gap-1.5">{["React", "TypeScript", "Django", "REST API", "Git"].map(skill => <span key={skill} className="rounded-lg bg-[#202b3d] px-2.5 py-1 text-xs text-slate-300">{skill}</span>)}</div>
						<div className="grid gap-3 border-t border-slate-700 pt-4 sm:grid-cols-2">
							<div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#202b3d] p-3"><span className="text-xl text-blue-400" aria-hidden="true">♥</span><div className="text-xs"><p className="font-semibold">Swipe &amp; Favoris</p><p className="text-slate-400">Tri ultra-rapide</p></div></div>
							<div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#202b3d] p-3"><HandshakeIcon className="size-5 shrink-0 text-emerald-300" /><div className="text-xs"><p className="font-semibold">Postulation 1-clic</p><p className="text-slate-400">CV joint d’office</p></div></div>
						</div>
						<div className="flex items-center gap-3 rounded-2xl bg-[#1c2b5a] p-4 text-sm"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#4f7fee]" aria-hidden="true">✓</span><span className="font-semibold">Candidature étudiée par le recruteur</span><span className="ml-auto shrink-0 text-xs text-blue-300">En direct</span></div>
					</div>
				</section>
			</div>

			<main className="mx-auto flex w-full max-w-[1236px] flex-1 flex-col gap-20 px-4 py-16 md:gap-24 md:px-6 md:py-20">
				{/* Bento Grid Feature Showcase */}
				<section aria-labelledby="bento-section-title" className="flex flex-col gap-10">
					<div className="flex flex-col gap-2 text-center">
						<span className="mx-auto w-fit rounded-full bg-[#dbeafe] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
							Fonctionnalités clés
						</span>
						<h2 id="bento-section-title" className="section-display text-2xl font-bold tracking-tight sm:text-3xl">
							Tout ce qu’il faut pour réussir son recrutement en alternance
						</h2>
						<p className="mx-auto max-w-2xl text-sm text-[#6b7280] sm:text-base">
							Une interface claire, rapide et cohérente sur ordinateur comme sur mobile, en mode clair ou sombre.
						</p>
					</div>

					<div className="grid gap-6 md:grid-cols-12">
						{/* Bento 1: Swipe matching (7 cols) */}
						<article className="flex flex-col justify-between gap-6 rounded-3xl border border-[#e5e7eb] bg-surface p-6 shadow-xs md:col-span-7 sm:p-8">
							<div className="flex flex-col gap-2">
								<span className="w-fit rounded-lg bg-[#dbeafe] px-2.5 py-1 text-xs font-semibold text-[#1d4ed8]">
									Découverte intelligente
								</span>
								<h3 className="text-xl font-bold text-ink">Mode Swipe &amp; Moteur de recherche multicritères</h3>
								<p className="text-sm leading-relaxed text-[#6b7280]">
									Les étudiants filtrent par secteur, poste et ville ou passent en mode cartes pour sauvegarder les meilleures offres en quelques secondes. Les recruteurs parcourent les profils candidats avec la même fluidité.
								</p>
							</div>
							<div className="grid gap-3 sm:grid-cols-3">
								<div className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
									<p className="text-xs font-semibold text-[#6b7280]">Filtres instantanés</p>
									<p className="mt-1 text-sm font-bold text-ink">Secteur, Ville, Compétences</p>
								</div>
								<div className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
									<p className="text-xs font-semibold text-[#6b7280]">Sélection rapide</p>
									<p className="mt-1 text-sm font-bold text-primary">♥ Retenir / 🚫 Passer</p>
								</div>
								<div className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
									<p className="text-xs font-semibold text-[#6b7280]">Sauvegarde</p>
									<p className="mt-1 text-sm font-bold text-ink">Favoris synchronisés</p>
								</div>
							</div>
						</article>

						{/* Bento 2: 1-Click Application & Tracking (5 cols) */}
						<article className="flex flex-col justify-between gap-6 rounded-3xl border border-[#e5e7eb] bg-surface p-6 shadow-xs md:col-span-5 sm:p-8">
							<div className="flex flex-col gap-2">
								<span className="w-fit rounded-lg bg-[#dcfce7] px-2.5 py-1 text-xs font-semibold text-[#15803d]">
									Zéro friction
								</span>
								<h3 className="text-xl font-bold text-ink">Suivi transparent étape par étape</h3>
								<p className="text-sm leading-relaxed text-[#6b7280]">
									Chaque candidature affiche sa frise d’avancement : envoyée, consultée, en cours d’étude, acceptée ou refusée avec message du recruteur.
								</p>
							</div>
							<div className="flex flex-col gap-2.5 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
								<div className="flex items-center justify-between text-xs">
									<span className="font-semibold text-ink">1. Candidature envoyée</span>
									<span className="rounded-full bg-[#dcfce7] px-2 py-0.5 font-semibold text-[#15803d]">Franchie</span>
								</div>
								<div className="flex items-center justify-between text-xs">
									<span className="font-semibold text-ink">2. En cours d’étude</span>
									<span className="rounded-full bg-[#dbeafe] px-2 py-0.5 font-semibold text-[#1d4ed8]">Active</span>
								</div>
								<div className="flex items-center justify-between text-xs">
									<span className="font-semibold text-ink">3. Décision &amp; Messagerie</span>
									<span className="text-[#6b7280]">Notification directe</span>
								</div>
							</div>
						</article>
					</div>
				</section>

				{/* Role breakdown section */}
				<section aria-labelledby="roles-section-title" className="flex flex-col gap-10">
					<div className="flex flex-col gap-2 text-center">
						<h2 id="roles-section-title" className="section-display text-2xl font-bold tracking-tight sm:text-3xl">
							Un parcours pensé pour chaque acteur
						</h2>
						<p className="mx-auto max-w-2xl text-sm text-[#6b7280] sm:text-base">
							Que vous cherchiez un contrat, un futur talent ou à accompagner vos promotions, JobUp adapte son interface à vos besoins.
						</p>
					</div>

					<div className="grid gap-6 lg:grid-cols-3">
						{roleCards.map(({ badge, title, description, points, cta, to, Icon }) => (
							<article key={badge} className="group flex flex-col gap-4 rounded-3xl border border-[#e5e7eb] bg-surface p-6 shadow-xs motion-safe:transition-all motion-safe:duration-300 motion-safe:hover:-translate-y-1 hover:shadow-md sm:p-7">
								<div className="flex items-center justify-between">
									<span className="rounded-full bg-[#dbeafe] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">{badge}</span>
									<span className="flex size-11 items-center justify-center rounded-2xl bg-[#f3f4f6] text-primary motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-110">
										<Icon className="size-5" />
									</span>
								</div>
								<h3 className="text-lg font-bold text-ink">{title}</h3>
								<p className="text-sm leading-relaxed text-[#6b7280]">{description}</p>
								<ul className="flex flex-col gap-2 border-t border-[#e5e7eb] pt-4 text-xs sm:text-sm text-[#4b5563]">
									{points.map((point) => (
										<li key={point} className="flex items-start gap-2">
											<span className="mt-0.5 text-primary" aria-hidden="true">✓</span>
											<span>{point}</span>
										</li>
									))}
								</ul>
								<Link to={to} className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-semibold text-primary hover:underline">
									{cta} <span aria-hidden="true" className="motion-safe:transition-transform motion-safe:duration-200 group-hover:translate-x-1">→</span>
								</Link>
							</article>
						))}
					</div>
				</section>

				{/* How it works section */}
				<section aria-labelledby="steps-section-title" className="rounded-3xl border border-[#e5e7eb] bg-surface p-6 shadow-xs sm:p-10">
					<div className="flex flex-col gap-2 text-center">
						<h2 id="steps-section-title" className="section-display text-2xl font-bold tracking-tight sm:text-3xl">
							Comment fonctionne JobUp ?
						</h2>
						<p className="mx-auto max-w-xl text-sm text-[#6b7280] sm:text-base">
							Trois étapes simples, de la création du profil jusqu’à la signature du contrat.
						</p>
					</div>

					<div className="mt-8 grid gap-6 md:grid-cols-3">
						{steps.map(({ step, title, description, Icon }) => (
							<div key={step} className="flex flex-col gap-3 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-5">
								<div className="flex items-center justify-between">
									<span className="flex size-10 items-center justify-center rounded-xl bg-[#dbeafe] text-primary">
										<Icon className="size-5" />
									</span>
									<span className="rounded-full border border-[#d1d5db] bg-surface px-2.5 py-0.5 text-xs font-bold tracking-wider text-[#6b7280] uppercase">
										Étape {step}
									</span>
								</div>
								<h3 className="text-base font-bold text-ink">{title}</h3>
								<p className="text-sm leading-relaxed text-[#6b7280]">{description}</p>
							</div>
						))}
					</div>
				</section>

				{/* Bottom CTA Banner */}
				<section aria-label="Rejoindre JobUp" className="auth-mesh flex flex-col items-center justify-between gap-6 rounded-3xl px-6 py-10 text-center text-white shadow-lg sm:px-12 sm:py-12 lg:flex-row lg:text-left">
					<div className="flex max-w-xl flex-col gap-2">
						<h2 className="section-display text-2xl font-bold text-white sm:text-3xl">
							Prêt à lancer votre prochaine alternance ?
						</h2>
						<p className="text-sm text-white/80 sm:text-base">
							Créez votre compte gratuitement ou explorez dès maintenant les offres et entreprises partenaires.
						</p>
					</div>
					<div className="flex flex-wrap justify-center gap-3">
						<Link to="/signup" className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#0f172a] shadow-xs transition-transform hover:-translate-y-0.5">
							Créer un compte gratuit
						</Link>
						<Link to="/companies" className="rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-xs transition-colors hover:bg-white/20">
							Voir les entreprises
						</Link>
					</div>
				</section>
			</main>

			<Footer />
		</div>
	);
}
