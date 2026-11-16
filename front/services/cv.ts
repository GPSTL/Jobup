// Calls to the student CV API (JOB-018). Contract: docs/api/resume.md
// <id> is the id of the account, given by RequireStudent.

export type Cv = {
	/** Name of the file, as saved by the backend, e.g. "CV_2026.pdf" */
	fileName: string;
	/** Date of the last import, ISO format */
	updatedAt: string;
};

export type CvError = "unauthenticated" | "server" | "network";

export type CvResult =
	// cv is null when the student has not imported a CV yet
	| { ok: true; cv: Cv | null }
	| { ok: false; reason: CvError }
	// File refused by the backend (format, size), with its message
	| { ok: false; reason: "invalid"; message: string };

// Body of both routes: both fields are null when there is no CV
type ApiCv = { file_name: string; updated_at: string } | { file_name: null; updated_at: null };

const toCv = (data: ApiCv): Cv | null => (data.file_name === null ? null : { fileName: data.file_name, updatedAt: data.updated_at });

// Read on every request: Django changes the token at each login
const csrfToken = () => document.cookie.match(/(?:^|; )csrftoken=([^;]*)/)?.[1] ?? "";

async function send(url: string, init: RequestInit = {}): Promise<CvResult> {
	let response: Response;
	try {
		response = await fetch(url, { ...init, credentials: "same-origin" });
	} catch {
		// Server unreachable or connection lost
		return { ok: false, reason: "network" };
	}

	// DRF answers 403 without a valid session or CSRF token. The page only asks for the
	// CV of the logged-in student, so it means that the session has expired.
	if (response.status === 401 || response.status === 403) return { ok: false, reason: "unauthenticated" };
	try {
		const data = await response.json();
		if (response.ok) return { ok: true, cv: toCv(data) };
		// File refused by the backend, with the message to display. A 400 without it is a bug.
		const message = data.errors?.resume;
		if (response.status === 400 && typeof message === "string") return { ok: false, reason: "invalid", message };
	} catch {
		// Not a JSON answer (e.g. the error page of a 500): the API is not available
	}
	return { ok: false, reason: "server" };
}

export function getCv(id: number): Promise<CvResult> {
	return send(`/api/student/${id}/resume`);
}

// Replaces the current CV. If the import fails, the backend keeps the previous one.
export function uploadCv(id: number, file: File): Promise<CvResult> {
	const body = new FormData();
	body.append("resume", file);
	return send(`/api/student/${id}/resume`, {
		method: "POST",
		// Without Content-Type: the browser adds it, with the boundary of the multipart body
		headers: { "X-CSRFToken": csrfToken() },
		body,
	});
}
