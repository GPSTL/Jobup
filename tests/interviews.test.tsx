import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import ApplicationCard from "../front/components/ApplicationCard";
import RecruiterInterviewSection, { InterviewProposalForm, nextDraft } from "../front/components/RecruiterInterviewSection";
import { StudentInterviewView } from "../front/components/StudentInterviewSection";
import { OfferApplicantsContent, plannedInterviews } from "../front/pages/OfferApplicantsPage";
import { cancelInterview, chooseInterviewSlot, proposeInterview, type Interview, type InterviewSlot, type UpcomingInterview } from "../front/services/interviews";
import type { OfferApplicant, RecruiterApplication } from "../front/services/recruiterOffers";
import { STATUS } from "../front/utils/applications";
import { draftErrors, draftsFrom, emptyDraft, interviewChip, interviewSummary, proposalFrom, slotLabel } from "../front/utils/interviews";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

// Décembre 2099 : toujours à venir. Dates construites à l'heure locale, comme les champs du formulaire.
const local = (day: number, hour: number, minute = 0, year = 2099) => new Date(year, 11, day, hour, minute).toISOString();
const slot = (id: number, day: number, hour: number, extra: Partial<InterviewSlot> = {}): InterviewSlot => ({
	id, starts_at: local(day, hour), ends_at: local(day, hour + 1), chosen: false, unavailable: null, ...extra,
});
const proposed: Interview = {
	id: 5, status: "proposed", location: "Visio : lien envoyé par message", message: "Prévoir 45 minutes.", created_at: local(1, 9),
	slots: [slot(1, 2, 14), slot(2, 3, 10, { unavailable: "taken" })], confirmed_slot: null, available_count: 1,
};
const confirmed: Interview = { ...proposed, status: "confirmed", confirmed_slot: { ...slot(1, 2, 14), chosen: true }, available_count: 0 };
const now = new Date(2099, 11, 1, 8, 0);
const busy: UpcomingInterview = { starts_at: local(2, 10), ends_at: local(2, 11), candidate: "Bob Ni", offer: "Data analyst", application_id: 3 };

const candidate = { id: 7, first_name: "Lucas", last_name: "Martin", school: null, education: null, description: "", photo_url: null, cv_url: null };
const recruiterApplication: RecruiterApplication = {
	id: 20,
	offer: { id: 12, title: "Développeur Java", description: "Alternance", created_at: "2026-10-01T09:00:00Z", is_active: true },
	candidate, status: STATUS.IN_REVIEW, submitted_at: "2026-10-10T09:00:00Z", message: "", decision_message: "", conversation_id: null, contract: null,
	interview: null, upcoming_interviews: [busy],
};
const renderSection = (application: RecruiterApplication) => renderToStaticMarkup(<RecruiterInterviewSection application={application} onChange={() => {}} />);

test("créneau : jour et heures en français, à l'heure du navigateur", () => {
	assert.equal(slotLabel({ starts_at: local(2, 14), ends_at: local(2, 15, 30) }), "Mer. 2 déc. · 14:00 – 15:30");
});

test("créneaux saisis : complets, d'une durée raisonnable, à venir", () => {
	const day = "2099-12-02";
	assert.deepEqual(draftErrors([emptyDraft(), { date: day, start: "10:00", end: "" }], [], now), [
		"Indiquez la date, l’heure de début et l’heure de fin.",
		"Indiquez la date, l’heure de début et l’heure de fin.",
	]);
	assert.deepEqual(draftErrors([
		{ date: day, start: "11:00", end: "10:00" },
		{ date: day, start: "12:00", end: "12:10" },
		{ date: day, start: "13:00", end: "18:00" },
		{ date: "2099-11-30", start: "10:00", end: "11:00" },
		{ date: "2101-01-10", start: "10:00", end: "11:00" },
	], [], now), [
		"L’heure de fin doit suivre l’heure de début.",
		"Un créneau dure entre 15 minutes et 4 heures.",
		"Un créneau dure entre 15 minutes et 4 heures.",
		"Ce créneau est déjà passé.",
		"Choisissez une date dans l’année qui vient.",
	]);
});

