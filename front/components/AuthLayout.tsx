import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import Logo from "./Logo";

type AuthLayoutProps = {
	children: ReactNode;
	mode: "login" | "signup";
};

export default function AuthLayout({ children, mode }: AuthLayoutProps) {
	const signup = mode === "signup";
	return <main className="auth-page min-h-dvh bg-[#f8fafc] text-ink lg:grid lg:grid-cols-2">
		<section className="flex min-h-dvh flex-col px-6 py-7 sm:px-10 lg:px-14 xl:px-20">
			<header className="flex items-center justify-between gap-4"><Logo className="h-7" /><Link to="/" className="rounded-sm text-sm font-medium text-[#6b7280] hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">← Accueil</Link></header>
			<div className="mx-auto flex w-full max-w-[410px] flex-1 flex-col justify-center py-12 sm:py-16">{children}</div>
			<footer className="text-xs text-[#6b7280]">© {new Date().getFullYear()} JobUp · L’alternance à votre portée</footer>
		</section>
		<aside aria-label="Présentation JobUp" className="auth-showcase relative m-3 hidden min-h-[calc(100dvh-1.5rem)] flex-col justify-end overflow-hidden rounded-[28px] bg-[#172554] p-10 text-white lg:flex xl:p-14">
			<img src="/static/img/auth-community.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
			<div className="absolute inset-0 bg-gradient-to-t from-[#0b142b] via-[#142853]/80 to-[#142853]/30" />
			<div className="relative z-10 max-w-lg"><span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-white/90 backdrop-blur-sm"><span className="size-1.5 rounded-full bg-[#a6c4ff]" /> POUR ALLER PLUS LOIN</span><p className="mt-6 text-4xl leading-[1.1] font-bold tracking-tight xl:text-5xl">{signup ? "Votre prochaine opportunité commence ici." : "Les bonnes rencontres font avancer les projets."}</p><p className="mt-5 max-w-md text-base leading-relaxed text-white/80">{signup ? "Étudiants, entreprises et écoles : un espace pour construire l’alternance ensemble." : "Retrouvez vos offres, vos candidatures et vos échanges dans un seul espace."}</p></div>
			<div className="relative z-10 mt-10 flex items-center gap-3 border-t border-white/20 pt-5 text-xs text-white/75"><span className="font-semibold text-white">JobUp</span><span aria-hidden="true">·</span><span>Des parcours qui se rencontrent</span></div>
		</aside>
	</main>;
}
