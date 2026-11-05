import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import ApplicationCard from "../front/components/ApplicationCard";
import { ApplicationDetailView } from "../front/pages/ApplicationDetailPage";
import { DraftEditor } from "../front/pages/ApplicationDraftPage";
import { getApplication, getApplications, saveDraft, submitApplication, type ApplicationDetail } from "../front/services/applications";
import {
	applicationSteps,
	byLastUpdate,
	cardDates,
	companyInitials,
	draftSchema,
	DRAFT_MESSAGES,
	sentDate,
	STATUS,
	statusChip,
	validateCoverLetter,
} from "../front/utils/applications";

const realFetch = globalThis.fetch;

const application: ApplicationDetail = {
	id: 7,
	offer: { id: 3, title: "Chef de projet digital" },
	company: "Nova Tech",
	status: STATUS.IN_REVIEW,
	status_label: "In review",
	submitted_at: "2026-10-08T12:00:00Z",
	updated_at: "2026-10-10T12:00:00Z",
	message: "Étudiant en Master MIAGE",
	documents: { resume: "/api/applications/7/documents/resume", cover_letter: null },
};
const draft: ApplicationDetail = {
	...application,
	id: 8,
	status: STATUS.DRAFT,
	submitted_at: null,
	documents: { resume: null, cover_letter: null },
};

type Call = { url: string; init?: RequestInit };

// Remplace fetch par une réponse simulée et garde la trace des appels
function mockFetch(respond: (url: string) => Response | Promise<Response>) {
	const calls: Call[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		return respond(url);
	}) as typeof fetch;
	return calls;
}

// Réponse du jeton CSRF puis de l'enregistrement du brouillon
const draftResponse = (response: () => Response) => (url: string) =>
	url === "/api/csrf" ? Response.json({ csrfToken: "jeton" }) : response();

const render = (element: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);

afterEach(() => {
	globalThis.fetch = realFetch;
});

test("statuts : les six valeurs du backend affichent les libellés de la maquette", () => {
	const labels = Object.values(STATUS).map((status) => statusChip(status).label);
	assert.deepEqual(labels, ["Brouillon", "Postulée", "En cours d’étude", "En cours d’étude", "Acceptée", "Refusée"]);
});

test("tri : la candidature la plus récemment modifiée en premier, même avec des formats ISO différents", () => {
	const sorted = byLastUpdate([
		{ updated_at: "2026-10-08T12:00:00Z" },
		{ updated_at: "2026-10-15T12:00:00.500000Z" },
		{ updated_at: "2026-10-15T12:00:00Z" },
	]);
	assert.deepEqual(sorted.map((a) => a.updated_at), ["2026-10-15T12:00:00.500000Z", "2026-10-15T12:00:00Z", "2026-10-08T12:00:00Z"]);
});

test("dates d'une carte selon le statut", () => {
	assert.equal(cardDates(draft), "Enregistrée le 10 oct. 2026");
	assert.equal(cardDates({ ...application, status: STATUS.SUBMITTED }), "Envoyée le 08 oct. 2026");
	assert.equal(cardDates(application), "Envoyée le 08 oct. 2026");
	assert.equal(cardDates({ ...application, status: STATUS.ACCEPTED }), "Envoyée le 08 oct. 2026 • Réponse le 10 oct. 2026");
	assert.equal(sentDate(draft), "");
});

test("initiales de l'entreprise", () => {
	assert.equal(companyInitials("Nova Tech"), "NT");
	assert.equal(companyInitials("thales"), "T");
	assert.equal(companyInitials("Cité de l'Énergie Durable"), "CD");
});

test("frise de suivi : étapes franchies et dates connues", () => {
	const steps = (status: number) => applicationSteps({ ...application, status }).map(({ done, detail }) => [done, detail]);
	assert.deepEqual(steps(STATUS.SUBMITTED), [[true, "08 oct."], [false, "En attente"], [false, "En attente"]]);
	for (const status of [STATUS.READ, STATUS.IN_REVIEW]) {
		assert.deepEqual(steps(status), [[true, "08 oct."], [true, "10 oct."], [false, "En attente"]]);
	}
	for (const status of [STATUS.ACCEPTED, STATUS.REFUSED]) {
		assert.deepEqual(steps(status), [[true, "08 oct."], [true, ""], [true, "10 oct."]]);
	}
});

