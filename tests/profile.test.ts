import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { getProfile, updatePhoto, updateProfile } from "../front/services/profile";

const realFetch = globalThis.fetch;
// Corps renvoyé par l'API (Student.to_dict()), avec des champs hors contrat
const apiProfile = {
	uid: 7,
	photo_url: "/media/photos/3f2b8c1e.png",
	description: "Étudiante en M2 informatique.",
	desired_position: "Développeuse web",
	category: 99,
};
const profile = {
	photoUrl: "/media/photos/3f2b8c1e.png",
	description: "Étudiante en M2 informatique.",
	desiredPosition: "Développeuse web",
};

// Remplace fetch par une réponse simulée et garde la trace de la requête envoyée
function mockFetch(respond: () => Response | Promise<Response>) {
	const calls: { url: string; init?: RequestInit }[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		return respond();
	}) as typeof fetch;
	return calls;
}

beforeEach(() => {
	// Cookie posé par Django à la connexion, lu pour l'en-tête X-CSRFToken
	Object.defineProperty(globalThis, "document", { value: { cookie: "theme=clair; csrftoken=jeton123" }, configurable: true });
});

afterEach(() => {
	globalThis.fetch = realFetch;
});

test("lecture : GET /api/student/<id> avec le cookie de session, champs renommés pour le front", async () => {
	const calls = mockFetch(() => Response.json(apiProfile));
	assert.deepEqual(await getProfile(7), { ok: true, profile });
	assert.equal(calls[0].url, "/api/student/7");
	assert.equal(calls[0].init?.method, undefined);
	assert.equal(calls[0].init?.credentials, "same-origin");
});

test("modification : PATCH avec le jeton CSRF, seuls les champs modifiés sont envoyés", async () => {
	const calls = mockFetch(() => Response.json(apiProfile));
	assert.deepEqual(await updateProfile(7, { desiredPosition: "Data analyst" }), { ok: true, profile });
	assert.equal(calls[0].url, "/api/student/7");
	assert.equal(calls[0].init?.method, "PATCH");
	assert.equal(calls[0].init?.credentials, "same-origin");
	assert.deepEqual(calls[0].init?.headers, { "Content-Type": "application/json", "X-CSRFToken": "jeton123" });
	assert.deepEqual(JSON.parse(calls[0].init?.body as string), { desired_position: "Data analyst" });
});

test("photo : POST multipart sans Content-Type, avec le jeton CSRF", async () => {
	const calls = mockFetch(() => Response.json(apiProfile));
	const file = new File(["png"], "photo.png", { type: "image/png" });
	assert.deepEqual(await updatePhoto(7, file), { ok: true, profile });
	assert.equal(calls[0].url, "/api/student/7/photo");
	assert.equal(calls[0].init?.method, "POST");
	assert.deepEqual(calls[0].init?.headers, { "X-CSRFToken": "jeton123" });
	const body = calls[0].init?.body as FormData;
	assert.equal((body.get("photo") as File).name, "photo.png");
});

test("valeurs refusées : 400 avec errors donne invalid, avec les messages par champ du front", async () => {
	mockFetch(() =>
		Response.json({ errors: { desired_position: "Le poste recherché ne doit pas dépasser 100 caractères." } }, { status: 400 }),
	);
	assert.deepEqual(await updateProfile(7, { desiredPosition: "x".repeat(101) }), {
		ok: false,
		reason: "invalid",
		fields: { desiredPosition: "Le poste recherché ne doit pas dépasser 100 caractères." },
	});
	mockFetch(() => Response.json({ errors: { photo: "La photo ne doit pas dépasser 25 mégapixels." } }, { status: 400 }));
	assert.deepEqual(await updatePhoto(7, new File(["png"], "photo.png")), {
		ok: false,
		reason: "invalid",
		fields: { photoUrl: "La photo ne doit pas dépasser 25 mégapixels." },
	});
});

test("session expirée : 403 ou 401 donne unauthenticated", async () => {
	mockFetch(() => Response.json({ detail: "Authentication credentials were not provided." }, { status: 403 }));
	assert.deepEqual(await getProfile(7), { ok: false, reason: "unauthenticated" });
	mockFetch(() => Response.json({}, { status: 401 }));
	assert.deepEqual(await updateProfile(7, { description: "Bonjour" }), { ok: false, reason: "unauthenticated" });
});

test("erreur serveur : 500, 404, 400 sans errors ou réponse non JSON donnent server", async () => {
	mockFetch(() => new Response("oops", { status: 500 }));
	assert.deepEqual(await getProfile(7), { ok: false, reason: "server" });
	mockFetch(() => Response.json({ error: "Student not found" }, { status: 404 }));
	assert.deepEqual(await getProfile(7), { ok: false, reason: "server" });
	mockFetch(() => Response.json({ error: "Invalid payload" }, { status: 400 }));
	assert.deepEqual(await updateProfile(7, { description: "Bonjour" }), { ok: false, reason: "server" });
	mockFetch(() => new Response("<!doctype html>", { status: 200 }));
	assert.deepEqual(await getProfile(7), { ok: false, reason: "server" });
});

test("erreur réseau : un fetch qui échoue donne network", async () => {
	mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
	assert.deepEqual(await getProfile(7), { ok: false, reason: "network" });
});
