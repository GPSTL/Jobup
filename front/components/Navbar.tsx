import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import Logo from "./Logo";

type NavbarProps = {
	/** Links and buttons shown after the logo. Give an item `ml-auto` to push it and the next ones to the right. */
	children: ReactNode;
	/** "glass": translucent, over a photo (home page). "solid": white (app pages). */
	variant?: "glass" | "solid";
};

const variants = {
	glass: "bg-surface/40 backdrop-blur-md border border-surface/50",
	solid: "bg-surface shadow-[0_4px_12px_rgba(0,0,0,0.1)]",
};

// Shared by every navigation bar: logo on the left, content given by the page.
export default function Navbar({ children, variant = "solid" }: NavbarProps) {
	return (
		<nav
			aria-label="Navigation principale"
			className={`flex items-center gap-4 rounded-full px-4 py-3 text-ink md:gap-8 md:px-8 md:py-4 ${variants[variant]}`}
		>
			<Logo />
			{children}
		</nav>
	);
}

type NavbarLinkProps = {
	children: ReactNode;
	to: string;
	/** Extra classes */
	className?: string;
};

const linkBase = [
	"inline-flex items-center whitespace-nowrap rounded-full px-3 py-2 -mx-3 -my-2",
	"motion-safe:transition-colors motion-safe:duration-200",
	"focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
].join(" ");

const linkStates = {
	idle: "hover:bg-surface/60 focus-visible:bg-surface/60",
	// Current page: blue pill
	active: "bg-primary text-on-primary",
};

/** Text link of a navigation bar. Highlighted when it leads to the current page. */
export function NavbarLink({ children, to, className = "" }: NavbarLinkProps) {
	return (
		<NavLink to={to} className={({ isActive }) => `${linkBase} ${linkStates[isActive ? "active" : "idle"]} ${className}`}>
			{children}
		</NavLink>
	);
}
