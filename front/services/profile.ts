// Calls to the student profile API (JOB-008). Contract: docs/api/profile.md
// <id> is the id of the account, given by RequireStudent.

export type Profile = {
	photoUrl: string | null;
	description: string;
	desiredPosition: string;
};

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
};

const toProfile = (data: ApiProfile): Profile => ({
	photoUrl: data.photo_url,
	description: data.description,
	desiredPosition: data.desired_position,
});

// Field of the API → field of Profile, for the validation errors
const ERROR_FIELDS: Record<string, keyof Profile> = {
	photo: "photoUrl",
	description: "description",
	desired_position: "desiredPosition",
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
		// JSON.stringify leaves out the undefined fields, so they are not changed
		body: JSON.stringify({ description: changes.description, desired_position: changes.desiredPosition }),
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
