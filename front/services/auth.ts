// Calls to the authentication API (JOB-004).
// The backend opens a Django session (cookie) on success.

// Aligné sur User.to_dict() côté Django : le rôle est un entier (Role)
export type User = {
	id: number;
	name: string;
	first_name: string;
	role: number;
};

// Valeur de Role.STUDENT dans jobup/models.py
export const STUDENT_ROLE = 1;

export type LoginResult =
	| { ok: true; user: User }
	| { ok: false; reason: "invalidCredentials" | "server" | "network" };

export async function login(email: string, password: string): Promise<LoginResult> {
	let response: Response;
	try {
		response = await fetch("/api/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
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
