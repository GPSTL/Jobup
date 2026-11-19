import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import ContractCard from "../front/components/ContractCard";
import SchoolNavbar from "../front/components/SchoolNavbar";
import { RecruiterApplicationContent } from "../front/pages/RecruiterApplicationPage";
import { ApplicationDetailView } from "../front/pages/ApplicationDetailPage";
import { advanceContract, cancelSchoolRequest, createSchool, requestSchool, type ContractProgress, type SchoolContract } from "../front/services/school";
import type { ApplicationDetail } from "../front/services/applications";
import type { RecruiterApplication } from "../front/services/recruiterOffers";
import { STATUS } from "../front/utils/applications";
import { ROLE_NOTIFICATIONS } from "../front/utils/notifications";
import { CONTRACT_STAGE, contractSteps } from "../front/utils/school";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const progress = (stage: number): ContractProgress => ({
	id: 5,
	stage,
	deposited_at: "2026-10-12T09:00:00Z",
	validated_at: stage >= CONTRACT_STAGE.VALIDATED ? "2026-10-14T09:00:00Z" : null,
	signed_at: stage >= CONTRACT_STAGE.SIGNED ? "2026-10-20T09:00:00Z" : null,
	start_date: null,
	end_date: null,
	file_name: null,
	file_url: null,
});
const contract = (stage: number): SchoolContract => ({
	...progress(stage),
	student: { id: 7, first_name: "Lucas", last_name: "Martin", photo_url: null },
	company: "Thales",
	offer_title: "Développeur Java",
	application_id: 20,
});
const renderCard = (value: SchoolContract, props: { showStudent?: boolean; error?: string } = {}) =>
	renderToStaticMarkup(<MemoryRouter><ul><ContractCard contract={value} onAdvance={() => {}} saving={false} error={props.error ?? ""} showStudent={props.showStudent} /></ul></MemoryRouter>);

test("frise du contrat : seule la candidature acceptée est franchie tant que rien n'est déposé", () => {
	const steps = contractSteps(null, "2026-10-10T12:00:00Z");
	assert.deepEqual(steps.map(({ label, done }) => [label, done]), [
		["Candidature acceptée", true],
		["Contrat déposé", false],
		["Validé par l’école", false],
		["Signé", false],
	]);
	assert.deepEqual(steps.slice(1).map(({ detail }) => detail), ["En attente", "En attente", "En attente"]);
});

test("frise du contrat : chaque étape franchie garde sa date", () => {
	const validated = contractSteps(progress(CONTRACT_STAGE.VALIDATED));
	assert.deepEqual(validated.map(({ done }) => done), [true, true, true, false]);
	assert.notEqual(validated[2].detail, "En attente");
	assert.equal(validated[3].detail, "En attente");
	assert.ok(contractSteps(progress(CONTRACT_STAGE.SIGNED)).every(({ done }) => done));
});

test("carte de contrat : l'école valide puis marque signé, sans action une fois signé", () => {
	assert.match(renderCard(contract(CONTRACT_STAGE.DEPOSITED)), />Valider le contrat</);
	assert.match(renderCard(contract(CONTRACT_STAGE.VALIDATED)), />Marquer comme signé</);
	const signed = renderCard(contract(CONTRACT_STAGE.SIGNED));
	assert.doesNotMatch(signed, /<button/);
	assert.match(signed, /Signé/);
});

test("carte de contrat : étudiant et offre, ou l'offre seule sur la fiche de l'étudiant", () => {
	const html = renderCard(contract(CONTRACT_STAGE.DEPOSITED));
	assert.match(html, /href="\/school\/students\/7"/);
	assert.match(html, /Lucas Martin/);
	assert.match(html, /Développeur Java • Thales/);
	assert.doesNotMatch(renderCard(contract(CONTRACT_STAGE.DEPOSITED), { showStudent: false }), /href="\/school\/students\/7"/);
	assert.match(renderCard(contract(CONTRACT_STAGE.DEPOSITED), { error: "Échec" }), /role="alert"[^>]*>Échec/);
});

const accepted: ApplicationDetail = {
	id: 20,
	offer: { id: 12, title: "Développeur Java" },
	company: "Thales",
	status: STATUS.ACCEPTED,
	status_label: "Accepted",
	submitted_at: "2026-10-08T12:00:00Z",
	updated_at: "2026-10-10T12:00:00Z",
	message: "",
	decision_message: "",
	contract: null,
	school: "Université Paris Nanterre",
	documents: { resume: null, cover_letter: null },
};
const renderDetail = (application: ApplicationDetail) => renderToStaticMarkup(<MemoryRouter><ApplicationDetailView application={application} /></MemoryRouter>);

test("l'étudiant suit son contrat sur une candidature acceptée", () => {
	const waiting = renderDetail(accepted);
	assert.match(waiting, /Suivi du contrat/);
	assert.match(waiting, /Contrat déposé/);
	assert.match(waiting, /L’entreprise doit déposer le contrat ; Université Paris Nanterre le validera ensuite/);
	const validated = renderDetail({ ...accepted, contract: progress(CONTRACT_STAGE.VALIDATED) });
	assert.match(validated, /Validé par l’école/);
	assert.doesNotMatch(validated, /doit déposer le contrat/);
});