test("créneaux saisis : jamais deux en même temps, ni sur un entretien déjà confirmé", () => {
	const day = "2099-12-02";
	assert.deepEqual(draftErrors([
		{ date: day, start: "14:00", end: "15:00" },
		{ date: day, start: "14:30", end: "15:00" },
		// Touche la fin des deux premiers sans les chevaucher
		{ date: day, start: "15:00", end: "16:00" },
	], [], now), ["", "Ce créneau chevauche le créneau 1.", ""]);
	const [error] = draftErrors([{ date: day, start: "10:30", end: "11:30" }], [busy], now);
	assert.match(error, /Vous avez déjà un entretien avec Bob Ni \(Data analyst\)/);
	assert.deepEqual(draftErrors([{ date: day, start: "11:00", end: "12:00" }], [busy], now), [""]);
});

test("proposition : dates ISO des créneaux, textes sans espaces superflus", () => {
	const proposal = proposalFrom([{ date: "2099-12-02", start: "14:00", end: "15:00" }, emptyDraft()], "  Paris 8e ", " Bonjour ");
	assert.deepEqual(proposal, { slots: [{ starts_at: local(2, 14), ends_at: local(2, 15) }], location: "Paris 8e", message: "Bonjour" });
});

test("modifier une proposition : le formulaire repart des créneaux encore à venir", () => {
	assert.deepEqual(draftsFrom(proposed, now), [
		{ date: "2099-12-02", start: "14:00", end: "15:00" },
		{ date: "2099-12-03", start: "10:00", end: "11:00" },
	]);
	assert.deepEqual(draftsFrom(proposed, new Date(2100, 0, 1)), [emptyDraft()]);
});

test("ajouter un créneau : juste après le précédent, de la même durée", () => {
	assert.deepEqual(nextDraft({ date: "2099-12-02", start: "10:00", end: "10:45" }), { date: "2099-12-02", start: "10:45", end: "11:30" });
	assert.deepEqual(nextDraft({ date: "2099-12-02", start: "22:00", end: "23:30" }), { date: "2099-12-02", start: "", end: "" });
	assert.deepEqual(nextDraft(emptyDraft()), emptyDraft());
	assert.deepEqual(nextDraft(undefined), emptyDraft());
});

test("résumés : pastille du recruteur, ligne de la carte étudiant", () => {
	assert.equal(interviewChip({ status: "proposed", slot_count: 2, confirmed_slot: null }).label, "Entretien proposé");
	assert.equal(interviewChip({ status: "confirmed", slot_count: 2, confirmed_slot: confirmed.confirmed_slot }).label, "Entretien : Mer. 2 déc. · 14:00 – 15:00");
	assert.equal(interviewSummary(proposed), "1 créneau proposé : choisissez le vôtre");
	assert.equal(interviewSummary({ ...proposed, available_count: 3 }), "3 créneaux proposés : choisissez le vôtre");
	assert.equal(interviewSummary({ ...proposed, available_count: 0 }), "Aucun créneau disponible pour le moment");
	assert.equal(interviewSummary(confirmed), "Confirmé : Mer. 2 déc. · 14:00 – 15:00");
});

test("étudiant : choix d'un créneau parmi ceux encore libres", () => {
	const html = renderToStaticMarkup(<StudentInterviewView interview={proposed} picked={null} onPick={() => {}} onConfirm={() => {}} saving={false} error="" />);
	assert.match(html, /Créneaux proposés/);
	assert.match(html, /Mercredi 2 décembre 2099/);
	assert.equal(html.match(/type="radio"/g)?.length, 2);
	// Le créneau pris par un autre candidat est grisé, avec sa raison
	assert.match(html, /disabled=""[^>]*value="2"|value="2"[^>]*disabled=""/);
	assert.match(html, /Déjà pris par un autre candidat/);
	assert.match(html, /<button[^>]*disabled=""[^>]*>Confirmer ce créneau/);
	assert.match(html, /Visio : lien envoyé par message/);
	assert.match(html, /Prévoir 45 minutes\./);
	const none = renderToStaticMarkup(<StudentInterviewView interview={{ ...proposed, available_count: 0 }} picked={null} onPick={() => {}} onConfirm={() => {}} saving={false} error="Erreur" />);
	assert.match(none, /le recruteur peut vous en proposer d’autres/);
	assert.match(none, /role="alert"[^>]*>Erreur/);
});

