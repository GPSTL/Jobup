// Filtres d'un export CSV (jobup/exports.py) : leurs valeurs deviennent la query string de l'API.

export type ExportOption = { value: string; label: string };

export type ExportField =
	/** Une valeur parmi les options ; la première (valeur "") est « Tous » */
	| { kind: "select"; key: string; label: string; options: ExportOption[] }
	/** Plusieurs valeurs, jointes par une virgule ; aucune cochée : pas de filtre */
	| { kind: "checkboxes"; key: string; label: string; options: ExportOption[] }
	/** Case isolée qui applique `value` au paramètre `key` quand elle est cochée */
	| { kind: "toggle"; key: string; label: string; value: string };

export type ExportValues = Record<string, string | string[] | boolean>;

// Valeurs de départ : celles de `defaults`, sinon « Tous », rien de coché, et les cases isolées cochées
export function initialValues(fields: ExportField[], defaults: ExportValues = {}): ExportValues {
	return Object.fromEntries(fields.map((field) => [field.key, defaults[field.key] ?? (field.kind === "select" ? "" : field.kind === "checkboxes" ? [] : true)]));
}

export function exportQuery(fields: ExportField[], values: ExportValues): string {
	const params = new URLSearchParams();
	for (const field of fields) {
		const value = values[field.key];
		if (field.kind === "toggle") {
			if (value === true) params.set(field.key, field.value);
		} else if (Array.isArray(value)) {
			if (value.length > 0) params.set(field.key, value.join(","));
		} else if (typeof value === "string" && value !== "") params.set(field.key, value);
	}
	return params.toString();
}

// Statuts d'une candidature, tels que les filtres de l'API les nomment (STATUS_GROUPS dans jobup/exports.py)
export const APPLICATION_STATUS_OPTIONS: ExportOption[] = [
	{ value: "draft", label: "Brouillon" },
	{ value: "submitted", label: "Postulée" },
	{ value: "review", label: "En cours d’étude" },
	{ value: "accepted", label: "Acceptée" },
	{ value: "refused", label: "Refusée" },
];
