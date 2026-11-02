import { Link } from "react-router-dom";
import PublicNavbar from "../components/PublicNavbar";
import HandshakeIcon from "../components/HandshakeIcon";
import Filter from "../components/Filter";
import Megaphone from "../components/Megaphone";

const features = [
	{
		title: "Publiez vos offres",
		Icon: Megaphone,
		description: "Créez une annonce en quelques minutes et suivez ses candidatures.",
	},
	{
		title: "Filtrez et retenez",
		Icon: Filter,
		description: "Profil, expérience, logiciels, région : ne voyez que les bons candidats.",
	},
	{
		title: "Échangez et contractualisez",
		Icon: HandshakeIcon,
		description: "Messagerie intégrée, décision en un clic et dépôt du contrat.",
	},
];

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

export default function RecruiterPage() {
	return (
		<div className="min-h-dvh bg-[#f0f0f0] pb-16 font-sans text-[#151a29]">
			<header className="relative p-4 md:p-6">
				<PublicNavbar variant="glass" signupTo="/signup?role=recruiter" />
			</header>

			<main className="mx-auto max-w-[1272px] px-5 md:px-10">
				<section aria-labelledby="recruiter-title" className="grid items-center gap-9 py-12 md:py-16 lg:grid-cols-[1.08fr_1fr] lg:gap-14 lg:px-11">
					<div>
						<span className="inline-block rounded-full bg-[#dae8ff] px-3 py-1 text-sm font-semibold text-[#1950ff]">Pour les entreprises</span>
						<h1 id="recruiter-title" className="mt-4 text-4xl leading-[0.98] font-bold tracking-tight md:text-5xl">
							Recrutez votre futur alternant, simplement.
						</h1>
						<p className="mt-5 max-w-[590px] text-lg leading-tight text-[#6c7386]">
							Publiez vos offres, filtrez les profils qui vous correspondent et échangez directement avec les candidats et leurs écoles.
						</p>
						<div className="mt-5 flex flex-wrap gap-3">
							<Link to="/signup?role=recruiter" className={`rounded-2xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-600 ${focus}`}>Créer un compte entreprise</Link>
							<Link to="/pricing" className={`rounded-2xl border border-[#cfd4de] bg-white px-6 py-3 font-semibold transition-colors hover:bg-slate-50 ${focus}`}>Voir les tarifs</Link>
						</div>
						<Link to="/login" className={`mt-4 inline-block text-primary hover:underline ${focus}`}>Déjà inscrit ? Se connecter</Link>
					</div>
					<img src="/static/img/home_bg_image.webp" alt="Un espace de travail avec un bureau et un écran d’ordinateur" className="aspect-[1.44] w-full rounded-[26px] object-cover" />
				</section>

				<section aria-label="Les avantages JobUp pour les entreprises" className="grid gap-5 md:grid-cols-3">
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
