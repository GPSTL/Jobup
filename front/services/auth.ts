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
