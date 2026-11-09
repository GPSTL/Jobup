import AccountNavbar from "./AccountNavbar";

// Pages of the logged-in recruiter, in the order of the mockup.
// Offer authoring (JOB-022), filters (JOB-036) and messages (JOB-041) remain separate tasks.
const links = [
	{ label: "Mon espace", to: "/recruiter/account" },
	{ label: "Filtrer", to: "/recruiter/filters" },
	{ label: "Candidats", to: "/recruiter/candidates" },
	{ label: "Vos offres", to: "/recruiter/offers" },
	{ label: "Messages", to: "/recruiter/messages" },
];

// Shared by every page of the logged-in recruiter
export default function RecruiterNavbar() {
	return <AccountNavbar links={links} />;
}
