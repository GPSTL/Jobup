// Filtres de la page Candidats (JOB-036, REC-02) : critères gardés dans l'URL, pastilles et nombre de résultats.

import { FILTER_KEYS, type CandidateFilters, type FilterOptions } from "../services/candidates";

export const NO_FILTERS: CandidateFilters = { position: "", experience: "", skill: "", region: "" };

// Les critères vivent dans l'URL de la page : ils survivent au rechargement, aux flèches du navigateur
// et à la consultation d'un profil
export const filtersFromParams = (params: URLSearchParams) =>
	Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key)?.trim() ?? ""])) as CandidateFilters;

export const hasFilters = (filters: CandidateFilters) => FILTER_KEYS.some((key) => filters[key].trim() !== "");

// Nouvelle recherche : les critères remplacent les précédents et la première carte s'affiche
export function withFilters(params: URLSearchParams, filters: CandidateFilters) {
	const next = new URLSearchParams(params);
	next.delete("candidate");
	for (const key of FILTER_KEYS) {
		const value = filters[key].trim();
		if (value) next.set(key, value);
		else next.delete(key);
	}
	return next;
}

// Carte affichée, sans toucher aux critères
export function withCandidate(params: URLSearchParams, id: number) {
	const next = new URLSearchParams(params);
	next.set("candidate", String(id));
	return next;
}

// Sous le bouton « Rechercher les candidats », comme la maquette
export function matchCount(count: number) {
	if (count === 0) return "Aucun candidat ne correspond";
	return count === 1 ? "1 candidat correspond" : `${count} candidats correspondent`;
}

export type ActiveFilter = { key: keyof CandidateFilters; label: string };

// Pastilles de l'état « aucun résultat » : pour l'expérience, le libellé plutôt que la valeur envoyée à l'API
export const activeFilters = (filters: CandidateFilters, options: FilterOptions | null): ActiveFilter[] =>
	FILTER_KEYS.filter((key) => filters[key].trim() !== "").map((key) => ({
		key,
		label:
			key === "experience"
				? (options?.experiences.find((level) => level.value === filters.experience)?.label ?? filters.experience)
				: filters[key].trim(),
	}));

// « Retour aux candidats » depuis un profil : la même recherche, sur la carte de ce candidat
export function candidatesLink(search: string, id?: number) {
	const params = new URLSearchParams(search);
	if (id !== undefined) params.set("candidate", String(id));
	const query = params.toString();
	return query ? `/recruiter/candidates?${query}` : "/recruiter/candidates";
}
