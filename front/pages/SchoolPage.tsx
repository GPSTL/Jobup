import { Link } from "react-router-dom";
import Navbar, { NavbarLink } from "../components/Navbar";
import Button from "../components/Button";
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

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

export default function SchoolPage() {
	return (
		<div className="min-h-dvh bg-[#f0f0f0] pb-16 font-sans text-[#151a29]">
			<header className="relative p-4 md:p-6">
				<Navbar variant="glass">
					{/* Hidden on small screens: the full bar does not fit on a phone. */}
					<div className="hidden gap-12 lg:flex">
						<NavbarLink to="/offers">Trouver une alternance</NavbarLink>
						<NavbarLink to="/companies">Explorer les entreprises</NavbarLink>
						<NavbarLink to="/pricing">Tarifs</NavbarLink>
					</div>
					<NavbarLink to="/signup?role=school" className="ml-auto">Inscription</NavbarLink>
					<Button to="/login">Connexion</Button>
				</Navbar>
			</header>

			<main className="mx-auto max-w-[1272px] px-5 md:px-10">
				<section aria-labelledby="school-title" className="grid items-center gap-9 py-12 md:py-16 lg:grid-cols-[1.08fr_1fr] lg:gap-14 lg:px-11">
					<div>
						<span className="inline-block rounded-full bg-[#dae8ff] px-3 py-1 text-sm font-semibold text-[#1950ff]">Pour les écoles et CFA</span>
						<h1 id="school-title" className="mt-4 text-4xl leading-[0.98] font-bold tracking-tight md:text-5xl">
							Suivez l’alternance de vos étudiants en temps réel.
						</h1>
						<p className="mt-5 max-w-[590px] text-lg leading-tight text-[#6c7386]">
							Validez vos étudiants, suivez leurs candidatures et retrouvez tous leurs contrats d’alternance au même endroit.
						</p>
						<div className="mt-5 flex flex-wrap gap-3">
							<Link to="/signup?role=school" className={`rounded-2xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-600 ${focus}`}>Inscrire mon établissement</Link>
							<Link to="/pricing" className={`rounded-2xl border border-[#cfd4de] bg-white px-6 py-3 font-semibold transition-colors hover:bg-slate-50 ${focus}`}>Voir les tarifs</Link>
						</div>
						<Link to="/login" className={`mt-4 inline-block text-primary hover:underline ${focus}`}>Déjà inscrit ? Se connecter</Link>
					</div>
					<img src="/static/img/home_bg_image.webp" alt="Un espace de travail avec un bureau et un écran d’ordinateur" className="aspect-[1.44] w-full rounded-[26px] object-cover" />
				</section>

				<section aria-label="Les avantages JobUp pour les écoles" className="grid gap-5 md:grid-cols-3">
					{features.map(({ title, description, Icon }) => (
						<article key={title} className="rounded-[22px] bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
							<div className="mb-2 flex size-[50px] items-center justify-center rounded-2xl bg-[#dae8ff] text-primary">
								<Icon className="size-6" />
							</div>
							<h2 className="text-xl leading-tight font-semibold">{title}</h2>
							<p className="mt-2 text-[15px] leading-tight text-[#6c7386]">{description}</p>
						</article>
					))}
				</section>
			</main>
		</div>
	);
}
