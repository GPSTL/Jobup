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

type PlanTier = {
	label: string;
	price: string;
	details: string[];
	highlight?: boolean;
};

type Plan = {
	name: string;
	eyebrow: string;
	badge: string;
	price: string;
	note: string;
	Icon: typeof GraduationCapIcon;
	description: string;
	tiers?: PlanTier[];
	features: string[];
	cta: string;
	to: string;
	featured: boolean;
};

const plans: Plan[] = [
	{
		name: "Étudiants",
		eyebrow: "Votre prochain départ",
		badge: "Gratuit ou Premium",
		price: "4,99 € / mois",
		note: "Offre Premium · Offre gratuite disponible (5 matchs / jour)",
		Icon: GraduationCapIcon,
		description: "Trouvez votre alternance gratuitement à votre rythme, ou passez en Premium pour maximiser votre visibilité.",
		tiers: [
			{
				label: "Offre Gratuite — 0 €",
				price: "5 matchs / jour",
				details: [
					"5 matchs par jour",
					"Profil, import de CV, candidatures et messagerie",
				],
			},
			{
				label: "Offre Premium — 4,99 € / mois",
				price: "Illimité",
				highlight: true,
				details: [
					"Matchs de CV illimités",
					"Mise en avant du profil auprès des recruteurs",
					"Liste des entreprises ayant consulté votre profil",
				],
			},
		],
		features: [
			"Recherche d’offres et découverte par swipe",
			"Sauvegarde de vos offres favorites",
			"Suivi des candidatures et des contrats jusqu’à la signature",
		],
		cta: "Créer mon compte étudiant",
		to: "/signup?role=student",
		featured: true,
	},
	{
		name: "Entreprises",
		eyebrow: "Vos futurs talents",
		badge: "Sans offre gratuite",
		price: "149 € / mois",
		note: "Abonnement mensuel · Pas d’offre gratuite",
		Icon: HandshakeIcon,
		description: "Tous les outils pour publier vos offres, trier automatiquement les CV et recruter vos prochains alternants.",
		features: [
			"Création et publication d’offres d’alternance",
			"Classement automatique des candidatures par matching CV",
			"Accès au vivier de candidats et présélection par swipe",
			"Page de présentation de votre entreprise",
			"Messagerie directe et dépôt des contrats d’alternance",
		],
		cta: "Découvrir l’espace entreprise",
		to: "/signup?role=recruiter",
		featured: false,
	},
	{
		name: "Écoles & CFA",
		eyebrow: "L’accompagnement collectif",
		badge: "Seuil : 50 étudiants gratuits",
		price: "1 200 € / an",
		note: "Soit 100 € / mois au-delà de 50 étudiants suivis",
		Icon: UsersIcon,
		description: "Suivez le placement de vos promotions en temps réel, relancez vos étudiants et centralisez leurs contrats.",
		tiers: [
			{
				label: "Seuil Découverte — Gratuit",
				price: "≤ 50 étudiants",
				details: [
					"Gratuit jusqu’à 50 étudiants suivis (1 promotion)",
				],
			},
			{
				label: "Licence Établissement — 1 200 € / an",
				price: "Illimité",
				highlight: true,
				details: [
					"Étudiants et promotions illimités (au-delà de 50 étudiants)",
				],
			},
		],
		features: [
			"Tableau de bord de placement en temps réel (% placés, en recherche)",
			"Validation des demandes de rattachement des étudiants",
			"Centralisation, validation et suivi des contrats d’alternance",
			"Messagerie et relance directe des étudiants",
		],
		cta: "Inscrire mon établissement",
		to: "/signup?role=school",
		featured: false,
	},
];

