// Calls to the student profile API (JOB-008, complete profile JOB-071). Contract: docs/api/profile.md
// <id> is the id of the account, given by RequireStudent.

export type Profile = {
	photoUrl: string | null;
	description: string;
	desiredPosition: string;
	/** Program followed, e.g. "Master MIAGE"; "" when not filled in */
	education: string;
	/** StudyDegree of jobup/models.py: 1 to 5 for Bac + 1 to Bac + 5 */
	studyDegree: number | null;
	/** JobCategory of jobup/models.py: the field of the search (SECTORS in utils/companies.ts) */
	category: number | null;
	/** Professional experience in months, internships and apprenticeships included */
	experienceLevel: number;
	skills: string[];
	/** Where the student looks for an apprenticeship, free text ("Lyon", "Île-de-France", "Télétravail") */
	region: string;
	/** "AAAA-MM-JJ" */
	availableFrom: string | null;
};

/** Fields changed by PATCH /api/student/<id>: the photo has its own route */
export type ProfileChanges = Partial<Omit<Profile, "photoUrl">>;

export type ProfileError = "unauthenticated" | "server" | "network";

export type ProfileResult =
	| { ok: true; profile: Profile }
	| { ok: false; reason: ProfileError }
	// Validation errors per field, e.g. { description: "Trop long" }
	| { ok: false; reason: "invalid"; fields: Partial<Record<keyof Profile, string>> };

// Body of the three routes (Student.to_dict()): only the fields of the contract are read
type ApiProfile = {
	photo_url: string | null;
	description: string;
	desired_position: string;
	// JOB-071: absent from a server older than this ticket
	education?: string;
	study_degree?: number | null;
	category?: number | null;
	experience_level?: number;
	skills?: string[];
	region?: string;
	available_from?: string | null;
};

const toProfile = (data: ApiProfile): Profile => ({
	photoUrl: data.photo_url,
	description: data.description,
	desiredPosition: data.desired_position,
	education: data.education ?? "",
	studyDegree: data.study_degree ?? null,
	category: data.category ?? null,
	experienceLevel: data.experience_level ?? 0,
	skills: Array.isArray(data.skills) ? data.skills : [],
	region: data.region ?? "",
	availableFrom: data.available_from ?? null,
});

// Field of Profile → field of the API
const API_FIELDS: Record<keyof ProfileChanges, string> = {
	description: "description",
	desiredPosition: "desired_position",
	education: "education",
	studyDegree: "study_degree",
	category: "category",
	experienceLevel: "experience_level",
	skills: "skills",
	region: "region",
	availableFrom: "available_from",
};

// Field of the API → field of Profile, for the validation errors
const ERROR_FIELDS: Record<string, keyof Profile> = {
	photo: "photoUrl",
	...Object.fromEntries(Object.entries(API_FIELDS).map(([field, name]) => [name, field as keyof Profile])),
};

function fieldErrors(errors: Record<string, string>) {
	const fields: Partial<Record<keyof Profile, string>> = {};
	for (const [name, message] of Object.entries(errors)) {
		const field = ERROR_FIELDS[name];
		if (field) fields[field] = message;
	}
	return fields;
}

// Read on every request: Django changes the token at each login
const csrfToken = () => document.cookie.match(/(?:^|; )csrftoken=([^;]*)/)?.[1] ?? "";

async function send(url: string, init: RequestInit = {}): Promise<ProfileResult> {
	let response: Response;
	try {
		response = await fetch(url, { ...init, credentials: "same-origin" });
	} catch {
		// Server unreachable or connection lost
		return { ok: false, reason: "network" };
	}

	// DRF answers 403 without a valid session or CSRF token. The page only asks for the
	// profile of the logged-in student, so it means that the session has expired.
	if (response.status === 401 || response.status === 403) return { ok: false, reason: "unauthenticated" };
	try {
		const data = await response.json();
		if (response.ok) return { ok: true, profile: toProfile(data) };
		// Values refused by the backend, with a message per field. A 400 without errors is a bug.
		if (response.status === 400 && data.errors) return { ok: false, reason: "invalid", fields: fieldErrors(data.errors) };
	} catch {
		// Not a JSON answer: the API is not available on this server
	}
	return { ok: false, reason: "server" };
}

export function getProfile(id: number): Promise<ProfileResult> {
	return send(`/api/student/${id}`);
}

// Only the fields sent are modified, the others are kept
export function updateProfile(id: number, changes: Partial<Omit<Profile, "photoUrl">>): Promise<ProfileResult> {
	return send(`/api/student/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken() },
		// Only the fields given: the undefined ones are left out and not changed, null clears a field
		body: JSON.stringify(
			Object.fromEntries(
				Object.entries(changes)
					.filter(([, value]) => value !== undefined)
					.map(([field, value]) => [API_FIELDS[field as keyof ProfileChanges], value]),
			),
		),
	});
}

export function updatePhoto(id: number, file: File): Promise<ProfileResult> {
	const body = new FormData();
	body.append("photo", file);
	return send(`/api/student/${id}/photo`, {
		method: "POST",
		// Without Content-Type: the browser adds it, with the boundary of the multipart body
		headers: { "X-CSRFToken": csrfToken() },
		body,
	});
}
