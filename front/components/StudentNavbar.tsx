import AccountNavbar from "./AccountNavbar";

type Props = { variant?: "glass" | "solid" };

// Pages of the logged-in student, in the order of the mockup
const links = [
	{ label: "Mon espace", to: "/student" },
	{ label: "Entreprises", to: "/companies" },
	{ label: "Offres", to: "/offers" },
	{ label: "Messages", to: "/messages" },
	{ label: "Candidatures", to: "/applications" },
];

// Shared by every page of the logged-in student
export default function StudentNavbar({ variant }: Props) {
	return <AccountNavbar links={links} variant={variant} />;
}
