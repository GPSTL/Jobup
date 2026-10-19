import Button from "../components/Button";

// Shown for any URL that matches no route.
export default function NotFoundPage() {
	return (
		<main className="flex flex-col items-center gap-6 px-4 py-24 text-center">
			<p className="font-display text-8xl text-primary">404</p>
			<h1 className="font-display text-5xl">Page introuvable</h1>
			<p className="text-lg">L'adresse que tu cherches n'existe pas.</p>
			<Button to="/">Retour à l'accueil</Button>
		</main>
	);
}