test("l'étudiant sans école est invité à l'indiquer, et une candidature non acceptée n'a pas de suivi de contrat", () => {
	assert.match(renderDetail({ ...accepted, school: null }), /href="\/student#school"/);
	assert.doesNotMatch(renderDetail({ ...accepted, status: STATUS.IN_REVIEW }), /Suivi du contrat/);
});

const application: RecruiterApplication = {
	id: 20,
	offer: { id: 12, title: "Développeur Java", description: "Alternance", created_at: "2026-10-01T09:00:00Z", is_active: true },
	candidate: { id: 7, first_name: "Lucas", last_name: "Martin", school: null, education: null, description: "", photo_url: null, cv_url: null },
	status: STATUS.ACCEPTED, submitted_at: "2026-10-10T09:00:00Z", message: "", decision_message: "", conversation_id: null, contract: null,
};
const renderRecruiter = (value: RecruiterApplication, error = "") => renderToStaticMarkup(
	<MemoryRouter><RecruiterApplicationContent application={value} saving={false} error={error} onDecision={() => {}} onContract={() => {}} /></MemoryRouter>,
);

test("le recruteur dépose le contrat d'une candidature acceptée, puis le suit", () => {
	assert.match(renderRecruiter(application), />Déposer le contrat</);
	const deposited = renderRecruiter({ ...application, contract: progress(CONTRACT_STAGE.DEPOSITED) });
	assert.match(deposited, /Contrat déposé le/);
	assert.doesNotMatch(deposited, />Déposer le contrat</);
	assert.doesNotMatch(renderRecruiter({ ...application, status: STATUS.REFUSED }), />Déposer le contrat</);
});

type Call = { url: string; init?: RequestInit };
const mockFetch = (status: number, body: unknown) => {
	const calls: Call[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		if (url === "/api/csrf") return Response.json({ csrfToken: "token" });
		return Response.json(body, { status });
	}) as typeof fetch;
	return calls;
};

test("API école : une écriture envoie le jeton CSRF et son corps JSON", async () => {
	const calls = mockFetch(200, contract(CONTRACT_STAGE.VALIDATED));
	const result = await advanceContract(5, CONTRACT_STAGE.VALIDATED);
	assert.equal(result.ok, true);
	assert.deepEqual(calls.map(({ url }) => url), ["/api/csrf", "/api/school/contracts/5"]);
	assert.equal(calls[1].init?.method, "PATCH");
	assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { stage: 2 });
	assert.equal((calls[1].init?.headers as Record<string, string>)["X-CSRFToken"], "token");
});

test("API école : le nom d'établissement refusé remonte avec le message du serveur", async () => {
	mockFetch(409, { errors: { name: "Cet établissement est déjà rattaché à un compte école." } });
	assert.deepEqual(await createSchool("IUT"), { ok: false, reason: "conflict", message: "Cet établissement est déjà rattaché à un compte école." });
	mockFetch(400, { errors: { name: "Indiquez le nom" } });
	assert.deepEqual(await createSchool(" "), { ok: false, reason: "invalid", message: "Indiquez le nom" });
});

test("API : statuts HTTP traduits en raisons", async () => {
	for (const [status, reason] of [[401, "unauthenticated"], [403, "unauthenticated"], [404, "notFound"], [409, "conflict"], [500, "server"]] as const) {
		mockFetch(status, {});
		assert.equal((await advanceContract(5, 2) as { reason: string }).reason, reason, String(status));
	}
	globalThis.fetch = (async () => { throw new TypeError("offline"); }) as typeof fetch;
	assert.deepEqual(await advanceContract(5, 2), { ok: false, reason: "network" });
});

test("API étudiant : demande de rattachement et annulation", async () => {
	const state = { school: null, request: { school: { id: 3, name: "ISEG" }, status: "pending" }, schools: [] };
	let calls = mockFetch(201, state);
	assert.equal((await requestSchool(3)).ok, true);
	assert.equal(calls[1].url, "/api/student/school-request");
	assert.equal(calls[1].init?.method, "POST");
	assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { school_id: 3 });
	calls = mockFetch(200, { ...state, request: null });
	assert.equal((await cancelSchoolRequest()).ok, true);
	assert.equal(calls[1].init?.method, "DELETE");
	assert.equal(calls[1].init?.body, undefined);
});

test("notifications : l'école règle les demandes et contrats, l'étudiant le suivi du contrat", () => {
	assert.deepEqual(ROLE_NOTIFICATIONS.school.settings.map(({ key }) => key), ["school_updates", "messages", "email"]);
	assert.equal(ROLE_NOTIFICATIONS.school.page, "/school/notifications");
	assert.ok(ROLE_NOTIFICATIONS.student.settings.some(({ key }) => key === "school_updates"));
});

test("barre de l'école : seul l'onglet de la page courante est actif, le tableau de bord seulement sur sa page", () => {
	// Each link is in the bar and in the menu of the small screens
	const active = (path: string) => [...new Set([...renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><SchoolNavbar /></MemoryRouter>).matchAll(/<a [^>]*aria-current="page"[^>]*>([^<]+)</g)].map(([, label]) => label))];
	assert.deepEqual(active("/school"), ["Tableau de bord"]);
	assert.deepEqual(active("/school/students"), ["Étudiants"]);
	assert.deepEqual(active("/school/students/7"), ["Étudiants"]);
	assert.deepEqual(active("/school/contracts"), ["Contrats"]);
	assert.deepEqual(active("/school/messages/4"), ["Messages"]);
});
