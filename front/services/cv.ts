// Calls to the student CV API (JOB-018).
// TODO JOB-018: the API does not exist yet, so these functions return simulated responses.
// Once it is ready, replace each function body with a fetch (see auth.ts) without changing the signatures.

// TODO JOB-018: align the field names with the API contract
export type Cv = {
	/** Name of the file chosen by the student, e.g. "CV_2026.pdf" */
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

// TODO JOB-018: remove the simulated data
let fakeCv: Cv | null = { fileName: "CV_2026.pdf", updatedAt: "2026-03-12T10:00:00Z" };

// Simulates the network delay so the loading state can be built
const delay = () => new Promise((resolve) => setTimeout(resolve, 500));

export async function getCv(): Promise<CvResult> {
	// TODO JOB-018: GET the CV API with credentials: "same-origin"; 401 -> "unauthenticated"
	await delay();
	return { ok: true, cv: fakeCv };
}

// Replaces the current CV. If the import fails, the previous one is kept.
export async function uploadCv(file: File): Promise<CvResult> {
	// TODO JOB-018: send the file as FormData (without a Content-Type header); 400 -> "invalid" with the backend message
	await delay();
	fakeCv = { fileName: file.name, updatedAt: new Date().toISOString() };
	return { ok: true, cv: fakeCv };
}
