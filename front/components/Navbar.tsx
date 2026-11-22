import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import Logo from "./Logo";

type NavbarProps = {
	/** Links and buttons shown after the logo. Give an item `ml-auto` to push it and the next ones to the right. */
	children: ReactNode;
	/** "glass": translucent backdrop blur. "solid": surface with subtle border. */
	variant?: "glass" | "solid";
};

const variants = {
	glass: "bg-surface/85 backdrop-blur-md border border-[#e5e7eb] shadow-xs",
	solid: "bg-surface/90 backdrop-blur-md border border-[#e5e7eb] shadow-xs",
};

// Shared by every navigation bar: logo on the left, content given by the page.
export default function Navbar({ children, variant = "solid" }: NavbarProps) {
	return (
		<nav
			aria-label="Navigation principale"
			className={`jobup-navigation relative z-30 mx-auto flex w-full max-w-[1236px] items-center gap-4 rounded-2xl border border-[#d8e0ec] px-4 py-3 text-sm font-medium text-ink shadow-[0_8px_24px_rgba(15,23,42,0.08)] md:gap-6 md:px-6 md:py-3.5 ${variants[variant]}`}
		>
			<Logo />
			{children}
		</nav>
	);
}

type NavbarLinkProps = {
	children: ReactNode;
	to: string;
	/** Only the exact page highlights the link, not the pages under it (e.g. "/school" and "/school/students") */
	end?: boolean;
	/** Extra classes */
	className?: string;
};

export const navbarItemClass = [
	"inline-flex items-center whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium",
	"motion-safe:transition-all motion-safe:duration-150",
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
].join(" ");

const linkStates = {
	idle: "text-(color:--navbar-link-color) hover:bg-(--navbar-interaction-bg) hover:text-ink focus-visible:bg-(--navbar-interaction-bg) focus-visible:text-ink",
	// Current page: blue pill
	active: "bg-primary/10 font-semibold text-primary",
};

/** Text link of a navigation bar. Highlighted when it leads to the current page. */
export function NavbarLink({ children, to, end, className = "" }: NavbarLinkProps) {
	return (
		<NavLink to={to} end={end} className={({ isActive }) => `${navbarItemClass} ${linkStates[isActive ? "active" : "idle"]} ${className}`}>
			{children}
		</NavLink>
	);
}
