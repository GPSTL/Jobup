import Button from "../components/Button";
import Navbar, { NavbarLink } from "../components/Navbar";


export default function HomePage() {

	return (
		<>
			<header className="p-4 md:p-6">
				<Navbar variant="glass">
					{/* Hidden on small screens: the full bar does not fit on a phone. */}
					<div className="hidden gap-12 lg:flex">
						<NavbarLink to="/offers">Trouver une alternance</NavbarLink>
						<NavbarLink to="/companies">Explorer les entreprises</NavbarLink>
						<NavbarLink to="/pricing">Tarifs</NavbarLink>
					</div>
					<NavbarLink to="/signup" className="ml-auto">Inscription</NavbarLink>
					<Button to="/login">Connexion</Button>
				</Navbar>
			</header>

		</>
	);
};
