// Display of the candidate cards and profiles (JOB-035, REC-01).

import type { CandidateSummary, Exchange } from "../services/candidates";

type Name = Pick<CandidateSummary, "first_name" | "last_name">;

export const fullName = ({ first_name, last_name }: Name) => `${first_name} ${last_name}`;

// "LM" for Lucas Martin
export const initials = ({ first_name, last_name }: Name) => `${first_name.charAt(0)}${last_name.charAt(0)}`.toUpperCase();

// Card given by ?candidate=<id>, or the first one when the id is missing or no longer in the list
export const cardIndex = (candidates: Pick<CandidateSummary, "id">[], id: string | null) =>
	Math.max(0, candidates.findIndex((candidate) => String(candidate.id) === id));

// "Bac + 4" for StudyDegree.MASTER1 (jobup/models.py)
export const degreeLabel = (degree: number) => `Bac + ${degree}`;

// "Disponible en novembre 2026", then "Disponible immédiatement" once that month has come.
// The date has no time: it is split rather than parsed, so the time zone cannot change the month.
export function availability(date: string, now = new Date()) {
	const [year, month] = date.split("-").map(Number);
	if (year * 12 + month <= now.getFullYear() * 12 + now.getMonth() + 1) return "Disponible immédiatement";
	return `Disponible en ${new Date(year, month - 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;
}

// "15 oct."
export const exchangeDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

// Line of the history, as in the mockup: "Candidature reçue — Développeur Java", "Vous : « Bonjour… »"
export function exchangeText(exchange: Exchange, candidate: Pick<CandidateSummary, "first_name">) {
	if (exchange.kind === "application") return `Candidature reçue — ${exchange.offer_title}`;
	return `${exchange.from_me ? "Vous" : candidate.first_name} : « ${exchange.body} »`;
}
