import AccountNavbar from "./AccountNavbar";

type Props = { variant?: "glass" | "solid" };

const links = [
	{ label: "Tableau de bord", to: "/school" },
	{ label: "Étudiants", to: "/school/students" },
	{ label: "Contrats", to: "/school/contracts" },
	{ label: "Messages", to: "/school/messages" },
];

// Shared by every page of the logged-in school account, with the bell of its notifications
export default function SchoolNavbar({ variant }: Props) {
	return <AccountNavbar links={links} variant={variant} notifications="school" />;
}
