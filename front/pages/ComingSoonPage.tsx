import Button from "../components/Button";

// Placeholder page for routes that are planned but not built yet.
export default function ComingSoonPage() {
	return (
		<main className="flex flex-col items-center gap-6 px-4 py-24 text-center">
			<h1 className="font-display text-5xl">Bientôt disponible</h1>
			<p className="text-lg">Cette page est en cours de construction, reviens bientôt !</p>
			<Button to="/">Retour à l'accueil</Button>
		</main>
	);
}