test("étudiant : le créneau confirmé, sans autre choix", () => {
	const html = renderToStaticMarkup(<StudentInterviewView interview={confirmed} picked={null} onPick={() => {}} onConfirm={() => {}} saving={false} error="" />);
	assert.match(html, /Entretien confirmé/);
	assert.match(html, /Mercredi 2 décembre 2099/);
	assert.match(html, /14:00 – 15:00/);
	assert.doesNotMatch(html, /type="radio"|Confirmer ce créneau/);
});

test("recruteur : proposer un entretien pendant l'étude de la candidature", () => {
	const html = renderSection(recruiterApplication);
	assert.match(html, />Proposer un entretien</);
	assert.match(html, /avant de rendre votre décision/);
	// Décidée sans entretien : rien à proposer
	assert.equal(renderSection({ ...recruiterApplication, status: STATUS.REFUSED }), "");
});

test("recruteur : proposition en attente, créneaux pris signalés, modifiable et annulable", () => {
	const html = renderSection({ ...recruiterApplication, interview: proposed });
	assert.match(html, /en attente du choix du candidat/);
	assert.match(html, /Pris par un autre entretien/);
	assert.match(html, />Modifier les créneaux</);
	assert.match(html, />Annuler l’entretien</);
	const full = renderSection({ ...recruiterApplication, interview: { ...proposed, available_count: 0 } });
	assert.match(full, /Plus aucun créneau n’est libre pour le candidat/);
});

test("recruteur : entretien confirmé, rappelé après la décision", () => {
	const html = renderSection({ ...recruiterApplication, interview: confirmed });
	assert.match(html, /Le candidat a choisi son créneau/);
	assert.match(html, /Entretien confirmé/);
	assert.doesNotMatch(html, /Modifier les créneaux/);
	const decided = renderSection({ ...recruiterApplication, status: STATUS.ACCEPTED, interview: confirmed });
	assert.match(decided, /Entretien confirmé/);
	assert.doesNotMatch(decided, /Annuler l’entretien/);
});

test("formulaire de proposition : entretiens déjà confirmés rappelés, créneaux à modifier repris", () => {
	const html = renderToStaticMarkup(<InterviewProposalForm applicationId={20} current={null} upcoming={[busy]} onSaved={() => {}} onCancel={() => {}} />);
	assert.match(html, /Vos prochains entretiens confirmés/);
	assert.match(html, /Bob Ni \(Data analyst\)/);
	assert.match(html, /type="date"/);
	assert.match(html, /\+ Ajouter un créneau/);
	assert.match(html, /maxLength="200"/);
	const editing = renderToStaticMarkup(<InterviewProposalForm applicationId={20} current={proposed} upcoming={[]} onSaved={() => {}} onCancel={() => {}} />);
	assert.match(editing, /Modifier les créneaux proposés/);
	assert.match(editing, /value="2099-12-02"/);
	assert.match(editing, /Retirer<span class="sr-only"> le créneau 2/);
	assert.match(editing, /value="Visio : lien envoyé par message"/);
});

test("carte étudiant de la colonne « Entretiens » : créneaux à choisir", () => {
	const summary = { id: 7, offer: { id: 3, title: "Chef de projet digital" }, company: "Nova Tech", status: STATUS.IN_REVIEW, status_label: "In review", submitted_at: "2026-10-08T12:00:00Z", updated_at: "2026-10-10T12:00:00Z" };
	const html = renderToStaticMarkup(<MemoryRouter><ApplicationCard application={summary} interview={proposed} selection={{ ids: [7], onChange: () => {} }} /></MemoryRouter>);
	assert.match(html, /aria-label="Choisir un créneau : Chef de projet digital"/);
	assert.match(html, /1 créneau proposé : choisissez le vôtre/);
	assert.match(html, /aria-label="Sélectionner la candidature Chef de projet digital pour l’export"[^>]*checked=""|checked=""[^>]*aria-label="Sélectionner la candidature Chef de projet digital pour l’export"/);
	const done = renderToStaticMarkup(<MemoryRouter><ApplicationCard application={summary} interview={confirmed} /></MemoryRouter>);
	assert.match(done, /aria-label="Voir l’entretien : Chef de projet digital"/);
	assert.doesNotMatch(done, /type="checkbox"/);
});

