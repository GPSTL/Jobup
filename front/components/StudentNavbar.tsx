import { Link } from "react-router-dom";

import Navbar, { NavbarLink } from "./Navbar";

// Pages of the logged-in student, in the order of the mockup
const links = [
	{ label: "Mon espace", to: "/MonEspace" },
	{ label: "Filtrer", to: "/filters" },
	{ label: "Entreprises", to: "/companies" },
	{ label: "Offres", to: "/offers" },
	{ label: "Messages", to: "/messages" },
	{ label: "Candidatures", to: "/applications" },
];

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

// Shared by every page of the logged-in student. NavbarLink highlights the link of the current page.
export default function StudentNavbar() {
	return (
		<Navbar>
			<div className="ml-auto flex items-center gap-12">
				{/* Hidden on small screens: the full bar does not fit on a phone. */}
				<div className="hidden gap-12 lg:flex">
					{links.map(({ label, to }) => (
						<NavbarLink key={to} to={to}>
							{label}
						</NavbarLink>
					))}
				</div>

				{/* TODO: notifications */}
			</div>
		</Navbar>
	);
}
