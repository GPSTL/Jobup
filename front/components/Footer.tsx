import { Link } from "react-router-dom";
import Logo from "./Logo";

export default function Footer() {
	return (
		<footer aria-label="Pied de page" className="mt-auto border-t border-[#e5e7eb] bg-surface text-ink">
			<div className="mx-auto max-w-[1236px] px-4 py-12 md:px-6 md:py-16">
				<div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
					<div className="flex flex-col gap-4 lg:col-span-2">
						<Logo className="h-7" />
						<p className="max-w-sm text-sm leading-relaxed text-[#6b7280]">
							La plateforme nouvelle génération qui connecte étudiants, entreprises et écoles autour de l’alternance.
						</p>
						<div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#f9fafb] px-3 py-1 text-xs font-medium text-[#6b7280]">
							<span className="size-2 rounded-full bg-[#16803d]" aria-hidden="true" />
							Plateforme active • Rentrée 2026–2027
						</div>
					</div>

					<div className="flex flex-col gap-3">
						<p className="text-xs font-bold tracking-wider text-ink uppercase">Candidats</p>
						<ul className="flex flex-col gap-2 text-sm text-[#6b7280]">
							<li><Link to="/offers" className="hover:text-primary hover:underline">Offres d’alternance</Link></li>
							<li><Link to="/companies" className="hover:text-primary hover:underline">Annuaire entreprises</Link></li>
							<li><Link to="/students" className="hover:text-primary hover:underline">Espace étudiant</Link></li>
							<li><Link to="/signup?role=student" className="hover:text-primary hover:underline">Créer un profil</Link></li>
						</ul>
					</div>

					<div className="flex flex-col gap-3">
						<p className="text-xs font-bold tracking-wider text-ink uppercase">Recruteurs &amp; Écoles</p>
						<ul className="flex flex-col gap-2 text-sm text-[#6b7280]">
							<li><Link to="/signup?role=recruiter" className="hover:text-primary hover:underline">Publier une offre</Link></li>
							<li><Link to="/schools" className="hover:text-primary hover:underline">Espace Écoles &amp; CFA</Link></li>
							<li><Link to="/pricing" className="hover:text-primary hover:underline">Tarifs &amp; formules</Link></li>
						</ul>
					</div>

					<div className="flex flex-col gap-3">
						<p className="text-xs font-bold tracking-wider text-ink uppercase">Accès</p>
						<ul className="flex flex-col gap-2 text-sm text-[#6b7280]">
							<li><Link to="/login" className="hover:text-primary hover:underline">Se connecter</Link></li>
							<li><Link to="/signup" className="hover:text-primary hover:underline">S’inscrire</Link></li>
							<li><Link to="/administration" className="hover:text-primary hover:underline">Administration</Link></li>
						</ul>
					</div>
				</div>

				<div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-[#e5e7eb] pt-6 text-xs text-[#6b7280] sm:flex-row">
					<p>© {new Date().getFullYear()} JobUp. Tous droits réservés.</p>
					<p>Conçu pour accélérer l’insertion professionnelle en alternance.</p>
				</div>
			</div>
		</footer>
	);
}
