import { test } from "node:test";
import assert from "node:assert/strict";
import { signupSchema, toSignupPayload } from "../front/utils/signup";
import { signup } from "../front/services/auth";

const valid = { prenom: " Élodie ", nom: "D'Angelo", email: " test@example.fr ", password: "Example123" };
test("schema and outgoing payload exclude the removed fields", () => {
	const parsed = signupSchema.parse({ ...valid, telephone: "0600000000", etablissement: "School", domaine: "IT" });
	assert.deepEqual(Object.keys(parsed).sort(), ["email", "nom", "password", "prenom"]);
	assert.deepEqual(toSignupPayload(parsed), { ...valid, prenom: "Élodie", email: "test@example.fr", role: "student" });
});
test("required values, invalid email, names and weak passwords return French errors", () => {
	for (const [field, value] of [["prenom", ""], ["nom", "123"], ["email", "bad"], ["password", "short"], ["password", "lowercase123"], ["password", "NoDigitsHere"]]) {
		const result = signupSchema.safeParse({ ...valid, [field]: value });
		assert.equal(result.success, false);
		if (!result.success) assert.equal(result.error.issues[0].path[0], field);
	}
});
test("signup sends CSRF and handles duplicate, server, malformed and network errors", async () => {
	const original = globalThis.fetch;
	try {
		for (const status of [201, 409, 500]) {
			let calls = 0;
			globalThis.fetch = async (url, init) => {
				if (++calls === 1) return Response.json({ csrfToken: "test-token" });
				assert.equal(url, "/api/signup");
				assert.equal((init?.headers as Record<string, string>)["X-CSRFToken"], "test-token");
				assert.deepEqual(JSON.parse(init?.body as string), toSignupPayload(valid));
				return Response.json({ errors: { email: "Cette adresse e-mail est déjà utilisée." } }, { status });
			};
			const result = await signup(toSignupPayload(valid));
			assert.equal(result.ok, status === 201);
			if (!result.ok) assert.equal(result.reason, status === 409 ? "validation" : "server");
		}
		globalThis.fetch = async () => new Response("not-json");
		assert.deepEqual(await signup(toSignupPayload(valid)), { ok: false, reason: "server" });
		globalThis.fetch = async () => { throw new TypeError("offline"); };
		assert.deepEqual(await signup(toSignupPayload(valid)), { ok: false, reason: "network" });
	} finally { globalThis.fetch = original; }
});

test("login validates email and required password without imposing signup strength rules", async () => {
	const { loginSchema } = await import("../front/utils/login");
	assert.equal(loginSchema.safeParse({ email: " test@example.fr ", password: "old" }).success, true);
	for (const data of [{ email: "invalid", password: "old" }, { email: "test@example.fr", password: "" }]) {
		assert.equal(loginSchema.safeParse(data).success, false);
	}
});
