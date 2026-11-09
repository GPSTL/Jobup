import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { getCv, uploadCv } from "../front/services/cv";

const realFetch = globalThis.fetch;
// Corps renvoyé par les deux routes de l'API du CV (docs/api/resume.md)
const apiCv = { file_name: "CV_Camille_Martin.pdf", updated_at: "2026-11-08T09:42:17.204519Z" };
const cv = { fileName: "CV_Camille_Martin.pdf", updatedAt: "2026-11-08T09:42:17.204519Z" };

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

test("lecture : GET /api/student/<id>/resume avec le cookie de session, champs renommés pour le front", async () => {
	const calls = mockFetch(() => Response.json(apiCv));
	assert.deepEqual(await getCv(7), { ok: true, cv });
	assert.equal(calls[0].url, "/api/student/7/resume");
	assert.equal(calls[0].init?.method, undefined);
	assert.equal(calls[0].init?.credentials, "same-origin");
});

test("aucun CV : file_name à null donne cv à null", async () => {
	mockFetch(() => Response.json({ file_name: null, updated_at: null }));
	assert.deepEqual(await getCv(7), { ok: true, cv: null });
});

test("import : POST multipart du fichier dans le champ resume, sans Content-Type, avec le jeton CSRF", async () => {
	const calls = mockFetch(() => Response.json(apiCv));
	const file = new File(["%PDF-1.4"], "Mon CV (2026).pdf", { type: "application/pdf" });
	// Le front garde le nom renvoyé par l'API, pas celui du fichier choisi
	assert.deepEqual(await uploadCv(7, file), { ok: true, cv });
	assert.equal(calls[0].url, "/api/student/7/resume");
	assert.equal(calls[0].init?.method, "POST");
	assert.equal(calls[0].init?.credentials, "same-origin");
	assert.deepEqual(calls[0].init?.headers, { "X-CSRFToken": "jeton123" });
	const body = calls[0].init?.body as FormData;
	assert.equal((body.get("resume") as File).name, "Mon CV (2026).pdf");
});

test("fichier refusé : 400 avec errors.resume donne invalid, avec le message de l'API", async () => {
	mockFetch(() => Response.json({ errors: { resume: "Le CV doit être au format PDF, DOCX ou DOC." } }, { status: 400 }));
	assert.deepEqual(await uploadCv(7, new File(["texte"], "cv.pdf")), {
		ok: false,
		reason: "invalid",
		message: "Le CV doit être au format PDF, DOCX ou DOC.",
	});
});

test("session expirée : 403 ou 401 donne unauthenticated", async () => {
	mockFetch(() => Response.json({ detail: "CSRF Failed: CSRF token missing." }, { status: 403 }));
	assert.deepEqual(await uploadCv(7, new File(["%PDF-1.4"], "cv.pdf")), { ok: false, reason: "unauthenticated" });
	mockFetch(() => Response.json({}, { status: 401 }));
	assert.deepEqual(await getCv(7), { ok: false, reason: "unauthenticated" });
});

test("erreur serveur : 500, 404, 400 sans errors.resume ou réponse non JSON donnent server", async () => {
	mockFetch(() => new Response("<!doctype html>", { status: 500 }));
	assert.deepEqual(await uploadCv(7, new File(["%PDF-1.4"], "cv.pdf")), { ok: false, reason: "server" });
	mockFetch(() => Response.json({ error: "Student not found" }, { status: 404 }));
	assert.deepEqual(await getCv(7), { ok: false, reason: "server" });
	mockFetch(() => Response.json({ errors: {} }, { status: 400 }));
	assert.deepEqual(await uploadCv(7, new File(["%PDF-1.4"], "cv.pdf")), { ok: false, reason: "server" });
	mockFetch(() => new Response("<!doctype html>", { status: 200 }));
	assert.deepEqual(await getCv(7), { ok: false, reason: "server" });
});

test("erreur réseau : un fetch qui échoue donne network", async () => {
	mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
	assert.deepEqual(await getCv(7), { ok: false, reason: "network" });
});
