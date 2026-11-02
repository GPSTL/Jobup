import Button from "../components/Button";
import PublicNavbar from "../components/PublicNavbar";
import { useSession } from "../components/SessionProvider";

// Placeholder page for routes that are planned but not built yet.
export default function ComingSoonPage({ title = "Bientôt disponible" }: { title?: string }) {
	const { user } = useSession();
	return (
		<div className="min-h-dvh bg-[#f0f0f0] text-[#151a29]">
			<header className="p-4 md:p-6"><PublicNavbar /></header>
			<main className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-5 py-20 text-center md:py-28">
				{title !== "Bientôt disponible" && <p className="rounded-full bg-[#dae8ff] px-4 py-1 font-semibold text-primary">{title}</p>}
				<h1 className="text-4xl font-bold md:text-5xl">Bientôt disponible</h1>
				<p className="text-lg text-[#6c7386]">Cette fonctionnalité arrive prochainement. Retrouvez bientôt cet espace sur JobUp.</p>
				<Button to={user ? "/student" : "/"}>{user ? "Retour à mon espace" : "Retour à l’accueil"}</Button>
			</main>
		</div>
	);
}
