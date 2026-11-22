import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

import MenuIcon from "./MenuIcon";
import Navbar, { NavbarLink, navbarItemClass } from "./Navbar";
import NotificationBell from "./NotificationBell";
import UserIcon from "./UserIcon";
import ThemeToggle from "./ThemeToggle";
import { logout } from "../services/auth";
import type { NotificationRole } from "../utils/notifications";
import { MESSAGES } from "../utils/validation";

type AccountNavbarProps = {
	/** Pages of the role, in the order of the mockup */
	links: { label: string; to?: string; end?: boolean }[];
	/** Static bell, for the roles whose notifications are not built yet */
	showBell?: boolean;
	/** Bell with the unread count and the panel of the notifications of this role (JOB-042, JOB-046) */
	notifications?: NotificationRole;
	variant?: "glass" | "solid";
	/** Page shown after « Déconnexion » */
	logoutTo?: string;
	/** Tighter spacing for roles with more navigation items. */
	compact?: boolean;
	hoverHighlight?: boolean;
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

// Shared by student, recruiter and administrator pages.
export default function AccountNavbar({ links, showBell = false, notifications, variant = "solid", logoutTo = "/login", compact = false, hoverHighlight = false }: AccountNavbarProps) {
	// Menu of the small screens, where the links do not fit in the bar
	const [open, setOpen] = useState(false);
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);
	const navigate = useNavigate();
	const menuButtonRef = useRef<HTMLButtonElement>(null);
	const menuId = useId();
	const accountMenuId = useId();
	const [accountOpen, setAccountOpen] = useState(false);

	// Escape closes the menu and gives the focus back to its button, so keyboard users are not lost
	const onKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape" && accountOpen) {
			setAccountOpen(false);
			accountButtonRef.current?.focus();
			return;
		}
		if (e.key === "Escape" && open) {
			setOpen(false);
			menuButtonRef.current?.focus();
		}
	};
	const accountButtonRef = useRef<HTMLButtonElement>(null);
	const onLogout = async () => {
		if (pending) return;
		setPending(true);
		setError("");
		const result = await logout();
		setPending(false);
		if (result.ok) navigate(logoutTo, { replace: true });
		else setError(result.reason === "network" ? MESSAGES.networkError : MESSAGES.serverError);
	};

	return (
		<Navbar variant={variant}>
			<div className={`account-navigation relative ml-auto flex min-w-0 flex-1 items-center ${hoverHighlight ? "account-nav-hover" : ""} ${compact ? "gap-2 lg:gap-3" : "gap-2 lg:gap-3"}`} onKeyDown={onKeyDown}>
				{/* Large screens: the links are in the bar */}
				<div className={`mr-auto hidden lg:flex ${compact ? "min-w-0 flex-wrap justify-end gap-x-2 gap-y-2" : "gap-2 lg:gap-3"}`}>
					{links.map(({ label, to, end }) => (
						to ? <NavbarLink key={label} to={to} end={end}>{label}</NavbarLink>
							: <span key={label} aria-disabled="true" title="Bientôt disponible" className={navbarItemClass}>{label}</span>
					))}
				</div>

				{/* Small screens: the links are in a menu opened by this button */}
				<button
					ref={menuButtonRef}
					type="button"
					aria-expanded={open}
					aria-controls={menuId}
					onClick={() => setOpen(!open)}
					className={`cursor-pointer rounded-full p-1 lg:hidden ${focus}`}
				>
					<span className="sr-only">Menu</span>
					<MenuIcon open={open} />
				</button>
				{/* Always in the page, so aria-controls points to it. A click on a link bubbles up to the list and closes the menu. */}
				<ul
					id={menuId}
					hidden={!open}
					onClick={() => setOpen(false)}
					className={`absolute top-full right-0 z-10 mt-6 flex w-56 flex-col gap-5 rounded-3xl bg-surface p-6 shadow-[0_4px_12px_rgba(0,0,0,0.1)] lg:hidden`}
				>
					{links.map(({ label, to, end }) => (
						<li key={label}>
							{to ? <NavbarLink to={to} end={end}>{label}</NavbarLink> : <span aria-disabled="true" title="Bientôt disponible" className={navbarItemClass}>{label}</span>}
						</li>
					))}
				</ul>
				{/* Notifications of this role are not integrated yet: static icon, no fictitious unread count. */}
				{showBell && !notifications && <span role="img" aria-label="Notifications"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>}
				{notifications && <NotificationBell role={notifications} />}
				<ThemeToggle />
				<div className="relative">
					<button ref={accountButtonRef} type="button" aria-label="Compte utilisateur" aria-expanded={accountOpen} aria-controls={accountMenuId} onClick={() => setAccountOpen((value) => !value)} className={`flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 ${focus}`}>
						<UserIcon />
					</button>
					<div id={accountMenuId} hidden={!accountOpen} className="absolute top-full right-0 z-20 mt-3 w-52 rounded-xl border border-[#e5e7eb] bg-surface p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
						<button type="button" onClick={onLogout} disabled={pending} className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-(color:--logout-color) transition-colors hover:bg-(--logout-hover-bg) focus-visible:bg-(--logout-hover-bg) disabled:cursor-wait disabled:opacity-60 ${focus}`}>
							<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l4 4-4 4M9 12h12" /></svg>
							{pending ? "Déconnexion…" : "Se déconnecter"}
						</button>
					</div>
				</div>

				{error && <span role="alert" className="sr-only">{error}</span>}
			</div>
		</Navbar>
	);
}
