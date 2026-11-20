import { Link } from "react-router-dom";
import Button from "../components/Button";
import Footer from "../components/Footer";
import PublicNavbar from "../components/PublicNavbar";
import GraduationCapIcon from "../components/GraduationCapIcon";
import UsersIcon from "../components/UsersIcon";
import HandshakeIcon from "../components/HandshakeIcon";

const plans = [
	{
		name: "Étudiants", eyebrow: "Votre prochain départ", price: "Gratuit", note: "Pour trouver votre alternance", Icon: GraduationCapIcon,
		description: "De la première recherche au suivi de votre candidature, avancez à votre rythme.",
		features: ["Recherche d’offres et découverte par swipe", "Sauvegarde de vos offres favorites", "Profil et CV pour préparer vos candidatures", "Suivi des candidatures et messagerie"],
		cta: "Créer mon compte étudiant", to: "/signup?role=student", featured: true,
	},
	{
		// Tarifs de la maquette « Forfaits » (Figma, section Paiement)
		name: "Recruteurs", eyebrow: "Vos futurs talents", price: "49 €/mois", note: "TTC, sans engagement, résiliable à tout moment", Icon: HandshakeIcon,
		description: "Retrouvez les outils pour publier vos offres et rencontrer vos prochains alternants.",
		features: ["Création et publication d’offres", "Page de présentation de votre entreprise", "Recherche de candidats et sélection de profils", "Gestion des candidatures et messagerie"],
		cta: "Découvrir l’espace recruteur", to: "/signup?role=recruiter", featured: false,
	},
	{
		name: "Écoles & CFA", eyebrow: "L’accompagnement collectif", price: "8,33 €/mois", note: "Facturé 100 € TTC par an, licence annuelle", Icon: UsersIcon,
		description: "Suivez vos étudiants, de leurs candidatures jusqu’à la signature de leur contrat.",
		features: ["Tableau de bord de suivi", "Suivi des étudiants rattachés et de leurs candidatures", "Suivi des contrats et export CSV", "Messagerie et notifications"],
		cta: "Découvrir l’espace écoles", to: "/schools", featured: false,
	},
];

const questions = [
	["L’accès étudiant est-il gratuit ?", "Oui. L’accès étudiant présenté ici comprend la recherche d’offres, les favoris, le profil, les candidatures et la messagerie."],
	["Combien coûtent les offres recruteur et école ?", "49 € TTC par mois pour un recruteur, sans engagement et résiliable à tout moment. 100 € TTC par an pour une école ou un CFA, soit 8,33 € par mois. Le paiement en ligne n’est pas encore ouvert : créer un compte ne déclenche aucun prélèvement."],
	["L’espace école est-il déjà disponible ?", "Oui. Une école suit ses étudiants rattachés, leurs candidatures et leurs contrats, qu’elle peut exporter en CSV, et échange avec eux par la messagerie."],
	["J’ai déjà un compte, comment retrouver mon espace ?", "Utilisez le lien Connexion en haut de la page. Vous retrouverez l’espace correspondant à votre rôle."],
];

export default function PricingPage() {
	return <div className="flex min-h-dvh flex-col bg-[#f8fafc] text-ink">
		<div className="hero-mesh border-b border-[#e5e7eb]">
			<header className="px-4 pt-4 md:px-6 md:pt-6"><PublicNavbar /></header>
			<div className="mx-auto max-w-3xl px-5 pt-12 pb-14 text-center md:pt-16 md:pb-20">
				<span className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">À chaque parcours, son espace</span>
				<h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">L’alternance commence<br /><span className="text-primary">avec les bons outils.</span></h1>
				<p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#6b7280]">Un accès gratuit pour les étudiants. Des outils dédiés aux recruteurs et un espace de suivi pour les écoles. Découvrez ce qui vous correspond.</p>
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
					<ul className="my-7 flex flex-1 flex-col gap-4 border-t border-[#e5e7eb] pt-6 text-sm">{features.map(feature => <li key={feature} className="flex gap-3"><span aria-hidden="true" className="font-bold text-primary">✓</span><span>{feature}</span></li>)}</ul>
					<Button to={to} variant={featured ? "primary" : "outline"} className="w-full text-center">{cta}</Button>
				</article>)}
			</section>
			<p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-[#6b7280]">Prix TTC. Le paiement en ligne n’est pas encore ouvert : créer un compte ne déclenche aucun prélèvement.</p>
			<section aria-labelledby="pricing-faq" className="mx-auto mt-20 max-w-3xl">
				<h2 id="pricing-faq" className="text-center text-2xl font-bold">Vos questions, nos réponses</h2>
				<div className="mt-8 flex flex-col gap-3">{questions.map(([question, answer]) => <details key={question} className="group rounded-2xl border border-[#e5e7eb] bg-surface px-5 py-4"><summary className="cursor-pointer rounded-sm text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">{question}</summary><p className="mt-3 text-sm leading-relaxed text-[#6b7280]">{answer}</p></details>)}</div>
			</section>
			<div className="mt-14 text-center"><p className="text-sm text-[#6b7280]">Vous avez déjà rejoint JobUp ?</p><Link to="/login" className="mt-2 inline-block rounded-sm text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">Retrouver mon espace</Link></div>
		</main>
		<Footer />
	</div>;
}
