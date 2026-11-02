import { Link } from "react-router-dom";
import PublicNavbar from "../components/PublicNavbar";
import type { Role } from "../utils/roles";

const plans: { role: Role; title: string; price: string; popular?: boolean; features: string[] }[] = [
	{
		role: "student",
		title: "Étudiants",
		price: "4,99",
		popular: true,
		features: [
			"Recherche et alertes gratuites",
			"Aide au CV et à la lettre de motivation",
			"Mise en avant du profil",
			"Plus de swipes par jour",
		],
	},
	{
		role: "school",
		title: "Écoles / CFA",
		price: "8,33",
		features: [
			"Facturé 100 € par an",
			"Tableaux de bord de suivi",
			"Suivi du placement des étudiants",
		],
	},
	{
		role: "recruiter",
		title: "Recruteurs",
		price: "49",
		features: [
			"Offres sponsorisées",
			"Accès aux candidats qualifiés",
			"Messagerie illimitée",
		],
	},
];

export default function PricingPage() {
	return (
		<div className="min-h-dvh bg-[#f0f0f0] pb-16 font-sans text-[#151a29]">
			<header className="p-4 md:p-6">
				<PublicNavbar variant="glass" />
			</header>

			<main className="mx-auto max-w-[1268px] px-5 pt-8 md:px-10 md:pt-6">
				<div className="text-center">
					<h1 className="text-3xl leading-tight font-bold tracking-tight md:text-[40px]">Choisissez votre formule</h1>
					<p className="mt-2 text-lg leading-tight text-[#6c7386]">Prix TTC, sans engagement, résiliable à tout moment.</p>
				</div>

				<section aria-label="Les formules JobUp" className="mt-10 grid gap-6 md:mt-12 md:grid-cols-3">
					{plans.map(({ role, title, price, popular, features }) => (
						<article
							key={role}
							aria-labelledby={`plan-${role}`}
							className={`flex flex-col rounded-[26px] border-2 bg-white p-7 shadow-[0_4px_12px_rgba(0,0,0,0.08)] md:min-h-[470px] md:p-8 ${popular ? "border-primary" : "border-transparent"}`}
						>
							<h2 id={`plan-${role}`} className="text-2xl leading-tight font-semibold">{title}</h2>
							<p className="mt-3 text-[36px] leading-tight font-bold tracking-tight text-primary">{price} €<span className="text-[30px]">/mois</span></p>
							<ul className="mt-4 mb-10 space-y-2.5">
								{features.map((feature) => (
									<li key={feature} className="flex items-start gap-3 text-base leading-tight">
										<span aria-hidden="true" className="shrink-0 text-lg leading-5 font-bold text-[#2c824b]">✓</span>
										<span>{feature}</span>
									</li>
								))}
							</ul>
							<Link
								to={`/signup?role=${role}`}
								aria-label={`Choisir le plan ${title}`}
								className={`mt-auto inline-flex min-h-11 items-center justify-center rounded-2xl border px-4 py-3 text-center font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${popular ? "border-primary bg-primary text-white hover:bg-blue-600" : "border-[#cfd4de] hover:bg-slate-50"}`}
							>
								Choisir ce plan
							</Link>
						</article>
					))}
				</section>
			</main>
		</div>
	);
}
