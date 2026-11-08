import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";

import MenuIcon from "./MenuIcon";
import Navbar, { NavbarLink } from "./Navbar";

// Pages of the logged-in student, in the order of the mockup
const links = [
	{ label: "Mon espace", to: "/MonEspace" },
	{ label: "Filtrer", to: "/filters" },
	{ label: "Entreprises", to: "/companies" },
	{ label: "Offres", to: "/offers" },
	{ label: "Messages", to: "/messages" },
	{ label: "Candidatures", to: "/applications" },
];

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

// Shared by every page of the logged-in student. NavbarLink highlights the link of the current page.
export default function StudentNavbar() {
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
		<Navbar>
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

				{/* TODO: notifications */}
			</div>
		</Navbar>
	);
}
