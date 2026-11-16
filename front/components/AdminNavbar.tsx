import AccountNavbar from "./AccountNavbar";

const links = [
	{ label: "Mon espace" },
	{ label: "Liste d’utilisateurs", to: "/administration/users" },
	{ label: "Liste d’entreprises" },
	{ label: "Liste d’écoles" },
	{ label: "Signalements" },
	{ label: "Réclamations" },
];

// « Déconnexion » is in the account menu of AccountNavbar, as for the other roles; it leads
// back to the admin login
export default function AdminNavbar() {
	return <AccountNavbar links={links} compact hoverHighlight logoutTo="/administration" />;
}
