import Button from "./Button";
import Navbar, { NavbarLink } from "./Navbar";
import StudentNavbar from "./StudentNavbar";
import { useSession } from "./SessionProvider";

export default function PublicNavbar({ variant = "solid", signupTo = "/signup" }: { variant?: "glass" | "solid"; signupTo?: string }) {
	const { user, loading } = useSession();
	if (user) return <StudentNavbar variant={variant} />;
	if (loading) return <Navbar variant={variant}><span className="ml-auto" role="status">Chargement…</span></Navbar>;
	return (
		<Navbar variant={variant}>
			<div className="hidden gap-12 lg:flex">
				<NavbarLink to="/offers">Trouver une alternance</NavbarLink>
				<NavbarLink to="/companies">Explorer les entreprises</NavbarLink>
				<NavbarLink to="/pricing">Tarifs</NavbarLink>
			</div>
			<div className="ml-auto hidden sm:block"><NavbarLink to={signupTo}>Inscription</NavbarLink></div>
			<Button to="/login" className="ml-auto sm:ml-0">Connexion</Button>
		</Navbar>
	);
}
