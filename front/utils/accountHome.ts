import { RECRUITER_ROLE, STUDENT_ROLE } from "../services/auth";

// Espace où arrive un compte juste après la connexion ou l'inscription, selon son rôle
export function accountHome(role: number, recruiterReturnTo?: unknown): string {
	if (role === STUDENT_ROLE) return "/student";
	if (role === RECRUITER_ROLE) {
		// Page recruteur demandée avant la connexion (RequireRecruiter) ; seulement un chemin de l'espace recruteur
		if (typeof recruiterReturnTo === "string" && recruiterReturnTo.startsWith("/recruiter/")) return recruiterReturnTo;
		return "/recruiter/candidates";
	}
	// Pas encore d'espace école ni administrateur
	return "/";
}
