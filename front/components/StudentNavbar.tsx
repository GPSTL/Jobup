import AccountNavbar from "./AccountNavbar";

type Props = { variant?: "glass" | "solid" };

// Pages of the logged-in student, in the order of the mockup
const links = [
 { label: "Trouver une alternance", to: "/offers" },
 { label: "Entreprises", to: "/companies" },
 { label: "Mes candidatures", to: "/applications" },
 { label: "Messages", to: "/messages" },
 { label: "Mon espace", to: "/student" },
];

// Shared by every page of the logged-in student, with the bell of the notifications (JOB-042)
export default function StudentNavbar({ variant }: Props) {
	return <AccountNavbar links={links} variant={variant} notifications="student" />;
}
