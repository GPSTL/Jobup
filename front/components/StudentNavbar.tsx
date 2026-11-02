import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import MenuIcon from "./MenuIcon";
import Navbar, { NavbarLink } from "./Navbar";
import { useSession } from "./SessionProvider";

// Pages of the logged-in student, in the order of the mockup
const links = [
	{ label: "Mon espace", to: "/student" },
	{ label: "Filtrer", to: "/filters" },
	{ label: "Entreprises", to: "/companies" },
	{ label: "Offres", to: "/student/offers" },
	{ label: "Messages", to: "/messages" },
	{ label: "Candidatures", to: "/applications" },
];

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

// Shared by every page of the logged-in student. NavbarLink highlights the link of the current page.
export default function StudentNavbar({ variant = "solid" }: { variant?: "glass" | "solid" }) {
	const navigate = useNavigate();
	const { user, signOut } = useSession();
	const [logoutError, setLogoutError] = useState(false);
	const [signingOut, setSigningOut] = useState(false);
	// Menu of the small screens, where the links do not fit in the bar
	const [open, setOpen] = useState(false);
	const menuButtonRef = useRef<HTMLButtonElement>(null);
	const menuId = useId();

	// Escape closes the menu and gives the focus back to its button, so keyboard users are not lost
	const onKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape" && open) {
			setOpen(false);
			menuButtonRef.current?.focus();
		}
	};

	return (
		<Navbar variant={variant}>
			<div className="relative ml-auto flex items-center gap-4 lg:gap-12" onKeyDown={onKeyDown}>
				{/* Large screens: the links are in the bar */}
				<div className="hidden gap-12 lg:flex">
					{links.map(({ label, to }) => (
						<NavbarLink key={to} to={to} end={to === "/student"}>
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
							<NavbarLink to={to} end={to === "/student"}>{label}</NavbarLink>
						</li>
					))}
				</ul>

				{user && (
					<button
						type="button"
						className={`cursor-pointer rounded-full px-3 py-2 text-primary ${focus}`}
						disabled={signingOut}
						onClick={async () => {
							setSigningOut(true);
							setLogoutError(false);
							if (await signOut()) navigate("/login", { replace: true });
							else setLogoutError(true);
							setSigningOut(false);
						}}
					>
						Déconnexion
					</button>
				)}
				{logoutError && <p role="alert" className="absolute top-full right-0 mt-3 rounded-xl bg-white p-3 text-sm text-red-600">Déconnexion impossible. Réessayez.</p>}
				{/* TODO: notifications */}
			</div>
		</Navbar>
	);
}
