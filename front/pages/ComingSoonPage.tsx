import Button from "../components/Button";
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
		<main className="flex flex-col items-center gap-6 px-4 py-24 text-center">
			<h1 className="font-display text-5xl">Bientôt disponible</h1>
			<p className="text-lg">Cette page est en cours de construction, reviens bientôt !</p>
			<Button to={returnTo}>Retour à mon espace</Button>
		</main>
	);
}
