import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";

import Button from "./Button";
import { getSession, STUDENT_ROLE, type SessionResult, type User } from "../services/auth";
import { MESSAGES } from "../utils/validation";

type RequireStudentProps = {
	/** Page affichée une fois la session vérifiée */
	children: (user: User) => ReactNode;
};

// Protège les pages de l'espace étudiant : sans session valide, retour à la connexion
export default function RequireStudent({ children }: RequireStudentProps) {
	const [session, setSession] = useState<SessionResult | null>(null);

	const check = useCallback(() => {
		getSession().then(setSession);
	}, []);

	useEffect(() => {
		check();
		// Revérifie quand l'onglet redevient visible : une session expirée entre-temps renvoie à la connexion
		const onVisible = () => {
			if (document.visibilityState === "visible") check();
		};
		document.addEventListener("visibilitychange", onVisible);
		return () => document.removeEventListener("visibilitychange", onVisible);
	}, [check]);

	if (session === null) {
		return (
			<main className="flex min-h-screen items-center justify-center px-4" aria-busy="true">
				<p className="text-lg">Chargement…</p>
			</main>
		);
	}

	if (!session.ok) {
		if (session.reason === "noSession") return <Navigate to="/login" replace />;
		return (
			<main className="flex flex-col items-center gap-6 px-4 py-24 text-center">
				<p role="alert" className="text-lg">
					{session.reason === "network" ? MESSAGES.networkError : MESSAGES.serverError}
				</p>
				<Button onClick={check}>Réessayer</Button>
			</main>
		);
	}

	// Connecté mais pas étudiant : l'espace étudiant ne lui est pas destiné
	if (session.user.role !== STUDENT_ROLE) return <Navigate to="/" replace />;

	return children(session.user);
}
