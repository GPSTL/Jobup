import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import ConfirmEmailPage from "../front/pages/ConfirmEmailPage";
import ResendConfirmation from "../front/components/ResendConfirmation";
import { confirmEmail, login, resendConfirmation, signup } from "../front/services/auth";
import { toSignupPayload } from "../front/utils/signup";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

// /api/csrf answers with a token, every other URL goes to respond
function mockFetch(respond: (url: string, init?: RequestInit) => Response | Promise<Response>) {
	const calls: { url: string; init?: RequestInit }[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		return url === "/api/csrf" ? Response.json({ csrfToken: "test-token" }) : respond(url, init);
	}) as typeof fetch;
	return calls;
}

test("signup flags a created account that still has to confirm its e-mail", async () => {
	const user = { id: 1, email: "a@example.fr", first_name: "A", last_name: "B", role: 1 };
	mockFetch(() => Response.json({ ...user, email_confirmation_required: true }, { status: 201 }));
	const payload = toSignupPayload({ first_name: "A", last_name: "B", email: "a@example.fr", password: "Example123" }, "Student");
	assert.deepEqual(await signup(payload), { ok: true, user: { ...user, email_confirmation_required: true }, emailConfirmationRequired: true });
});

test("login reports an unconfirmed address, and still tells suspension apart", async () => {
	mockFetch(() => Response.json({ error: "Email not confirmed" }, { status: 403 }));
	assert.deepEqual(await login("a@example.fr", "Example123"), { ok: false, reason: "emailNotConfirmed" });
	mockFetch(() => Response.json({ error: "Account suspended" }, { status: 403 }));
	assert.deepEqual(await login("a@example.fr", "Example123"), { ok: false, reason: "suspended" });
});

test("confirmEmail posts the token and maps every answer", async () => {
	const calls = mockFetch(() => Response.json({ confirmed: true }));
	assert.deepEqual(await confirmEmail("tok"), { ok: true });
	assert.equal(calls[1].url, "/api/signup/confirm");
	assert.equal((calls[1].init?.headers as Record<string, string>)["X-CSRFToken"], "test-token");
	assert.deepEqual(JSON.parse(calls[1].init?.body as string), { token: "tok" });

	const cases: [number, unknown, unknown][] = [
		[400, { error: "expired" }, { ok: false, reason: "expired" }],
		[400, { error: "invalid" }, { ok: false, reason: "invalid" }],
		[500, {}, { ok: false, reason: "server" }],
	];
	for (const [status, body, expected] of cases) {
		mockFetch(() => Response.json(body, { status }));
		assert.deepEqual(await confirmEmail("tok"), expected);
	}
	globalThis.fetch = (async () => { throw new TypeError("offline"); }) as typeof fetch;
	assert.deepEqual(await confirmEmail("tok"), { ok: false, reason: "network" });
	globalThis.fetch = (async () => new Response(null, { status: 500 })) as typeof fetch;
	assert.deepEqual(await confirmEmail("tok"), { ok: false, reason: "server" });
});

test("resendConfirmation posts the e-mail and maps every answer", async () => {
	const calls = mockFetch(() => Response.json({ sent: true }, { status: 202 }));
	assert.deepEqual(await resendConfirmation("a@example.fr"), { ok: true });
	assert.equal(calls[1].url, "/api/signup/resend-confirmation");
	assert.deepEqual(JSON.parse(calls[1].init?.body as string), { email: "a@example.fr" });

	const cases: [number, unknown][] = [
		[429, { ok: false, reason: "tooManyRequests" }],
		[404, { ok: false, reason: "disabled" }],
		[500, { ok: false, reason: "server" }],
	];
	for (const [status, expected] of cases) {
		mockFetch(() => new Response(null, { status }));
		assert.deepEqual(await resendConfirmation("a@example.fr"), expected);
	}
	globalThis.fetch = (async () => { throw new TypeError("offline"); }) as typeof fetch;
	assert.deepEqual(await resendConfirmation("a@example.fr"), { ok: false, reason: "network" });
	globalThis.fetch = (async () => new Response(null, { status: 500 })) as typeof fetch;
	assert.deepEqual(await resendConfirmation("a@example.fr"), { ok: false, reason: "server" });
});

test("the confirmation page without a token shows the invalid-link message", () => {
	const html = renderToStaticMarkup(<MemoryRouter initialEntries={["/confirm-email"]}><ConfirmEmailPage /></MemoryRouter>);
	assert.match(html, /Ce lien de confirmation n’est pas valide/);
	assert.match(html, /href="\/login"/);
});

test("the confirmation page with a token starts by waiting for the server", () => {
	const html = renderToStaticMarkup(<MemoryRouter initialEntries={["/confirm-email?token=abc"]}><ConfirmEmailPage /></MemoryRouter>);
	assert.match(html, /Confirmation de votre adresse e-mail…/);
});

test("the resend button is rendered", () => {
	assert.match(renderToStaticMarkup(<ResendConfirmation email="a@example.fr" />), /Renvoyer l’e-mail de confirmation/);
});
