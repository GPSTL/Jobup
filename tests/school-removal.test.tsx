// Retrait d'un étudiant par l'école (JOB-049, ECO-15)
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import { RemoveStudent } from "../front/pages/SchoolStudentPage";
import { removeSchoolStudent } from "../front/services/school";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

const render = (props: { removing?: boolean; error?: string } = {}) =>
	renderToStaticMarkup(
		<MemoryRouter>
			<RemoveStudent name="Lucas Martin" onRemove={() => {}} removing={props.removing ?? false} error={props.error ?? ""} />
		</MemoryRouter>,
	);

test("fiche de l'étudiant : bouton de retrait, confirmé avant l'envoi", () => {
	const html = render();
	assert.match(html, />Retirer de l’école<\/button>/);
	// La confirmation n'apparaît qu'après le clic : rien n'est envoyé directement
	assert.doesNotMatch(html, /Confirmer le retrait/);
	assert.match(render({ error: "Échec" }), /role="alert"[^>]*>Échec/);
});

// Remplace fetch : /api/csrf renvoie un jeton, le retrait la réponse donnée
function mockFetch(respond: () => Response) {
	const calls: { url: string; init?: RequestInit }[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		if (url === "/api/csrf") return Response.json({ csrfToken: "token" });
		return respond();
	}) as typeof fetch;
	return calls;
}

test("API : DELETE avec le jeton CSRF, 204 sans contenu", async () => {
	const calls = mockFetch(() => new Response(null, { status: 204 }));
	assert.deepEqual(await removeSchoolStudent(7), { ok: true, data: undefined });
	assert.deepEqual(
		calls.map(({ url }) => url),
		["/api/csrf", "/api/school/students/7"],
	);
	assert.equal(calls[1].init?.method, "DELETE");
	assert.equal((calls[1].init?.headers as Record<string, string>)["X-CSRFToken"], "token");
});

test("API : étudiant déjà retiré ou d'une autre école, session expirée", async () => {
	mockFetch(() => Response.json({ error: "Student not found" }, { status: 404 }));
	assert.deepEqual(await removeSchoolStudent(7), { ok: false, reason: "notFound" });
	mockFetch(() => Response.json({ detail: "Forbidden" }, { status: 403 }));
	assert.deepEqual(await removeSchoolStudent(7), { ok: false, reason: "unauthenticated" });
});
