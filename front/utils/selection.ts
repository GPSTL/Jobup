// Sélection case par case des éléments d'une liste, pour l'export CSV : elle s'ajoute aux
// filtres de l'export (paramètre `ids`, ou `offer` pour les offres du recruteur).

// Même limite que l'export de l'API (MAX_IDS dans jobup/exports.py)
export const MAX_SELECTION = 500;

// Coche ou décoche `ids` ; jamais plus que ce que l'export accepte
export function toggleIds(selected: number[], ids: number[], checked: boolean): number[] {
	if (!checked) return selected.filter((id) => !ids.includes(id));
	return [...selected, ...ids.filter((id) => !selected.includes(id))].slice(0, MAX_SELECTION);
}

// « 1 candidature », « 3 candidatures »
export const countLabel = (count: number, [singular, plural]: [string, string]) => `${count} ${count > 1 ? plural : singular}`;
