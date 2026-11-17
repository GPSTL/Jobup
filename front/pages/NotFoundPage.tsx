import Button from "../components/Button";
import Footer from "../components/Footer";
import PublicNavbar from "../components/PublicNavbar";

// Shown for any URL that matches no route.
export default function NotFoundPage() {
	return (
		<div className="flex min-h-dvh flex-col bg-[#f8fafc] text-ink">
			<header className="px-4 pt-4 md:px-6 md:pt-6">
				<PublicNavbar />
			</header>
			<main className="mx-auto my-auto flex w-full max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
				<p className="text-6xl font-extrabold tracking-tight text-primary sm:text-7xl">404</p>
				<h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Page introuvable</h1>
				<p className="text-sm sm:text-base text-[#6b7280]">L’adresse que tu cherches n’existe pas ou a été déplacée.</p>
				<Button to="/" className="mt-2">Retour à l’accueil</Button>
			</main>
			<Footer />
		</div>
	);
}
