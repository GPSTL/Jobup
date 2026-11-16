import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

import MenuIcon from "./MenuIcon";
import Navbar, { NavbarLink } from "./Navbar";
import UserIcon from "./UserIcon";
import { logout } from "../services/auth";
import { MESSAGES } from "../utils/validation";

type AccountNavbarProps = {
	/** Pages of the role, in the order of the mockup */
	links: { label: string; to: string }[];
	showBell?: boolean;
	variant?: "glass" | "solid";
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

// Bar of the logged-in pages, filled by StudentNavbar and RecruiterNavbar. NavbarLink highlights the link of the current page.
export default function AccountNavbar({ links, showBell = false, variant = "solid" }: AccountNavbarProps) {
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
		if (result.ok) navigate("/login", { replace: true });
		else setError(result.reason === "network" ? MESSAGES.networkError : MESSAGES.serverError);
	};

	return (
		<Navbar variant={variant}>
			<div className="relative ml-auto flex items-center gap-12" onKeyDown={onKeyDown}>
				{/* Large screens: the links are in the bar */}
				<div className="hidden gap-12 lg:flex">
					{links.map(({ label, to }) => (
						<NavbarLink key={to} to={to}>
							{label}
						</NavbarLink>
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
					className="absolute top-full right-0 z-10 mt-6 flex w-56 flex-col gap-5 rounded-3xl bg-surface p-6 shadow-[0_4px_12px_rgba(0,0,0,0.1)] lg:hidden"
				>
					{links.map(({ label, to }) => (
						<li key={to}>
							<NavbarLink to={to}>{label}</NavbarLink>
						</li>
					))}
				</ul>
				<div className="relative">
					<button ref={accountButtonRef} type="button" aria-label="Compte utilisateur" aria-expanded={accountOpen} aria-controls={accountMenuId} onClick={() => setAccountOpen((value) => !value)} className={`flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 ${focus}`}>
						<UserIcon />
					</button>
					<div id={accountMenuId} hidden={!accountOpen} className="absolute top-full right-0 z-20 mt-3 min-w-48 rounded-2xl bg-surface p-2 shadow-[0_4px_12px_rgba(0,0,0,0.16)]">
						<button type="button" onClick={onLogout} disabled={pending} className="w-full rounded-xl px-4 py-3 text-left text-red-700 hover:bg-red-50 disabled:opacity-60">
							{pending ? "Déconnexion…" : "Déconnexion"}
						</button>
					</div>
				</div>

				{/* Notifications are not integrated: static icon, no fictitious unread count. */}
				{showBell && <span role="img" aria-label="Notifications"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>}
				{error && <span role="alert" className="sr-only">{error}</span>}
			</div>
		</Navbar>
	);
}
