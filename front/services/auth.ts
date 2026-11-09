// Calls to the authentication API (JOB-004).
// The backend opens a Django session (cookie) on success.

import { RoleApiName } from "../utils/roles"
import { MESSAGES } from "../utils/validation";

// Aligné sur User.to_dict() côté Django : le rôle est un entier (Role)
export type User = {
	id: number;
	last_name: string;
	first_name: string;
	role: number;
};

// Valeur de Role.STUDENT dans jobup/models.py
export const STUDENT_ROLE = 1;
export const RECRUITER_ROLE = 3;

export type LoginResult =
	| { ok: true; user: User }
	| { ok: false; reason: "invalidCredentials" | "server" | "network" };

// Django exige ce jeton pour un POST dès qu'une session est ouverte (ex. juste après l'inscription)
async function getCsrfToken(): Promise<string | null> {
	const response = await fetch("/api/csrf", { credentials: "same-origin" });
	if (!response.ok) return null;
	try {
		const { csrfToken } = await response.json();
		return typeof csrfToken === "string" ? csrfToken : null;
	} catch {
		return null;
	}
}

export async function login(email: string, password: string): Promise<LoginResult> {
	let response: Response;
	try {
		const csrfToken = await getCsrfToken();
		if (!csrfToken) return { ok: false, reason: "server" };
		response = await fetch("/api/login", {
			method: "POST",
			headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
			credentials: "same-origin",
			body: JSON.stringify({ email, password }),
		});
	} catch {
		// Server unreachable or connection lost
		return { ok: false, reason: "network" };
	}

	if (response.status === 401) return { ok: false, reason: "invalidCredentials" };
	if (!response.ok) return { ok: false, reason: "server" };

	try {
		return { ok: true, user: (await response.json()) as User };
	} catch {
		// Not a JSON answer: the API is not available on this server
		return { ok: false, reason: "server" };
	}
}

export type SessionResult =
	| { ok: true; user: User }
	| { ok: false; reason: "noSession" | "server" | "network" };

// Vérifie la session Django en cours : sert à protéger les pages connectées
// et à détecter une session expirée
export async function getSession(): Promise<SessionResult> {
	let response: Response;
	try {
		response = await fetch("/api/me", { credentials: "same-origin" });
	} catch {
		return { ok: false, reason: "network" };
	}

	// DRF répond 403 (ou 401) sans session valide
	if (response.status === 401 || response.status === 403) return { ok: false, reason: "noSession" };
	if (!response.ok) return { ok: false, reason: "server" };

	try {
		return { ok: true, user: (await response.json()) as User };
	} catch {
		return { ok: false, reason: "server" };
	}
}

export type SignupPayload = { first_name: string; last_name: string; email: string; password: string; role: RoleApiName };
type SignupResult =
	| { ok: true }
	| { ok: false; reason: "validation"; errors: Partial<Record<"first_name" | "last_name" | "email" | "password" | "role", string>> }
	| { ok: false; reason: "server" | "network" };

type SignupField = "first_name" | "last_name" | "email" | "password";
const SIGNUP_FIELDS: SignupField[] = ["first_name", "last_name", "email", "password"];
const REQUIRED: Record<SignupField, string> = {
	first_name: MESSAGES.prenomRequired,
	last_name: MESSAGES.nomRequired,
	email: MESSAGES.emailRequired,
	password: MESSAGES.passwordRequired,
};

// Messages anglais de l'API Django (JOB-003) traduits pour le formulaire ; un message inconnu est gardé tel quel
function translateSignupError(field: SignupField, message: string) {
	if (/already exists|déjà utilisée/i.test(message)) return MESSAGES.emailTaken;
	if (/may not be blank|is required/i.test(message)) return REQUIRED[field];
	if (field === "email" && /valid email/i.test(message)) return MESSAGES.emailInvalid;
	const max = message.match(/no more than (\d+) characters/i);
	if (max) return `${max[1]} caractères maximum.`;
	return message;
}

// JOB-003 renvoie les erreurs à la racine, en listes : { "email": ["user with this email already exists."] }.
// L'ancien format { "errors": { "email": "…" } } reste accepté.
function toSignupErrors(data: unknown): Partial<Record<SignupField, string>> {
	if (!data || typeof data !== "object") return {};
	const source = ("errors" in data && data.errors && typeof data.errors === "object" ? data.errors : data) as Record<string, unknown>;
	const errors: Partial<Record<SignupField, string>> = {};
	for (const field of SIGNUP_FIELDS) {
		const value = source[field];
		const message = Array.isArray(value) ? value[0] : value;
		if (typeof message === "string" && message) errors[field] = translateSignupError(field, message);
	}
	return errors;
}

export async function signup(payload: SignupPayload): Promise<SignupResult> {
	try {
		const csrf = await fetch("/api/csrf", { credentials: "same-origin" });
		if (!csrf.ok) return { ok: false, reason: "server" };
		const { csrfToken } = await csrf.json();
		const response = await fetch("/api/signup", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
			body: JSON.stringify(payload),
		});
		if (response.status === 201) return { ok: true };
		if (response.status === 400 || response.status === 409) {
			const errors = toSignupErrors(await response.json());
			// Sans erreur sur un champ du formulaire (ex. rôle refusé), message générique
			if (Object.keys(errors).length > 0) return { ok: false, reason: "validation", errors };
		}
		return { ok: false, reason: "server" };
	} catch (error) {
		return { ok: false, reason: error instanceof TypeError ? "network" : "server" };
	}
}
