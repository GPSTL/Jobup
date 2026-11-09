import { test } from "node:test";
import assert from "node:assert/strict";
import { signupSchema, toSignupPayload } from "../front/utils/signup";
import { signup } from "../front/services/auth";

const valid = { first_name: " Élodie ", last_name: "D'Angelo", email: " test@example.fr ", password: "Example123" };
// Données envoyées par le formulaire étudiant : le rôle vient du parcours, pas du formulaire (JOB-003)
const payload = toSignupPayload(valid, "Student");
test("schema and outgoing payload exclude the removed fields", () => {
	const parsed = signupSchema.parse({ ...valid, telephone: "0600000000", etablissement: "School", domaine: "IT" });
	assert.deepEqual(Object.keys(parsed).sort(), ["email", "first_name", "last_name", "password"]);
	assert.deepEqual(toSignupPayload(parsed, "Student"), { ...valid, first_name: "Élodie", email: "test@example.fr", role: "Student" });
	assert.equal(toSignupPayload(parsed, "School Manager").role, "School Manager");
});
test("required values, invalid email, names and weak passwords return errors", () => {
	for (const [field, value] of [["first_name", ""], ["last_name", "123"], ["email", "bad"], ["password", "short"], ["password", "lowercase123"], ["password", "NoDigitsHere"]]) {
		const result = signupSchema.safeParse({ ...valid, [field]: value });
		assert.equal(result.success, false);
		if (!result.success) assert.equal(result.error.issues[0].path[0], field);
	}
});
test("signup sends CSRF and handles success, duplicate, invalid, server, malformed and network errors", async () => {
	const original = globalThis.fetch;
	// Réponses réelles de l'API JOB-003 (erreurs à la racine, en listes) et ancien format { errors }
	const cases: [number, unknown, unknown][] = [
		// Succès : l'API renvoie le compte créé et ouvre la session
		[201, { id: 1, email: "test@example.fr", first_name: "Élodie", last_name: "D'Angelo", role: 1 }, { ok: true }],
		[400, { email: ["user with this email already exists."] }, { ok: false, reason: "validation", errors: { email: "Cette adresse e-mail est déjà utilisée." } }],
		[409, { errors: { email: "Cette adresse e-mail est déjà utilisée." } }, { ok: false, reason: "validation", errors: { email: "Cette adresse e-mail est déjà utilisée." } }],
		[400, { email: ["Enter a valid email address."], first_name: ["This field may not be blank."], last_name: ["Ensure this field has no more than 32 characters."] },
			{ ok: false, reason: "validation", errors: { email: "Adresse e-mail invalide (ex. : nom@exemple.fr).", first_name: "Ce champ est obligatoire.", last_name: "32 caractères maximum." } }],
		// Erreur sans champ du formulaire (rôle refusé) : message générique
		[400, { role: "This field is invalid." }, { ok: false, reason: "server" }],
		[500, { error: "oops" }, { ok: false, reason: "server" }],
	];
	try {
		for (const [status, body, expected] of cases) {
			let calls = 0;
			globalThis.fetch = async (url, init) => {
				if (++calls === 1) return Response.json({ csrfToken: "test-token" });
				assert.equal(url, "/api/signup");
				assert.equal((init?.headers as Record<string, string>)["X-CSRFToken"], "test-token");
				assert.deepEqual(JSON.parse(init?.body as string), payload);
				return Response.json(body, { status });
			};
			assert.deepEqual(await signup(payload), expected, `HTTP ${status} ${JSON.stringify(body)}`);
		}
		globalThis.fetch = async () => new Response("not-json");
		assert.deepEqual(await signup(payload), { ok: false, reason: "server" });
		globalThis.fetch = async () => { throw new TypeError("offline"); };
		assert.deepEqual(await signup(payload), { ok: false, reason: "network" });
	} finally { globalThis.fetch = original; }
});

test("login validates email and required password without imposing signup strength rules", async () => {
	const { loginSchema } = await import("../front/utils/login");
	assert.equal(loginSchema.safeParse({ email: " test@example.fr ", password: "old" }).success, true);
	for (const data of [{ email: "invalid", password: "old" }, { email: "test@example.fr", password: "" }]) {
		assert.equal(loginSchema.safeParse(data).success, false);
	}
});
