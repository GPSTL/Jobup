import AccountNavbar from "./AccountNavbar";

// Pages of the logged-in recruiter, in the order of the mockup.
// The pages not built yet (JOB-022 for "Vos offres", JOB-036, JOB-041) show "Bientôt disponible": see /recruiter/* in App.tsx.
const links = [
	{ label: "Mon espace", to: "/recruiter/account" },
	{ label: "Filtrer", to: "/recruiter/filters" },
	{ label: "Candidats", to: "/recruiter/candidates" },
	{ label: "Vos offres", to: "/recruiter/offers" },
	{ label: "Messages", to: "/recruiter/messages" },
];

// Shared by every page of the logged-in recruiter
export default function RecruiterNavbar() {
	return <AccountNavbar links={links} showBell />;
}
