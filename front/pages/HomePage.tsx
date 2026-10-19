import Button from "../components/Button";
import Navbar, { NavbarLink } from "../components/Navbar";

// One button per profile. `role` uses the values expected by the back end.
const roles = [
	{ label: "Étudiants", role: "student" },
	{ label: "Écoles", role: "school" },
	{ label: "Entreprises", role: "recruiter" },
];

export default function HomePage() {

	return (
		<div className="relative flex min-h-dvh flex-col bg-[url(/static/img/home_bg_image.webp)] bg-cover bg-center">
			{/* Dark veil over the photo, so the white title stays readable. */}
			<div className="absolute inset-0 bg-ink/60" />

			{/* `relative` puts the header and the content above the veil. */}
			<header className="relative p-4 md:p-6">
				<Navbar variant="glass">
					{/* Hidden on small screens: the full bar does not fit on a phone. */}
					<div className="hidden gap-12 lg:flex">
						<NavbarLink to="/offers">Trouver une alternance</NavbarLink>
						<NavbarLink to="/companies">Explorer les entreprises</NavbarLink>
						<NavbarLink to="/pricing">Tarifs</NavbarLink>
					</div>
					<NavbarLink to="/inscription" className="ml-auto">Inscription</NavbarLink>
					<Button to="/login">Connexion</Button>
				</Navbar>
			</header>

			<main className="relative flex flex-1 flex-col items-center justify-center gap-12 px-4 pt-8 pb-16 text-center md:gap-28">
				<h1 className="font-display text-5xl leading-tight text-surface md:text-7xl">
					Ton succès
					<br />
					commence <em>ici</em>
				</h1>

				{/* Stacked on phones, side by side from tablets. */}
				<div className="flex flex-col gap-4 md:flex-row md:gap-12 lg:gap-32">
					{roles.map(({ label, role }) => (
						<Button key={role} to={`/inscription?role=${role}`} size="lg" className="w-50">
							{label}
						</Button>
					))}
				</div>
			</main>
		</div>
	);
};
