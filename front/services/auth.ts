// Calls to the authentication API (JOB-004).
// The backend opens a Django session (cookie) on success.

export type User = {
	id: number;
	email: string;
	name: string;
	role: string;
};

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

export type SignupPayload = { prenom: string; nom: string; email: string; password: string; role: "student" };
type SignupResult =
	| { ok: true }
	| { ok: false; reason: "validation"; errors: Partial<Record<"prenom" | "nom" | "email" | "password", string>> }
	| { ok: false; reason: "server" | "network" };

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
			const data = await response.json();
			if (data.errors && typeof data.errors === "object") return { ok: false, reason: "validation", errors: data.errors };
		}
		return { ok: false, reason: "server" };
	} catch (error) {
		return { ok: false, reason: error instanceof TypeError ? "network" : "server" };
	}
}
