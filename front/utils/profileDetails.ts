// Profil complet de « Mon espace » (JOB-071) : valeurs des listes, affichage, complétude du profil,
// et suggestions tirées du CV comparées au profil.

import type { CvSuggestions } from "../services/cv";
import type { Profile, ProfileChanges } from "../services/profile";
import { degreeLabel } from "./candidates";
import { SECTOR_OPTIONS, sectorLabel } from "./companies";

// Les limites de l'API (jobup/profile.py)
export const PROFILE_LIMITS = {
	education: 100,
	region: 64,
	skill: 40,
	skills: 20,
	// Compétences enregistrées séparées par des virgules, dans 256 caractères
	skillsStored: 256,
	experience: 600,
} as const;

export const STUDY_DEGREE_OPTIONS = [1, 2, 3, 4, 5].map((value) => ({ value, label: degreeLabel(value) }));
// Les secteurs des entreprises (JobCategory) : le domaine de la recherche
export const CATEGORY_OPTIONS = SECTOR_OPTIONS;
// Proposées pour le champ « Région », qui reste libre : une ville convient aussi aux filtres des recruteurs
export const REGION_SUGGESTIONS = [
	"Île-de-France",
	"Auvergne-Rhône-Alpes",
	"Bourgogne-Franche-Comté",
	"Bretagne",
	"Centre-Val de Loire",
	"Corse",
	"Grand Est",
	"Hauts-de-France",
	"Normandie",
	"Nouvelle-Aquitaine",
	"Occitanie",
	"Pays de la Loire",
	"Provence-Alpes-Côte d’Azur",
	"Télétravail",
];

// « Aucune », « 8 mois », « 1 an », « 2 ans et 3 mois »
export function experienceLabel(months: number) {
	if (months <= 0) return "Aucune";
	const years = Math.floor(months / 12);
	const rest = months % 12;
	const parts = [years > 0 && `${years} an${years > 1 ? "s" : ""}`, rest > 0 && `${rest} mois`].filter(Boolean);
	return parts.join(" et ");
}

// « 1 septembre 2026 » ; la date n'a pas d'heure : découpée plutôt que lue, le fuseau ne change pas le jour
export function dayLabel(date: string) {
	const [year, month, day] = date.split("-").map(Number);
	return new Date(year, month - 1, day).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export const categoryLabel = (category: number | null) => sectorLabel(category);

const same = (a: string, b: string) => a.trim().localeCompare(b.trim(), "fr", { sensitivity: "base" }) === 0;

// Ajoute une compétence saisie : nettoyée, une seule fois, dans les limites de l'API. Message sinon.
export function addSkill(skills: string[], typed: string): { skills: string[]; error: string } {
	const skill = typed.split(/\s+/).filter(Boolean).join(" ");
	if (!skill) return { skills, error: "" };
	if (skill.includes(",")) return { skills, error: "Une compétence à la fois, sans virgule." };
	if (skill.length > PROFILE_LIMITS.skill) return { skills, error: `Une compétence fait ${PROFILE_LIMITS.skill} caractères au plus.` };
	if (skills.some((known) => same(known, skill))) return { skills, error: "" };
	if (skills.length >= PROFILE_LIMITS.skills) return { skills, error: `${PROFILE_LIMITS.skills} compétences au plus.` };
	if ([...skills, skill].join(", ").length > PROFILE_LIMITS.skillsStored) return { skills, error: "La liste des compétences est trop longue." };
	return { skills: [...skills, skill], error: "" };
}

// Les compétences ajoutées une à une, tant que la liste reste acceptée par l'API
export const withSkills = (skills: string[], added: string[]) => added.reduce((list, skill) => addSkill(list, skill).skills, skills);

// Éléments du profil comptés dans la complétude, dans l'ordre de la page
const PROFILE_ITEMS: { label: string; filled: (profile: Profile, hasCv: boolean) => boolean }[] = [
	{ label: "photo", filled: (profile) => profile.photoUrl !== null },
	{ label: "poste recherché", filled: (profile) => profile.desiredPosition !== "" },
	{ label: "présentation", filled: (profile) => profile.description !== "" },
	{ label: "formation", filled: (profile) => profile.education !== "" },
	{ label: "niveau d’études", filled: (profile) => profile.studyDegree !== null },
	{ label: "domaine", filled: (profile) => profile.category !== null },
	{ label: "compétences", filled: (profile) => profile.skills.length > 0 },
	{ label: "région", filled: (profile) => profile.region !== "" },
	{ label: "disponibilité", filled: (profile) => profile.availableFrom !== null },
	{ label: "CV", filled: (_, hasCv) => hasCv },
];

// Part du profil remplie, et ce qu'il manque
export function completion(profile: Profile, hasCv: boolean) {
	const missing = PROFILE_ITEMS.filter((item) => !item.filled(profile, hasCv)).map((item) => item.label);
	return { percent: Math.round((100 * (PROFILE_ITEMS.length - missing.length)) / PROFILE_ITEMS.length), missing };
}

export type SuggestionChoice = {
	/** Clé de la case à cocher */
	key: "desiredPosition" | "education" | "studyDegree" | "skills" | "region";
	label: string;
	/** Valeur trouvée dans le CV, telle qu'affichée */
	value: string;
	/** Valeur actuelle du profil, telle qu'affichée ; "" quand le champ est vide */
	current: string;
	/** Ce que la case enregistre */
	changes: ProfileChanges;
	/** Cochée d'avance : le champ est vide, ou la suggestion ne fait qu'ajouter (compétences) */
	checked: boolean;
};

// Les suggestions du CV qui changeraient le profil : une valeur identique n'est pas proposée.
// Les compétences s'ajoutent à celles du profil, elles n'en retirent aucune.
export function suggestionChoices(suggestions: CvSuggestions, profile: Profile): SuggestionChoice[] {
	const choices: SuggestionChoice[] = [];
	const text = (key: "desiredPosition" | "education" | "region", label: string, value: string | undefined) => {
		if (!value || same(value, profile[key])) return;
		choices.push({ key, label, value, current: profile[key], changes: { [key]: value }, checked: profile[key] === "" });
	};
	text("desiredPosition", "Poste recherché", suggestions.desiredPosition);
	text("education", "Formation", suggestions.education);
	if (suggestions.studyDegree && suggestions.studyDegree !== profile.studyDegree) {
		choices.push({
			key: "studyDegree",
			label: "Niveau d’études",
			value: degreeLabel(suggestions.studyDegree),
			current: profile.studyDegree === null ? "" : degreeLabel(profile.studyDegree),
			changes: { studyDegree: suggestions.studyDegree },
			checked: profile.studyDegree === null,
		});
	}
	const skills = withSkills(profile.skills, suggestions.skills ?? []);
	if (skills.length > profile.skills.length) {
		choices.push({
			key: "skills",
			label: "Compétences à ajouter",
			value: skills.slice(profile.skills.length).join(", "),
			current: profile.skills.join(", "),
			changes: { skills },
			checked: true,
		});
	}
	text("region", "Région", suggestions.region);
	return choices;
}

// Les changements des cases cochées, en une seule modification du profil
export const chosenChanges = (choices: SuggestionChoice[], checked: Set<SuggestionChoice["key"]>): ProfileChanges =>
	Object.assign({}, ...choices.filter((choice) => checked.has(choice.key)).map((choice) => choice.changes));
