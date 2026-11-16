import { useEffect, useState } from "react";
import Button from "../components/Button";
import Navbar, { NavbarLink } from "../components/Navbar";
import StudentNavbar from "../components/StudentNavbar";
import RecruiterNavbar from "../components/RecruiterNavbar";
import { getSession, type SessionResult } from "../services/auth";

import { ROLES } from "../utils/roles";

const homeRoles = [...ROLES].sort((a, b) => a.homeOrder - b.homeOrder);

export default function HomePage() {
	const [session, setSession] = useState<SessionResult | null>(null);
	useEffect(() => {
		let ignore = false;
		getSession().then((result) => { if (!ignore) setSession(result); });
		return () => { ignore = true; };
	}, []);

	return (
		<div className="relative flex min-h-dvh flex-col bg-[url(/static/img/home_bg_image.webp)] bg-cover bg-center">
			{/* Dark veil over the photo, so the white title stays readable. */}
			<div className="absolute inset-0 bg-ink/60" />

			{/* `relative` puts the header and the content above the veil. */}
			{session !== null && <header className="relative p-4 md:p-6">
				{session.ok && session.user.role === 1 ? <StudentNavbar variant="glass" /> : session.ok && session.user.role === 3 ? <RecruiterNavbar variant="glass" /> : session.ok ? null : <Navbar variant="glass">
					{/* Hidden on small screens: the full bar does not fit on a phone. */}
					<div className="hidden gap-12 lg:flex">
						<NavbarLink to="/offers">Trouver une alternance</NavbarLink>
						<NavbarLink to="/companies">Explorer les entreprises</NavbarLink>
						<NavbarLink to="/pricing">Tarifs</NavbarLink>
					</div>
					<NavbarLink to="/signup" className="ml-auto">Inscription</NavbarLink>
					<Button to="/login">Connexion</Button>
				</Navbar>}
			</header>}

			<main className="relative flex flex-1 flex-col items-center justify-center gap-12 px-4 pt-8 pb-16 text-center md:gap-28">
				<h1 className="font-display text-5xl leading-tight text-surface md:text-7xl">
					Ton succès
					<br />
					commence <em>ici</em>
				</h1>

				{/* Stacked on phones, side by side from tablets. */}
				<div className="flex flex-col gap-4 md:flex-row md:gap-12 lg:gap-32">
					{homeRoles.map(({ homeLabel, value, homePath }) => (
						<Button
							key={value}
							to={homePath}
							size="lg"
							className="w-50 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 motion-safe:hover:-translate-y-1 motion-safe:transition motion-safe:duration-200"
						>
							{homeLabel}
						</Button>
					))}
				</div>
			</main>
		</div>
	);
};
