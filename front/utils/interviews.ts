// Entretiens : affichage des créneaux, saisie des créneaux proposés par le recruteur (mêmes règles que
// jobup/interviews.py, chevauchements compris) et messages des erreurs de l'API.
// Les créneaux se saisissent et s'affichent à l'heure du navigateur.

import type { Interview, InterviewResult, InterviewSlot, InterviewState, Proposal, SlotUnavailable, UpcomingInterview } from "../services/interviews";
import { countLabel } from "./selection";
import { REQUEST_ERRORS } from "./validation";

export const MAX_SLOTS = 10;
const MIN_MINUTES = 15;
const MAX_MINUTES = 4 * 60;
const MAX_AHEAD_DAYS = 365;
const MINUTE = 60 * 1000;

type Period = { start: Date; end: Date };

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const dayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

type Timed = Pick<InterviewSlot, "starts_at" | "ends_at">;

// « Mardi 2 décembre 2026 »
export const slotDay = (slot: Timed) => capitalize(dayFormat.format(new Date(slot.starts_at)));

// « 14:00 – 15:00 »
export const slotHours = (slot: Timed) => `${timeFormat.format(new Date(slot.starts_at))} – ${timeFormat.format(new Date(slot.ends_at))}`;

// « Mar. 2 déc. · 14:00 – 15:00 »
export const slotLabel = (slot: Timed) => `${capitalize(shortDayFormat.format(new Date(slot.starts_at)))} · ${slotHours(slot)}`;

export const overlaps = (a: Period, b: Period) => a.start < b.end && b.start < a.end;

const periodOf = (slot: Timed): Period => ({ start: new Date(slot.starts_at), end: new Date(slot.ends_at) });

/** Ligne du formulaire : date AAAA-MM-JJ, heures HH:MM, comme les champs date et time */
export type SlotDraft = { date: string; start: string; end: string };

export const emptyDraft = (): SlotDraft => ({ date: "", start: "", end: "" });

// Dates d'une ligne complète, à l'heure du navigateur ; null tant qu'un champ manque
export function draftPeriod({ date, start, end }: SlotDraft): Period | null {
	if (!date || !start || !end) return null;
	const period = { start: new Date(`${date}T${start}`), end: new Date(`${date}T${end}`) };
	return Number.isNaN(period.start.getTime()) || Number.isNaN(period.end.getTime()) ? null : period;
}

// Erreur de chaque ligne, "" quand elle est valable. `upcoming` : les entretiens déjà confirmés du recruteur.
export function draftErrors(drafts: SlotDraft[], upcoming: UpcomingInterview[], now = new Date()): string[] {
	const periods = drafts.map(draftPeriod);
	return periods.map((period, index) => {
		if (period === null) return "Indiquez la date, l’heure de début et l’heure de fin.";
		const minutes = (period.end.getTime() - period.start.getTime()) / MINUTE;
		if (minutes <= 0) return "L’heure de fin doit suivre l’heure de début.";
		if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) return "Un créneau dure entre 15 minutes et 4 heures.";
		if (period.start <= now) return "Ce créneau est déjà passé.";
		if (period.start.getTime() > now.getTime() + MAX_AHEAD_DAYS * 24 * 60 * MINUTE) return "Choisissez une date dans l’année qui vient.";
		const twin = periods.findIndex((other, before) => before < index && other !== null && overlaps(period, other));
		if (twin >= 0) return `Ce créneau chevauche le créneau ${twin + 1}.`;
		const busy = upcoming.find((interview) => overlaps(period, periodOf(interview)));
		if (busy) return `Vous avez déjà un entretien avec ${busy.candidate} (${busy.offer}) : ${slotLabel(busy)}.`;
		return "";
	});
}

// Corps de la proposition envoyée à l'API, à partir de lignes valables
export function proposalFrom(drafts: SlotDraft[], location: string, message: string): Proposal {
	const slots = drafts.flatMap((draft) => {
		const period = draftPeriod(draft);
		return period ? [{ starts_at: period.start.toISOString(), ends_at: period.end.toISOString() }] : [];
	});
	return { slots, location: location.trim(), message: message.trim() };
}