test("liste : réponses de l'API", async () => {
	mockFetch(() => Response.json({ in_progress: [application], completed: [] }));
	assert.deepEqual(await getApplications(), { ok: true, inProgress: [application], completed: [] });

	for (const status of [401, 403]) {
		mockFetch(() => new Response(null, { status }));
		assert.deepEqual(await getApplications(), { ok: false, reason: "noSession" });
	}
	mockFetch(() => new Response(null, { status: 500 }));
	assert.deepEqual(await getApplications(), { ok: false, reason: "server" });
	mockFetch(() => new Response("<html>"));
	assert.deepEqual(await getApplications(), { ok: false, reason: "server" });
	mockFetch(() => Promise.reject(new TypeError("réseau")));
	assert.deepEqual(await getApplications(), { ok: false, reason: "network" });
});

test("détail : la candidature d'un autre étudiant est introuvable", async () => {
	const calls = mockFetch(() => new Response(null, { status: 404 }));
	assert.deepEqual(await getApplication(7), { ok: false, reason: "notFound" });
	assert.equal(calls[0].url, "/api/applications/7");

	mockFetch(() => Response.json(application));
	assert.deepEqual(await getApplication(7), { ok: true, application });
	mockFetch(() => new Response(null, { status: 403 }));
	assert.deepEqual(await getApplication(7), { ok: false, reason: "noSession" });
});

test("brouillon : envoi multipart avec jeton CSRF, sans appeler l'envoi final", async () => {
	const calls = mockFetch(draftResponse(() => Response.json(draft)));
	const letter = new File(["lettre"], "lettre.pdf");
	assert.deepEqual(await saveDraft(3, "Bonjour", letter), { ok: true, application: draft });

	assert.deepEqual(calls.map((call) => call.url), ["/api/csrf", "/api/applications/draft"]);
	const { init } = calls[1];
	assert.equal(init?.method, "PUT");
	assert.deepEqual(init?.headers, { "X-CSRFToken": "jeton" });
	const body = init?.body as FormData;
	assert.equal(body.get("offer"), "3");
	assert.equal(body.get("message"), "Bonjour");
	assert.equal((body.get("cover_letter") as File).name, "lettre.pdf");
});

test("brouillon : sans nouveau fichier, la lettre enregistrée n'est pas écrasée", async () => {
	const calls = mockFetch(draftResponse(() => Response.json(draft)));
	await saveDraft(3, "Bonjour");
	assert.equal((calls[1].init?.body as FormData).has("cover_letter"), false);
});

test("brouillon : erreurs de l'API", async () => {
	const cases = [[403, "noSession"], [409, "alreadySubmitted"], [400, "invalid"], [500, "server"]] as const;
	for (const [status, reason] of cases) {
		mockFetch(draftResponse(() => new Response(null, { status })));
		assert.deepEqual(await saveDraft(3, ""), { ok: false, reason });
	}
	mockFetch(() => Promise.reject(new TypeError("réseau")));
	assert.deepEqual(await saveDraft(3, ""), { ok: false, reason: "network" });
});

test("envoi : POST avec jeton CSRF sur la candidature", async () => {
	const sent = { ...draft, status: STATUS.SUBMITTED, submitted_at: "2026-11-05T12:00:00Z" };
	const calls = mockFetch(draftResponse(() => Response.json(sent)));
	assert.deepEqual(await submitApplication(8), { ok: true, application: sent });
	assert.deepEqual(calls.map((call) => call.url), ["/api/csrf", "/api/applications/8/submit"]);
	assert.equal(calls[1].init?.method, "POST");
	assert.deepEqual(calls[1].init?.headers, { "X-CSRFToken": "jeton" });
});