test("candidats d'une offre : entretiens prévus, pastilles et sélection pour l'export", () => {
	const applicants: OfferApplicant[] = [
		{ id: 1, candidate, status: STATUS.IN_REVIEW, submitted_at: "2026-10-10T09:00:00Z", interview: { status: "confirmed", slot_count: 2, confirmed_slot: confirmed.confirmed_slot } },
		{ id: 2, candidate: { ...candidate, id: 8, first_name: "Inès" }, status: STATUS.IN_REVIEW, submitted_at: "2026-10-11T09:00:00Z", interview: { status: "proposed", slot_count: 1, confirmed_slot: null } },
		{ id: 3, candidate: { ...candidate, id: 9, first_name: "Bob" }, status: STATUS.SUBMITTED, submitted_at: "2026-10-12T09:00:00Z", interview: null },
	];
	const html = renderToStaticMarkup(<MemoryRouter><OfferApplicantsContent data={{ offer: recruiterApplication.offer, applications: applicants }} /></MemoryRouter>);
	assert.match(html, /Entretiens prévus \(1\)/);
	assert.match(html, /Mer\. 2 déc\. · 14:00 – 15:00<\/time><\/span><span[^>]*>Lucas Martin/);
	assert.match(html, /Entretien : Mer\. 2 déc\. · 14:00 – 15:00/);
	assert.match(html, /Entretien proposé/);
	assert.match(html, /aria-label="Tout sélectionner pour l’export"/);
	assert.match(html, /aria-label="Sélectionner la candidature de Bob Martin pour l’export"/);
	// Un entretien terminé n'est plus « prévu »
	assert.deepEqual(plannedInterviews(applicants, new Date(2100, 0, 1)), []);
	assert.deepEqual(plannedInterviews(applicants, now).map(({ id }) => id), [1]);
});

function mockApi(answer: Response | Error, calls: { url: string; init?: RequestInit }[]) {
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		if (url === "/api/csrf") return Response.json({ csrfToken: "token" });
		if (answer instanceof Error) throw answer;
		return answer.clone();
	}) as typeof fetch;
}

test("API : proposer, annuler et choisir un créneau", async () => {
	const calls: { url: string; init?: RequestInit }[] = [];
	mockApi(Response.json({ ...recruiterApplication, interview: proposed }, { status: 201 }), calls);
	const proposal = { slots: [{ starts_at: local(2, 14), ends_at: local(2, 15) }], location: "", message: "" };
	const result = await proposeInterview(20, proposal);
	assert.equal(result.ok && result.data.interview?.id, 5);
	assert.equal(calls[1].url, "/api/recruiter/applications/20/interview");
	assert.equal(calls[1].init?.method, "POST");
	assert.deepEqual(JSON.parse(String(calls[1].init?.body)), proposal);
	assert.deepEqual(calls[1].init?.headers, { "X-CSRFToken": "token", "Content-Type": "application/json" });

	await cancelInterview(20);
	assert.equal(calls[3].init?.method, "DELETE");
	assert.deepEqual(calls[3].init?.headers, { "X-CSRFToken": "token" });

	await chooseInterviewSlot(7, 2);
	assert.equal(calls[5].url, "/api/applications/7/interview");
	assert.deepEqual(JSON.parse(String(calls[5].init?.body)), { slot: 2 });
});

test("API : refus avec le code et le créneau en cause, échecs de la requête", async () => {
	mockApi(Response.json({ error: "Recruiter busy", slot: 1 }, { status: 409 }), []);
	assert.deepEqual(await proposeInterview(20, { slots: [], location: "", message: "" }), { ok: false, reason: "rejected", error: "Recruiter busy", slot: 1 });
	mockApi(Response.json({ error: "Slot taken" }, { status: 409 }), []);
	assert.deepEqual(await chooseInterviewSlot(7, 2), { ok: false, reason: "rejected", error: "Slot taken", slot: null });
	mockApi(Response.json({ error: "Interview not found" }, { status: 404 }), []);
	assert.deepEqual(await cancelInterview(20), { ok: false, reason: "notFound", error: "Interview not found", slot: null });
	mockApi(new Response(null, { status: 403 }), []);
	const forbidden = await cancelInterview(20);
	assert.equal(!forbidden.ok && forbidden.reason, "unauthenticated");
	mockApi(new Response(null, { status: 500 }), []);
	const broken = await cancelInterview(20);
	assert.equal(!broken.ok && broken.reason, "server");
	mockApi(new TypeError("offline"), []);
	const offline = await chooseInterviewSlot(7, 2);
	assert.equal(!offline.ok && offline.reason, "network");
});
