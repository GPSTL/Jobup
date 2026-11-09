// Calls to the student profile API (JOB-008).
// TODO JOB-008: the API does not exist yet, so these functions return simulated responses.
// Once it is ready, replace each function body with a fetch (see auth.ts) without changing the signatures.

// TODO JOB-008: align the field names with the API contract
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

// TODO JOB-008: remove the simulated data
let fakeProfile: Profile = {
	photoUrl: null,
	description: "Étudiant en M2 informatique, à la recherche d’une alternance de 12 mois.",
	desiredPosition: "Développeur web",
};

// Simulates the network delay so the loading state can be built
const delay = () => new Promise((resolve) => setTimeout(resolve, 500));

export async function getProfile(): Promise<ProfileResult> {
	// TODO JOB-008: GET the profile API with credentials: "same-origin"; 401 -> "unauthenticated"
	await delay();
	return { ok: true, profile: fakeProfile };
}

// Only the fields sent are modified, the others are kept
export async function updateProfile(changes: Partial<Omit<Profile, "photoUrl">>): Promise<ProfileResult> {
	// TODO JOB-008: PATCH the profile API; 400 -> "invalid" with the per-field errors returned by the backend
	await delay();
	fakeProfile = { ...fakeProfile, ...changes };
	return { ok: true, profile: fakeProfile };
}

export async function updatePhoto(file: File): Promise<ProfileResult> {
	// TODO JOB-008: send the file as FormData (without a Content-Type header); confirm the maximum size
	await delay();
	if (file.type !== "image/jpeg" && file.type !== "image/png") {
		return { ok: false, reason: "invalid", fields: { photoUrl: "La photo doit être au format JPG ou PNG." } };
	}
	// Local URL of the file, only valid in this tab: the backend will return the real one
	fakeProfile = { ...fakeProfile, photoUrl: URL.createObjectURL(file) };
	return { ok: true, profile: fakeProfile };
}
