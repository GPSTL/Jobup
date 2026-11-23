import AccountNavbar from "./AccountNavbar";

const links = [
	{ label: "Mon espace", to: "/administration/account" },
	{ label: "Utilisateurs", to: "/administration/users" },
	{ label: "Entreprises", to: "/administration/companies" },
	{ label: "Écoles", to: "/administration/schools" },
	{ label: "Signalements", to: "/administration/reports" },
	{ label: "Réclamations", to: "/administration/claims" },
];

// « Déconnexion » is in the account menu of AccountNavbar, as for the other roles; it leads
// back to the admin login
export default function AdminNavbar() {
	return <AccountNavbar links={links} compact hoverHighlight logoutTo="/administration" />;
}