const questions = [
	["Quelle est la différence entre l’offre Étudiant gratuite et l’offre Premium ?", "L’offre gratuite inclut 5 matchs par jour, la création de votre profil avec CV, le suivi des candidatures et la messagerie. L’offre Premium à 4,99 €/mois débloque les matchs de CV illimités, la mise en avant de votre profil auprès des recruteurs et la liste des entreprises ayant consulté votre profil."],
	["Y a-t-il une offre gratuite pour les entreprises ?", "Non. L’offre Entreprise est un abonnement unique à 149 €/mois (sans offre gratuite) donnant un accès complet à la publication d’offres, au matching de CV, à la recherche de candidats, à la messagerie et au dépôt des contrats."],
	["Comment fonctionne le seuil pour les Écoles & CFA ?", "Un établissement peut utiliser JobUp gratuitement jusqu’à 50 étudiants suivis (l’équivalent d’une promotion). Au-delà de ce seuil de 50 étudiants, la licence annuelle à 1 200 €/an (soit 100 €/mois) ouvre le suivi en illimité pour toutes vos promotions."],
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
				<p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#6b7280]">Une offre gratuite ou Premium à 4,99 €/mois pour les étudiants, un abonnement dédié aux entreprises à 149 €/mois et un espace pour les écoles avec seuil découverte gratuit.</p>
			</div>
		</div>
		<main className="mx-auto w-full max-w-[1236px] px-4 py-12 md:px-6 md:py-16">
			<section aria-label="Les formules JobUp" className="grid items-stretch gap-6 lg:grid-cols-3">
				{plans.map(({ name, eyebrow, badge, price, note, Icon, description, tiers, features, cta, to, featured }) => <article key={name} className={`relative flex min-w-0 flex-col rounded-3xl border bg-surface p-6 shadow-sm sm:p-8 ${featured ? "border-primary ring-1 ring-primary" : "border-[#e5e7eb]"}`}>
					<div className="mb-6 flex items-center justify-between gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-6" /></span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${featured ? "bg-primary/10 text-primary" : "bg-[#f3f4f6] text-[#4b5563]"}`}>{badge}</span></div>
					<p className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">{eyebrow}</p>
					<h2 className="mt-2 text-xl font-bold">{name}</h2>
					<p className="mt-3 min-h-16 text-sm leading-relaxed text-[#6b7280]">{description}</p>
					<p className="mt-6 text-3xl font-bold tracking-tight">{price}</p><p className="mt-2 text-xs text-[#6b7280]">{note}</p>
					{tiers && (
						<div className="mt-6 flex flex-col gap-3">
							{tiers.map(({ label, price: tierPrice, details, highlight }) => (
								<div key={label} className={`rounded-2xl border p-4 ${highlight ? "border-primary/40 bg-primary/5" : "border-[#e5e7eb] bg-[#f8fafc]"}`}>
									<div className="flex items-center justify-between gap-2">
										<p className="text-xs font-bold text-ink">{label}</p>
										<span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${highlight ? "bg-primary text-on-primary" : "bg-[#e5e7eb] text-ink"}`}>{tierPrice}</span>
									</div>
									<ul className="mt-2.5 flex flex-col gap-1.5 text-xs text-[#4b5563]">
										{details.map((detail) => (
											<li key={detail} className="flex gap-2">
												<span aria-hidden="true" className="font-bold text-primary">✓</span>
												<span>{detail}</span>
											</li>
										))}
									</ul>
								</div>
							))}
						</div>
					)}
					<ul className="my-7 flex flex-1 flex-col gap-4 border-t border-[#e5e7eb] pt-6 text-sm">{features.map(feature => <li key={feature} className="flex gap-3"><span aria-hidden="true" className="font-bold text-primary">✓</span><span>{feature}</span></li>)}</ul>
					<Button to={loggedInHome ?? to} variant={featured ? "primary" : "outline"} className="w-full text-center">{loggedInHome ? "Accéder à mon espace" : cta}</Button>
				</article>)}
			</section>
			<p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-[#6b7280]">Paiement sécurisé par carte bancaire, PayPal, Google Pay ou Apple Pay. Sans engagement pour les offres mensuelles.</p>
			<section aria-labelledby="pricing-faq" className="mx-auto mt-20 max-w-3xl">
				<h2 id="pricing-faq" className="text-center text-2xl font-bold">Vos questions, nos réponses</h2>
				<div className="mt-8 flex flex-col gap-3">{questions.map(([question, answer]) => <details key={question} className="group rounded-2xl border border-[#e5e7eb] bg-surface px-5 py-4"><summary className="cursor-pointer rounded-sm text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">{question}</summary><p className="mt-3 text-sm leading-relaxed text-[#6b7280]">{answer}</p></details>)}</div>
			</section>
			<div className="mt-14 text-center"><p className="text-sm text-[#6b7280]">Vous avez déjà rejoint JobUp ?</p><Link to={loggedInHome ?? "/login"} className="mt-2 inline-block rounded-sm text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">Retrouver mon espace</Link></div>
		</main>
		<Footer />
	</div>;
}
