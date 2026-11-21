import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import PublicNavbar from "../components/PublicNavbar";
import StudentNavbar from "../components/StudentNavbar";
import RecruiterNavbar from "../components/RecruiterNavbar";
import SchoolNavbar from "../components/SchoolNavbar";
import AdminNavbar from "../components/AdminNavbar";
import HandshakeIcon from "../components/HandshakeIcon";
import Filter from "../components/Filter";
import Megaphone from "../components/Megaphone";
import GraduationCapIcon from "../components/GraduationCapIcon";
import UsersIcon from "../components/UsersIcon";
import SearchIcon from "../components/SearchIcon";
import MessageIcon from "../components/MessageIcon";
import FileIcon from "../components/FileIcon";
import { getSession, type SessionResult } from "../services/auth";
import { accountHome } from "../utils/accountHome";
import { ROLES } from "../utils/roles";
import { attractToPointer, resetPointer, tiltCard, trackPointer, useLandingMotion } from "../utils/landingMotion";

const homeRoles = [...ROLES].sort((a, b) => a.homeOrder - b.homeOrder);

const sectors = [
	"Informatique & Tech",
	"Data & IA",
	"Design & Produit",
	"Marketing & Communication",
	"Finance & Audit",
	"Ingénierie",
	"Commerce & Vente",
	"Ressources humaines",
	"Logistique",
	"Cybersécurité",
];

const manifesto = "JobUp réunit étudiants, entreprises et écoles sur une seule plateforme, pour que chaque alternance commence par la bonne rencontre.";
const highlightedWords = new Set(["étudiants,", "entreprises", "écoles", "bonne", "rencontre."]);

const roleCards = [
	{
		role: 1,
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
		accent: "#2563eb",
	},
	{
		role: 3,
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
		accent: "#3b82f6",
	},
	{
		role: 2,
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
		accent: "#4f46e5",
	},
];

const steps = [
	{
		step: "01",
		title: "Créez votre profil",
		description: "Importez votre CV ou configurez votre fiche entreprise en moins de deux minutes.",
		Icon: Filter,
		visual: ["Profil", "CV importé", "Compétences ajoutées"],
	},
	{
		step: "02",
		title: "Matchez & postulez",
		description: "Explorez les opportunités par secteur et par ville, ou utilisez le swipe pour trier rapidement.",
		Icon: Megaphone,
		visual: ["Découverte", "Offre retenue", "Candidature envoyée"],
	},
	{
		step: "03",
		title: "Échangez & signez",
		description: "Suivez chaque étape du recrutement et discutez directement depuis la messagerie intégrée.",
		Icon: HandshakeIcon,
		visual: ["Messagerie", "Entretien planifié", "Contrat signé"],
	},
];

