import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import Button from "./Button";
import StudentNavbar from "./StudentNavbar";
import { focus } from "../utils/searchPageStyles";

type ApplicationsLayoutProps = {
	children: ReactNode;
	/** Largeur, marges et espacement du panneau, propres à chaque écran de la maquette */
	className: string;
};

// Fond, barre de navigation et panneau blanc communs aux écrans de candidatures
export default function ApplicationsLayout({ children, className }: ApplicationsLayoutProps) {
	return (
		<div className="min-h-dvh bg-[#f8fafc] px-4 pt-4 pb-16 text-ink md:px-6 md:pt-6">
			<header>
				<StudentNavbar />
			</header>
			<main className={`mx-auto mt-8 flex flex-col rounded-2xl border border-[#e5e7eb] bg-surface shadow-xs ${className}`}>
				{children}
			</main>
		</div>
	);
}

export function BackToApplications() {
	return (
		<Link to="/applications" className={`flex w-fit items-center gap-2 rounded-xl px-1 py-2 text-sm font-semibold text-primary hover:underline ${focus}`}>
			<img src="/static/img/applications/back.svg" width={18} height={18} alt="" />
			Retour aux candidatures
		</Link>
	);
}

export function LoadingMessage() {
	return <p role="status" className="text-sm text-[#6b7280]">Chargement…</p>;
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
	return (
		<div className="flex flex-col items-start gap-4">
			<p role="alert" className="text-sm">{message}</p>
			<Button onClick={onRetry}>Réessayer</Button>
		</div>
	);
}
