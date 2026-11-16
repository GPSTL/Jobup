import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import Button from "./Button";
import Navbar, { NavbarLink } from "./Navbar";
import { focus } from "../utils/searchPageStyles";

type ApplicationsLayoutProps = {
	children: ReactNode;
	/** Largeur, marges et espacement du panneau, propres à chaque écran de la maquette */
	className: string;
};

// Fond, barre de navigation et panneau blanc communs aux écrans de candidatures
export default function ApplicationsLayout({ children, className }: ApplicationsLayoutProps) {
	return (
		<div className="min-h-dvh bg-[#f0f0f0] px-4 pt-4 pb-16 text-[#111827] md:px-6 md:pt-6">
			<header>
				{/* TODO JOB-017 : remplacer par StudentNavbar quand elle sera sur main */}
				<Navbar>
					<div className="ml-auto flex gap-10">
						{/* Masqués sur petit écran : la barre complète ne tient pas sur un téléphone */}
						<div className="hidden gap-10 md:flex">
							<NavbarLink to="/student">Mon espace</NavbarLink>
							<NavbarLink to="/companies">Entreprises</NavbarLink>
							<NavbarLink to="/offers">Offres</NavbarLink>
						</div>
						<NavbarLink to="/applications">Candidatures</NavbarLink>
					</div>
				</Navbar>
			</header>
			<main className={`mx-auto mt-10 flex flex-col rounded-[25px] bg-white leading-[normal] shadow-[0_4px_12px_rgba(0,0,0,0.1)] ${className}`}>
				{children}
			</main>
		</div>
	);
}

export function BackToApplications() {
	return (
		<Link to="/applications" className={`flex w-fit items-center gap-2 rounded-[14px] px-1 py-3.5 text-[16px] font-semibold text-primary ${focus}`}>
			<img src="/static/img/applications/back.svg" width={18} height={18} alt="" />
			Retour aux candidatures
		</Link>
	);
}

export function LoadingMessage() {
	return <p role="status" className="text-[16px] text-[#6b7280]">Chargement…</p>;
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
	return (
		<div className="flex flex-col items-start gap-4">
			<p role="alert" className="text-[16px]">{message}</p>
			<Button onClick={onRetry}>Réessayer</Button>
		</div>
	);
}