const stats = [
	{ value: 3, label: "espaces dédiés" },
	{ value: 1, label: "clic pour postuler" },
	{ value: 3, label: "étapes jusqu’au contrat" },
	{ value: 0, label: "intermédiaire" },
];

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export default function HomePage() {
	const [session, setSession] = useState<SessionResult | null>(null);
	const [activeStep, setActiveStep] = useState(0);
	const rootRef = useRef<HTMLDivElement>(null);
	const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
	useLandingMotion(rootRef);

	useEffect(() => {
		let ignore = false;
		getSession().then((result) => { if (!ignore) setSession(result); });
		return () => { ignore = true; };
	}, []);

	// The sticky illustration follows the step closest to the middle of the screen.
	useEffect(() => {
		if (!("IntersectionObserver" in window)) return;
		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) setActiveStep(Number((entry.target as HTMLElement).dataset.step));
			}
		}, { rootMargin: "-45% 0px -45% 0px" });
		stepRefs.current.forEach((element) => element && observer.observe(element));
		return () => observer.disconnect();
	}, []);

	const manifestoWords = manifesto.split(" ");
	const loggedInHome = session?.ok ? accountHome(session.user.role) : null;

	return (
		<div ref={rootRef} className="landing-page flex min-h-dvh flex-col">
			{session !== null && (
				<header className="landing-header px-4 pt-4 md:px-6">
					{session.ok && session.user.role === 1 ? (
						<StudentNavbar variant="glass" />
					) : session.ok && session.user.role === 2 ? (
						<SchoolNavbar variant="glass" />
					) : session.ok && session.user.role === 3 ? (
						<RecruiterNavbar variant="glass" />
					) : session.ok && session.user.role === 127 ? (
						<AdminNavbar />
					) : (
						<PublicNavbar variant="glass" />
					)}
				</header>
			)}

			{/* Hero section */}
			<section
				aria-labelledby="home-hero-title"
				className="landing-hero relative isolate px-4 pt-36 pb-10 md:px-6 md:pt-44"
				onPointerMove={(event) => {
					const box = event.currentTarget.getBoundingClientRect();
					event.currentTarget.style.setProperty("--hx", `${event.clientX - box.left}px`);
					event.currentTarget.style.setProperty("--hy", `${event.clientY - box.top}px`);
				}}
			>
				<div className="landing-aurora" aria-hidden="true"><span /><span /><span /></div>
				<div className="landing-spotlight" aria-hidden="true" />

				<div className="mx-auto flex max-w-[1100px] flex-col items-center text-center">
					<Link to="/offers" className="landing-rise landing-pill group" style={delay(0)}>
						<span className="landing-pill-tag">Nouveau</span>
						La plateforme d’alternance nouvelle génération
						<span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
					</Link>

					<h1 id="home-hero-title" className="hero-title landing-display mt-8 text-[clamp(3rem,9vw,7.5rem)]">
						<span className="landing-rise block" style={delay(120)}>Ton succès commence</span>
						<span className="landing-rise block" style={delay(260)}><span className="landing-shimmer">ici</span>.</span>
					</h1>

					<p className="landing-rise landing-muted mt-7 max-w-xl text-base leading-relaxed sm:text-xl" style={delay(420)}>
						Découvrez des opportunités, rencontrez les bons profils et suivez votre parcours en alternance, à chaque étape.
					</p>

					<div className="landing-rise mt-10 flex flex-wrap items-center justify-center gap-3" style={delay(560)}>
						<Link to="/offers" className="landing-magnet landing-btn-primary" onPointerMove={attractToPointer} onPointerLeave={resetPointer}>
							<SearchIcon width={17} height={17} className="shrink-0" />
							Explorer les offres
						</Link>
						<Link to={loggedInHome ?? "/signup"} className="landing-magnet landing-btn-ghost" onPointerMove={attractToPointer} onPointerLeave={resetPointer}>
							{loggedInHome ? "Accéder à mon espace" : "Créer un compte gratuit"}
						</Link>
					</div>

					{!loggedInHome && (
						<div className="landing-rise mt-8 flex flex-wrap items-center justify-center gap-2 text-sm" style={delay(680)}>
							<span className="landing-subtle mr-1">Choisissez votre espace :</span>
							{homeRoles.map(({ homeLabel, value, homePath }) => (
								<Link key={value} to={homePath} className="landing-chip">{homeLabel}</Link>
							))}
						</div>
					)}
				</div>

				{/* Product preview, flattened while scrolling */}
				<div className="landing-rise mx-auto mt-16 max-w-[1180px] md:mt-20" style={delay(820)}>
					<div data-progress="hero" className="landing-stage">
						<div className="landing-canvas">
							<div className="landing-canvas-bar flex items-center gap-2 px-4 py-3">
								<span className="size-3 rounded-full bg-[#ff5f57]" /><span className="size-3 rounded-full bg-[#febc2e]" /><span className="size-3 rounded-full bg-[#28c840]" />
								<span className="landing-canvas-url mx-auto hidden rounded-lg px-24 py-1 text-xs sm:block">jobup.fr/offers</span>
							</div>
							<div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[1.35fr_1fr]">
								<div className="relative h-[300px] overflow-hidden rounded-2xl sm:h-[420px] lg:h-[480px]">
									<img src="/static/img/auth-community.webp" alt="Des étudiants et un professionnel échangent autour d’un ordinateur" className="landing-zoom h-full w-full object-cover object-top" fetchPriority="high" />
									<div className="absolute inset-0 bg-gradient-to-t from-[#05060a] via-[#05060a]/25 to-transparent" />
									<div className="absolute inset-x-0 bottom-0 p-6 text-left text-white sm:p-8">
										<p className="text-xs font-semibold tracking-[0.16em] text-blue-200 uppercase">Des rencontres qui comptent</p>
										<p className="mt-3 max-w-sm text-2xl leading-tight font-bold sm:text-3xl">L’alternance commence par une rencontre.</p>
										<p className="mt-3 max-w-sm text-sm leading-relaxed text-white/75">Étudiants, entreprises et écoles avancent ensemble sur JobUp.</p>
									</div>
								</div>
								<div className="hidden flex-col gap-4 text-left lg:flex">
									<div className="landing-panel flex-1">
										<p className="landing-subtle text-xs font-semibold tracking-wider uppercase">Découverte</p>
										<div className="landing-swipe mt-4" aria-hidden="true">
											{["Design & Produit", "Data & IA", "Informatique & Tech"].map((sector, index) => (
												<div key={sector} className="landing-swipe-card" style={{ "--i": index, "--dir": index % 2 ? -1 : 1 } as CSSProperties}>
													<span className="landing-subtle text-xs">Offre d’alternance</span>
													<span className="text-lg font-bold">{sector}</span>
													<span className="mt-auto flex gap-2">
														<span className="landing-swipe-btn">✕</span>
														<span className="landing-swipe-btn landing-swipe-like">♥</span>
													</span>
												</div>
											))}
										</div>
									</div>
									<div className="landing-panel">
										<p className="landing-subtle text-xs font-semibold tracking-wider uppercase">Suivi de candidature</p>
										<div className="landing-bar mt-4"><span /></div>
										<div className="landing-subtle mt-3 flex justify-between text-xs"><span>Envoyée</span><span>Consultée</span><span>Décision</span></div>
									</div>
								</div>
							</div>
						</div>
						<div className="landing-float landing-float-a hidden sm:flex" aria-hidden="true">
							<span className="landing-float-icon">✦</span>
							<div><p className="text-sm font-bold">De nouvelles opportunités</p><p className="landing-subtle text-xs">À découvrir à votre rythme</p></div>
						</div>
						<div className="landing-float landing-float-b hidden md:flex" aria-hidden="true">
							<span className="landing-float-icon landing-float-icon-green">✓</span>
							<div><p className="text-sm font-bold">Candidature consultée</p><p className="landing-subtle text-xs">Notification en direct</p></div>
						</div>
					</div>
				</div>
			</section>

			<main className="flex flex-1 flex-col">
				{/* Sector ticker */}
				<section aria-label="Secteurs phares" className="py-14">
					<p className="landing-subtle mb-6 text-center text-sm">Des opportunités dans tous les secteurs phares</p>
					<div className="landing-marquee">
						{[0, 1].map((copy) => (
							<ul key={copy} className="landing-marquee-track" aria-hidden={copy === 1 || undefined}>
								{sectors.map((sector) => (
									<li key={sector}>
										<Link to="/offers" tabIndex={copy === 1 ? -1 : undefined} className="landing-marquee-item">{sector}</Link>
									</li>
								))}
							</ul>
						))}
					</div>
				</section>

				{/* Scroll-driven manifesto */}
				<section aria-label="Notre mission" className="mx-auto w-full max-w-[1000px] px-4 py-24 md:px-6 md:py-36">
					<p data-progress="scroll" className="landing-words section-display text-[clamp(1.75rem,4.4vw,3.5rem)] leading-[1.12] font-bold tracking-[-0.035em]" style={{ "--n": manifestoWords.length } as CSSProperties}>
						{manifestoWords.map((word, index) => (
							<span key={`${word}-${index}`} style={{ "--i": index } as CSSProperties} className={highlightedWords.has(word) ? "landing-word-accent" : undefined}>{word} </span>
						))}
					</p>
				</section>

				{/* Bento Grid Feature Showcase */}
				<section aria-labelledby="bento-section-title" className="mx-auto flex w-full max-w-[1236px] flex-col gap-14 px-4 py-16 md:px-6">
					<div data-reveal className="flex flex-col items-center gap-4 text-center">
						<span className="landing-eyebrow">Fonctionnalités clés</span>
						<h2 id="bento-section-title" className="section-display landing-display max-w-3xl text-[clamp(2.25rem,5vw,4rem)]">
							Tout pour réussir son recrutement en alternance
						</h2>
						<p className="landing-muted max-w-2xl text-base sm:text-lg">
							Une interface claire, rapide et cohérente sur ordinateur comme sur mobile.
						</p>
					</div>

					<div className="grid gap-5 md:grid-cols-12">
						<div data-reveal className="md:col-span-7">
							<article className="landing-card flex h-full flex-col" onPointerMove={trackPointer}>
								<span className="landing-eyebrow">Découverte intelligente</span>
								<h3 className="mt-4 text-2xl font-bold">Mode Swipe &amp; recherche multicritères</h3>
								<p className="landing-muted mt-3 max-w-lg text-sm leading-relaxed">
									Les étudiants filtrent par secteur, poste et ville ou passent en mode cartes pour sauvegarder les meilleures offres en quelques secondes. Les recruteurs parcourent les profils candidats avec la même fluidité.
								</p>
								<div className="landing-search mt-8" aria-hidden="true">
									<SearchIcon width={18} height={18} className="shrink-0 text-primary" />
									<span className="landing-subtle">Rechercher</span>
									<span className="landing-rotator">
										<span>
											{["Développeur", "Designer", "Data analyst", "Chargé de com", "Développeur"].map((word, index) => <b key={`${word}-${index}`}>{word}</b>)}
										</span>
									</span>
									<span className="landing-search-cta ml-auto hidden rounded-full px-4 py-1.5 text-xs font-semibold sm:inline">Explorer</span>
								</div>
								<div className="mt-4 flex flex-wrap gap-2" aria-hidden="true">
									{["Paris", "Lyon", "Hybride", "Data & IA", "Design & Produit"].map((filter, index) => (
										<span key={filter} className="landing-filter" style={delay(index * 90)}>{filter}</span>
									))}
								</div>
								<div className="mt-auto grid gap-3 pt-6 sm:grid-cols-3">
									{[["Filtres instantanés", "Secteur, Ville, Compétences"], ["Sélection rapide", "♥ Retenir / ✕ Passer"], ["Sauvegarde", "Favoris synchronisés"]].map(([label, value]) => (
										<div key={label} className="landing-mini-panel rounded-2xl p-4">
											<p className="landing-subtle text-xs font-semibold">{label}</p>
											<p className="mt-1 text-sm font-bold">{value}</p>
										</div>
									))}
								</div>
							</article>
						</div>

						<div data-reveal className="md:col-span-5" style={delay(120)}>
							<article className="landing-card h-full" onPointerMove={trackPointer}>
								<span className="landing-eyebrow landing-eyebrow-green">Zéro friction</span>
								<h3 className="mt-4 text-2xl font-bold">Suivi transparent étape par étape</h3>
								<p className="landing-muted mt-3 text-sm leading-relaxed">
									Chaque candidature affiche sa frise d’avancement : envoyée, consultée, en cours d’étude, acceptée ou refusée avec message du recruteur.
								</p>
								<img src="/static/img/companies.webp" alt="" loading="lazy" className="mt-6 h-36 w-full rounded-2xl object-cover opacity-90" />
								<ol className="landing-timeline mt-5">
									<li><span>1. Candidature envoyée</span><span className="landing-status-green">Franchie</span></li>
									<li><span>2. En cours d’étude</span><span className="landing-status-blue">Active</span></li>
									<li><span>3. Décision &amp; Messagerie</span><span className="landing-subtle">Notification directe</span></li>
								</ol>
							</article>
						</div>

						<div data-reveal className="md:col-span-5" style={delay(60)}>
							<article className="landing-card h-full" onPointerMove={trackPointer}>
								<MessageIcon className="size-6 text-primary" />
								<h3 className="mt-4 text-xl font-bold">Messagerie directe</h3>
								<p className="landing-muted mt-2 text-sm leading-relaxed">Échangez sans intermédiaire entre candidats, recruteurs et écoles, avec indicateur de présence.</p>
								<div className="mt-6 flex flex-col gap-2 text-sm" aria-hidden="true">
									<span className="landing-bubble">Bonjour, votre profil nous intéresse !</span>
									<span className="landing-bubble landing-bubble-me">Avec plaisir, quand êtes-vous disponible ?</span>
									<span className="landing-bubble landing-typing"><i /><i /><i /></span>
								</div>
							</article>
						</div>

						<div data-reveal className="md:col-span-7" style={delay(180)}>
							<article className="landing-card h-full" onPointerMove={trackPointer}>
								<FileIcon className="size-6 text-primary" />
								<h3 className="mt-4 text-xl font-bold">Contrats centralisés pour les écoles</h3>
								<p className="landing-muted mt-2 max-w-lg text-sm leading-relaxed">Écoles et CFA suivent les candidatures de leurs promotions et retrouvent contrats et conventions au même endroit.</p>
								<div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
									{stats.map(({ value, label }) => (
										<div key={label} className="landing-mini-panel rounded-2xl p-4">
											<p className="landing-display text-3xl"><span data-count={value}>{value}</span></p>
											<p className="landing-subtle mt-1 text-xs">{label}</p>
										</div>
									))}
								</div>
							</article>
						</div>
					</div>
				</section>

				{/* Role breakdown section */}
				<section aria-labelledby="roles-section-title" className="mx-auto flex w-full max-w-[1236px] flex-col gap-14 px-4 py-24 md:px-6">
					<div data-reveal className="flex flex-col items-center gap-4 text-center">
						<span className="landing-eyebrow">Pour chacun</span>
						<h2 id="roles-section-title" className="section-display landing-display max-w-3xl text-[clamp(2.25rem,5vw,4rem)]">
							Un parcours pensé pour chaque acteur
						</h2>
						<p className="landing-muted max-w-2xl text-base sm:text-lg">
							Que vous cherchiez un contrat, un futur talent ou à accompagner vos promotions, JobUp adapte son interface à vos besoins.
						</p>
					</div>

					<div className="grid gap-5 lg:grid-cols-3">
						{roleCards.map(({ role, badge, title, description, points, cta, to, Icon, accent }, index) => {
							const isCurrentRole = session?.ok && session.user.role === role;
							return (
								<div key={badge} data-reveal style={delay(index * 120)}>
									<article
										className="landing-card landing-tilt group flex h-full flex-col gap-4"
										style={{ "--accent": accent } as CSSProperties}
										onPointerMove={tiltCard}
										onPointerLeave={resetPointer}
									>
										<div className="flex items-center justify-between">
											<span className="landing-role-badge">{badge}</span>
											<span className="landing-role-icon"><Icon className="size-5" /></span>
										</div>
										<h3 className="text-xl font-bold">{title}</h3>
										<p className="landing-muted text-sm leading-relaxed">{description}</p>
										<ul className="landing-role-points flex flex-col gap-2 pt-4 text-sm">
											{points.map((point) => (
												<li key={point} className="flex items-start gap-2">
													<span className="mt-0.5 text-[var(--accent)]" aria-hidden="true">✓</span>
													<span>{point}</span>
												</li>
											))}
										</ul>
										<Link to={isCurrentRole && loggedInHome ? loggedInHome : to} className="landing-role-link mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-semibold">
											{isCurrentRole ? "Accéder à mon espace" : cta} <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
										</Link>
									</article>
								</div>
							);
						})}
					</div>
				</section>

				{/* How it works section */}
				<section aria-labelledby="steps-section-title" className="mx-auto w-full max-w-[1236px] px-4 py-24 md:px-6">
					<div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
						<div>
							<div data-reveal className="flex flex-col gap-4 lg:sticky lg:top-28 lg:pb-10">
								<span className="landing-eyebrow w-fit">En trois étapes</span>
								<h2 id="steps-section-title" className="section-display landing-display text-[clamp(2.25rem,5vw,4rem)]">
									Comment fonctionne JobUp ?
								</h2>
								<p className="landing-muted max-w-md text-base sm:text-lg">
									Trois étapes simples, de la création du profil jusqu’à la signature du contrat.
								</p>
							</div>
						</div>
						<ol data-progress="scroll" className="landing-steps">
							{steps.map(({ step, title, description, Icon, visual }, index) => (
								<li
									key={step}
									ref={(element) => { stepRefs.current[index] = element; }}
									data-step={index}
									data-active={activeStep === index || undefined}
									className="landing-step"
								>
									<div className="flex items-center gap-3">
										<span className="landing-step-icon"><Icon className="size-5" /></span>
										<span className="landing-subtle text-xs font-bold tracking-[0.2em] uppercase">Étape {step}</span>
									</div>
									<h3 className="mt-5 text-2xl font-bold sm:text-3xl">{title}</h3>
									<p className="landing-muted mt-3 max-w-md text-base leading-relaxed">{description}</p>
									<div className="landing-step-visual" aria-hidden="true">
										{visual.map((item, itemIndex) => (
											<span key={item} style={delay(itemIndex * 120)}><i>{itemIndex === visual.length - 1 ? "✓" : itemIndex + 1}</i>{item}</span>
										))}
									</div>
								</li>
							))}
						</ol>
					</div>
				</section>

				{/* Bottom CTA Banner */}
				<section aria-label="Rejoindre JobUp" className="px-4 pt-12 pb-28 md:px-6">
					<div data-reveal className="landing-cta mx-auto max-w-[1236px]">
						<div className="landing-cta-glow" aria-hidden="true" />
						<h2 className="section-display landing-display relative max-w-3xl text-[clamp(2.25rem,5.5vw,4.5rem)]">
							Prêt à lancer votre prochaine alternance ?
						</h2>
						<p className="landing-muted relative mt-5 max-w-xl text-base sm:text-lg">
							Créez votre compte gratuitement ou explorez dès maintenant les offres et entreprises partenaires.
						</p>
						<div className="relative mt-10 flex flex-wrap justify-center gap-3">
							<Link to={loggedInHome ?? "/signup"} className="landing-magnet landing-btn-primary" onPointerMove={attractToPointer} onPointerLeave={resetPointer}>
								{loggedInHome ? "Accéder à mon espace" : "Créer un compte gratuit"}
							</Link>
							<Link to="/companies" className="landing-magnet landing-btn-ghost" onPointerMove={attractToPointer} onPointerLeave={resetPointer}>
								Voir les entreprises
							</Link>
						</div>
					</div>
				</section>
			</main>

			<Footer />
		</div>
	);
}
