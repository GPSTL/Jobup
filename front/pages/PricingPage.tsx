import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import Footer from "../components/Footer";
import PublicNavbar from "../components/PublicNavbar";
import StudentNavbar from "../components/StudentNavbar";
import RecruiterNavbar from "../components/RecruiterNavbar";
import SchoolNavbar from "../components/SchoolNavbar";
import AdminNavbar from "../components/AdminNavbar";
import GraduationCapIcon from "../components/GraduationCapIcon";
import UsersIcon from "../components/UsersIcon";
import HandshakeIcon from "../components/HandshakeIcon";
import { getSession, type SessionResult } from "../services/auth";
import { accountHome } from "../utils/accountHome";

const plans = [
	{
		name: "Étudiants", eyebrow: "Votre prochain départ", price: "Gratuit", note: "Pour trouver votre alternance", Icon: GraduationCapIcon,
		description: "De la première recherche au suivi de votre candidature, avancez à votre rythme.",
		features: ["Recherche d’offres et découverte par swipe", "Sauvegarde de vos offres favorites", "Profil et CV pour préparer vos candidatures", "Suivi des candidatures et messagerie"],
		cta: "Créer mon compte étudiant", to: "/signup?role=student", featured: true,
	},
	{
		name: "Recruteurs", eyebrow: "Vos futurs talents", price: "Tarifs à venir", note: "Conditions commerciales à confirmer", Icon: HandshakeIcon,
		description: "Retrouvez les outils pour publier vos offres et rencontrer vos prochains alternants.",
		features: ["Création et publication d’offres", "Page de présentation de votre entreprise", "Recherche de candidats et sélection de profils", "Gestion des candidatures et messagerie"],
		cta: "Découvrir l’espace recruteur", to: "/signup?role=recruiter", featured: false,
	},
	{
		name: "Écoles & CFA", eyebrow: "L’accompagnement collectif", price: "Prochainement", note: "Offre et tarifs en préparation", Icon: UsersIcon,
		description: "Un espace dédié aux établissements est en préparation pour accompagner leurs étudiants.",
		features: ["Suivi des étudiants — prévu", "Vue des candidatures — prévue", "Suivi des contrats — prévu", "Accompagnement des promotions — prévu"],
		cta: "Découvrir le projet écoles", to: "/schools", featured: false,
	},
];

const questions = [
	["L’accès étudiant est-il gratuit ?", "Oui. L’accès étudiant présenté ici comprend la recherche d’offres, les favoris, le profil, les candidatures et la messagerie."],
	["Puis-je souscrire une offre payante ici ?", "Pas encore. Les tarifs professionnels et leurs conditions seront précisés avant l’ouverture de la souscription. Cette page ne déclenche aucun paiement."],
	["L’espace école est-il déjà disponible ?", "L’espace de gestion des établissements est en préparation. La page Écoles & CFA présente le projet ; ses fonctionnalités ne sont pas encore disponibles."],
	["J’ai déjà un compte, comment retrouver mon espace ?", "Utilisez le lien Connexion en haut de la page. Vous retrouverez l’espace correspondant à votre rôle."],
];

export default function PricingPage() {
	const [session, setSession] = useState<SessionResult | null>(null);
	useEffect(() => {
		let ignore = false;
		getSession().then((result) => { if (!ignore) setSession(result); });
		return () => { ignore = true; };
	}, []);
	const loggedInHome = session?.ok ? accountHome(session.user.role) : null;

	return <div className="flex min-h-dvh flex-col bg-[#f8fafc] text-ink">
		<div className="hero-mesh border-b border-[#e5e7eb]">
			<header className="px-4 pt-4 md:px-6 md:pt-6">
				{session?.ok && session.user.role === 1 ? (
					<StudentNavbar />
				) : session?.ok && session.user.role === 2 ? (
					<SchoolNavbar />
				) : session?.ok && session.user.role === 3 ? (
					<RecruiterNavbar />
				) : session?.ok && session.user.role === 127 ? (
					<AdminNavbar />
				) : (
					<PublicNavbar />
				)}
			</header>
			<div className="mx-auto max-w-3xl px-5 pt-12 pb-14 text-center md:pt-16 md:pb-20">
				<span className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">À chaque parcours, son espace</span>
				<h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">L’alternance commence<br /><span className="text-primary">avec les bons outils.</span></h1>
				<p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#6b7280]">Un accès gratuit pour les étudiants. Des outils dédiés aux recruteurs et un projet d’espace pour les écoles. Découvrez ce qui vous correspond.</p>
			</div>
		</div>
		<main className="mx-auto w-full max-w-[1236px] px-4 py-12 md:px-6 md:py-16">
			<section aria-label="Les formules JobUp" className="grid items-stretch gap-6 lg:grid-cols-3">
				{plans.map(({ name, eyebrow, price, note, Icon, description, features, cta, to, featured }) => <article key={name} className={`relative flex min-w-0 flex-col rounded-3xl border bg-surface p-6 shadow-sm sm:p-8 ${featured ? "border-primary ring-1 ring-primary" : "border-[#e5e7eb]"}`}>
					<div className="mb-6 flex items-center justify-between gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-6" /></span>{featured && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Accès gratuit</span>}</div>
					<p className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">{eyebrow}</p>
					<h2 className="mt-2 text-xl font-bold">{name}</h2>
					<p className="mt-3 min-h-20 text-sm leading-relaxed text-[#6b7280]">{description}</p>
					<p className="mt-6 text-3xl font-bold tracking-tight">{price}</p><p className="mt-2 text-xs text-[#6b7280]">{note}</p>
					<ul className="my-7 flex flex-1 flex-col gap-4 border-t border-[#e5e7eb] pt-6 text-sm">{features.map(feature => <li key={feature} className="flex gap-3"><span aria-hidden="true" className="font-bold text-primary">{name === "Écoles & CFA" ? "○" : "✓"}</span><span>{feature}</span></li>)}</ul>
					<Button to={loggedInHome ?? to} variant={featured ? "primary" : "outline"} className="w-full text-center">{loggedInHome ? "Accéder à mon espace" : cta}</Button>
				</article>)}
			</section>
			<p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-[#6b7280]">Aucun abonnement payant n’est proposé à la souscription pour le moment. Les fonctionnalités prévues pour les écoles sont indiquées comme telles.</p>
			<section aria-labelledby="pricing-faq" className="mx-auto mt-20 max-w-3xl">
				<h2 id="pricing-faq" className="text-center text-2xl font-bold">Vos questions, nos réponses</h2>
				<div className="mt-8 flex flex-col gap-3">{questions.map(([question, answer]) => <details key={question} className="group rounded-2xl border border-[#e5e7eb] bg-surface px-5 py-4"><summary className="cursor-pointer rounded-sm text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">{question}</summary><p className="mt-3 text-sm leading-relaxed text-[#6b7280]">{answer}</p></details>)}</div>
			</section>
			<div className="mt-14 text-center"><p className="text-sm text-[#6b7280]">Vous avez déjà rejoint JobUp ?</p><Link to={loggedInHome ?? "/login"} className="mt-2 inline-block rounded-sm text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">Retrouver mon espace</Link></div>
		</main>
		<Footer />
	</div>;
}