test("envoi : refus du backend", async () => {
	mockFetch(draftResponse(() => Response.json({ error: "A resume is required" }, { status: 400 })));
	assert.deepEqual(await submitApplication(8), { ok: false, reason: "noResume" });
	mockFetch(draftResponse(() => Response.json({ error: "Offer is no longer active" }, { status: 400 })));
	assert.deepEqual(await submitApplication(8), { ok: false, reason: "invalid" });

	const cases = [[403, "noSession"], [409, "alreadySubmitted"], [404, "server"], [500, "server"]] as const;
	for (const [status, reason] of cases) {
		mockFetch(draftResponse(() => new Response(null, { status })));
		assert.deepEqual(await submitApplication(8), { ok: false, reason });
	}
	mockFetch(() => Promise.reject(new TypeError("réseau")));
	assert.deepEqual(await submitApplication(8), { ok: false, reason: "network" });
});

test("brouillon : validation de la lettre et de la présentation", () => {
	assert.equal(validateCoverLetter(), "");
	assert.equal(validateCoverLetter(new File(["x"], "lettre.PDF")), "");
	assert.equal(validateCoverLetter(new File(["x"], "lettre.docx")), "");
	assert.equal(validateCoverLetter(new File(["x"], "lettre.exe")), DRAFT_MESSAGES.letterType);
	const tooBig = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "lettre.pdf");
	assert.equal(validateCoverLetter(tooBig), DRAFT_MESSAGES.letterSize);

	assert.equal(draftSchema.safeParse({ message: "x".repeat(1024) }).success, true);
	assert.equal(draftSchema.safeParse({ message: "x".repeat(1025) }).success, false);
	assert.equal(draftSchema.safeParse({ message: "", coverLetter: [new File(["x"], "virus.exe")] }).success, false);
});

test("carte : un brouillon se reprend, les autres candidatures ouvrent leur détail", () => {
	const draftCard = render(<ApplicationCard application={draft} />);
	assert.match(draftCard, /href="\/applications\/8\/edit"/);
	assert.match(draftCard, /aria-label="Reprendre : Chef de projet digital"/);
	assert.match(draftCard, /Brouillon/);
	assert.doesNotMatch(draftCard, /Voir le détail/);

	const sentCard = render(<ApplicationCard application={application} />);
	assert.match(sentCard, /href="\/applications\/7"/);
	assert.match(sentCard, /Nova Tech/);
	assert.match(sentCard, /Envoyée le 08 oct. 2026/);
	assert.match(sentCard, /En cours d’étude/);
	assert.doesNotMatch(sentCard, /Reprendre/);
});

test("détail : le CV envoyé est proposé, la lettre seulement si elle existe", () => {
	const withoutLetter = render(<ApplicationDetailView application={application} />);
	assert.match(withoutLetter, /href="\/api\/applications\/7\/documents\/resume"/);
	assert.doesNotMatch(withoutLetter, /Lettre de motivation/);
	assert.match(withoutLetter, /Étudiant en Master MIAGE/);

	const coverLetter = "/api/applications/7/documents/cover_letter";
	const withLetter = render(<ApplicationDetailView application={{ ...application, message: "", documents: { ...application.documents, cover_letter: coverLetter } }} />);
	assert.match(withLetter, /href="\/api\/applications\/7\/documents\/cover_letter"/);
	assert.doesNotMatch(withLetter, /Présentation envoyée/);
	assert.doesNotMatch(withLetter, /Candidature envoyée/);

	const justSent = render(<ApplicationDetailView application={application} submitted />);
	assert.match(justSent, /role="status"[^>]*>Candidature envoyée/);
});

test("reprise : les champs enregistrés sont repris, avec l'envoi et l'enregistrement seul", () => {
	// La présentation est remplie par react-hook-form après le montage : le parcours navigateur la vérifie
	const html = render(<DraftEditor application={{ ...draft, message: "Mon brouillon", documents: { resume: null, cover_letter: "/lettre" } }} />);
	assert.match(html, /href="\/lettre"/);
	assert.match(html, /Chef de projet digital chez Nova Tech/);
	assert.match(html, /CV de votre profil sera joint/);
	// « Confirmer » envoie le formulaire, « Enregistrer le brouillon » n'est qu'un bouton
	assert.match(html, /<button type="submit"[^>]*>Confirmer ma candidature<\/button>/);
	assert.match(html, /<button type="button"[^>]*>Enregistrer le brouillon<\/button>/);
});