const pad = (value: number) => String(value).padStart(2, "0");

// « Modifier les créneaux » : le formulaire repart des créneaux encore à venir de la proposition
export function draftsFrom(interview: Interview, now = new Date()): SlotDraft[] {
	const drafts = interview.slots
		.filter((slot) => new Date(slot.starts_at) > now)
		.map((slot) => {
			const start = new Date(slot.starts_at);
			const end = new Date(slot.ends_at);
			return {
				date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
				start: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
				end: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
			};
		});
	return drafts.length > 0 ? drafts : [emptyDraft()];
}

// Erreurs de l'API pour une proposition du recruteur (codes de jobup/interviews.py et recruiter_offers.py)
export const PROPOSAL_ERRORS: Record<string, string> = {
	"Invalid duration": "Un créneau dure entre 15 minutes et 4 heures.",
	"Slot in the past": "Ce créneau est déjà passé.",
	"Slot too far": "Choisissez une date dans l’année qui vient.",
	"Slots overlap": "Ce créneau chevauche un autre créneau proposé.",
	"Recruiter busy": "Vous avez déjà un entretien confirmé à cette heure.",
	"Application not in review": "Cette candidature a déjà reçu une décision : actualisez la page.",
	"Interview already confirmed": "Le candidat vient de choisir un créneau : actualisez la page.",
	"Interview not found": "Cet entretien a déjà été annulé : actualisez la page.",
};

// Erreurs de l'API pour le choix d'un créneau par l'étudiant
export const CHOICE_ERRORS: Record<string, string> = {
	"Slot taken": "Ce créneau vient d’être pris par un autre candidat. Choisissez-en un autre.",
	"Student busy": "Vous avez déjà un entretien confirmé à cette heure.",
	"Slot passed": "Ce créneau est déjà passé.",
	"Interview already confirmed": "Vous avez déjà choisi un créneau pour cet entretien.",
	"Application closed": "Le recruteur a déjà rendu sa décision.",
	"Interview not found": "Le recruteur a annulé cet entretien.",
	"Slot not found": "Ce créneau n’est plus proposé : actualisez la page.",
};

// Message d'une requête refusée : celui du code de l'API, sinon celui de l'échec de la requête
export function interviewError(result: Exclude<InterviewResult<unknown>, { ok: true }>, messages: Record<string, string>) {
	if (result.reason === "rejected" || result.reason === "notFound") return messages[result.error] ?? REQUEST_ERRORS.server;
	return REQUEST_ERRORS[result.reason];
}

// Pourquoi un créneau ne peut plus être choisi, vu par l'étudiant
export const UNAVAILABLE_FOR_STUDENT: Record<SlotUnavailable, string> = {
	passed: "Créneau passé",
	taken: "Déjà pris par un autre candidat",
	busy: "Vous avez un autre entretien à cette heure",
};

// Vu par le recruteur : « busy » ne lui est jamais envoyé
export const UNAVAILABLE_FOR_RECRUITER: Record<SlotUnavailable, string> = {
	passed: "Créneau passé",
	taken: "Pris par un autre entretien",
	busy: "Indisponible",
};

// Pastille de la liste des candidats d'une offre : entretien proposé, ou confirmé avec sa date
export function interviewChip(state: InterviewState) {
	if (state.confirmed_slot) return { label: `Entretien : ${slotLabel(state.confirmed_slot)}`, className: "bg-[#dcfce7] text-[#166534]" };
	return { label: "Entretien proposé", className: "bg-[#fef3c7] text-[#92400e]" };
}

// Ligne d'une carte de la colonne « Entretiens » de l'étudiant
export function interviewSummary(interview: Interview) {
	if (interview.confirmed_slot) return `Confirmé : ${slotLabel(interview.confirmed_slot)}`;
	if (interview.available_count === 0) return "Aucun créneau disponible pour le moment";
	return `${countLabel(interview.available_count, ["créneau proposé", "créneaux proposés"])} : choisissez le vôtre`;
}
