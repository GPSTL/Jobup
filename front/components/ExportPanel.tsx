import { useState } from "react";

import Button from "./Button";
import ChevronDownIcon from "./ChevronDownIcon";
import DownloadIcon from "./DownloadIcon";
import { downloadCsv } from "../services/exports";
import { exportQuery, initialValues, type ExportField, type ExportValues } from "../utils/exports";
import { focus, select } from "../utils/searchPageStyles";
import { REQUEST_ERRORS } from "../utils/validation";

const ERRORS = { ...REQUEST_ERRORS, invalid: "Ces filtres ne sont pas valides." };

type ExportPanelProps = {
	/** Route d'export de l'API, sans query string */
	url: string;
	fields: ExportField[];
	/** Paramètres fixes de l'export, ajoutés à ceux des filtres (ex. l'offre de la page) */
	params?: Record<string, string>;
	/** Valeurs de départ des filtres, lues à chaque ouverture du panneau */
	defaults?: ExportValues;
};

// Télécharge l'export de `url` avec ses filtres et ses paramètres fixes, et garde l'état de la demande
function useDownload({ url, fields, params = {} }: ExportPanelProps) {
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const download = async (values: ExportValues) => {
		setSaving(true);
		setError("");
		const query = new URLSearchParams({ ...params, ...Object.fromEntries(new URLSearchParams(exportQuery(fields, values))) }).toString();
		const result = await downloadCsv(query ? `${url}?${query}` : url);
		setSaving(false);
		if (!result.ok) setError(ERRORS[result.reason]);
	};
	return { saving, error, download };
}

const trigger = `inline-flex cursor-pointer items-center gap-2 rounded-xl bg-surface px-5 py-2.5 text-sm font-semibold text-ink inset-ring inset-ring-[#cfd4de] hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 ${focus}`;

export function ExportForm(props: ExportPanelProps) {
	const { fields, defaults } = props;
	const [values, setValues] = useState(() => initialValues(fields, defaults));
	const { saving, error, download } = useDownload(props);

	return (
		<form onSubmit={(event) => { event.preventDefault(); download(values); }} className="flex flex-col gap-4 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4 sm:p-5">
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{fields.map((field) => {
					const value = values[field.key];
					const set = (next: string | string[] | boolean) => setValues({ ...values, [field.key]: next });
					if (field.kind === "select") {
						return (
							<label key={field.key} className="flex flex-col gap-1.5 text-sm font-medium">
								{field.label}
								<span className="relative">
									<select value={String(value)} onChange={(event) => set(event.target.value)} className={select}>
										{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
									</select>
									<ChevronDownIcon width={20} height={20} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-gray-500" />
								</span>
							</label>
						);
					}
					if (field.kind === "toggle") {
						return (
							<label key={field.key} className="flex items-center gap-2.5 self-end pb-3 text-sm font-medium">
								<input type="checkbox" checked={value === true} onChange={(event) => set(event.target.checked)} className="size-4 cursor-pointer accent-primary" />
								{field.label}
							</label>
						);
					}
					const checked = Array.isArray(value) ? value : [];
					return (
						<fieldset key={field.key} className="flex min-w-0 flex-col gap-1.5">
							<legend className="text-sm font-medium">{field.label}</legend>
							<p className="text-xs text-[#6b7280]">Aucune case cochée : tout est exporté.</p>
							<div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
								{field.options.map((option) => (
									<label key={option.value} className="flex items-center gap-2.5 text-sm">
										<input
											type="checkbox"
											checked={checked.includes(option.value)}
											onChange={(event) => set(event.target.checked ? [...checked, option.value] : checked.filter((item) => item !== option.value))}
											className="size-4 shrink-0 cursor-pointer accent-primary"
										/>
										<span className="min-w-0 break-words">{option.label}</span>
									</label>
								))}
							</div>
						</fieldset>
					);
				})}
			</div>
			<div className="flex flex-wrap items-center gap-4">
				<Button type="submit" disabled={saving}>{saving ? "Préparation…" : "Télécharger le CSV"}</Button>
				{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
			</div>
		</form>
	);
}

// Bouton « Exporter » qui déplie les filtres de l'export, puis télécharge le CSV correspondant.
// Sans filtre à choisir, le bouton télécharge directement.
export default function ExportPanel(props: ExportPanelProps) {
	const [open, setOpen] = useState(false);
	const direct = useDownload(props);
	if (props.fields.length === 0) {
		return (
			<div className="flex flex-col items-start gap-2">
				<button type="button" disabled={direct.saving} onClick={() => direct.download({})} className={trigger}>
					<DownloadIcon width={18} height={18} aria-hidden="true" />
					{direct.saving ? "Préparation…" : "Exporter en CSV"}
				</button>
				{direct.error && <p role="alert" className="text-sm text-red-700">{direct.error}</p>}
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-3">
			<div>
				<button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={trigger}>
					<DownloadIcon width={18} height={18} aria-hidden="true" />
					Exporter en CSV
				</button>
			</div>
			{/* Monté à l'ouverture : les filtres repartent des valeurs courantes de la page */}
			{open && <ExportForm {...props} />}
		</div>
	);
}
