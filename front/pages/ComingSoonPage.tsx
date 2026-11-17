import Button from "../components/Button";
import Footer from "../components/Footer";
import PublicNavbar from "../components/PublicNavbar";
import { useLocation } from "react-router-dom";

// Placeholder page for routes that are planned but not built yet.
export default function ComingSoonPage() {
	const location = useLocation();
	const returnTo = location.pathname.startsWith("/recruiter/")
		? "/recruiter/candidates"
		: location.pathname === "/filters"
			? "/student"
			: "/offers";
	return (
		<div className="flex min-h-dvh flex-col bg-[#f8fafc] text-ink">
			<header className="px-4 pt-4 md:px-6 md:pt-6">
				<PublicNavbar />
			</header>
			<main className="mx-auto my-auto flex w-full max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
				<span className="rounded-full bg-[#dbeafe] px-3.5 py-1 text-xs font-semibold text-[#1d4ed8]">Prochainement</span>
				<h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Bientôt disponible</h1>
				<p className="text-sm sm:text-base text-[#6b7280]">Cette page est en cours de construction, reviens bientôt !</p>
				<Button to={returnTo} className="mt-2">Retour à mon espace</Button>
			</main>
			<Footer />
		</div>
	);
}
