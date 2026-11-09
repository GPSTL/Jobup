import AccountNavbar from "./AccountNavbar";

// Pages of the logged-in student, in the order of the mockup
const links = [
	{ label: "Mon espace", to: "/student" },
	{ label: "Filtrer", to: "/filters" },
	{ label: "Entreprises", to: "/companies" },
	{ label: "Offres", to: "/offers" },
	{ label: "Messages", to: "/messages" },
	{ label: "Candidatures", to: "/applications" },
];

// Shared by every page of the logged-in student
export default function StudentNavbar() {
	return <AccountNavbar links={links} />;
}
