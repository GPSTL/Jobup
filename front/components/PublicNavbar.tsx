import Button from "./Button";
import ThemeToggle from "./ThemeToggle";
import MenuIcon from "./MenuIcon";
import Navbar, { NavbarLink } from "./Navbar";

export default function PublicNavbar({ variant = "solid", signupTo = "/signup" }: { variant?: "glass" | "solid"; signupTo?: string }) {
	return (
		<Navbar variant={variant}>
			<div className="hidden min-w-0 items-center gap-1 xl:flex">
				<NavbarLink to="/offers">Offres d’alternance</NavbarLink>
				<NavbarLink to="/companies">Entreprises</NavbarLink>
				<NavbarLink to="/students">Étudiants</NavbarLink>
				<NavbarLink to="/schools">Écoles &amp; CFA</NavbarLink>
				<NavbarLink to="/pricing">Tarifs</NavbarLink>
			</div>
			<div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
				<NavbarLink to={signupTo}>Inscription</NavbarLink>
				<Button to="/login">Connexion</Button>
			</div>
			<details className="public-menu relative ml-auto shrink-0 xl:hidden sm:ml-0">
				<summary aria-label="Ouvrir le menu" className="flex cursor-pointer list-none items-center justify-center rounded-xl p-2 hover:bg-(--navbar-interaction-bg) focus-visible:bg-(--navbar-interaction-bg) focus-visible:outline-2 focus-visible:outline-primary">
					<MenuIcon open={false} />
				</summary>
				<div className="absolute right-0 top-full z-30 mt-3 flex w-64 flex-col gap-2 rounded-2xl border border-[#e5e7eb] bg-surface p-4 shadow-xl">
					<NavbarLink to="/offers">Offres d’alternance</NavbarLink>
					<NavbarLink to="/companies">Entreprises</NavbarLink>
					<NavbarLink to="/students">Étudiants</NavbarLink>
					<NavbarLink to="/schools">Écoles &amp; CFA</NavbarLink>
					<NavbarLink to="/pricing">Tarifs</NavbarLink>
					<div className="mt-1 flex flex-col gap-2.5 border-t border-[#e5e7eb] pt-3 sm:hidden">
						<NavbarLink to={signupTo}>Inscription</NavbarLink>
						<Button to="/login">Connexion</Button>
					</div>
				</div>
			</details>
			<div className="public-theme-control shrink-0"><ThemeToggle /></div>
		</Navbar>
	);
}
