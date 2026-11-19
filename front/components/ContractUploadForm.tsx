import { useState } from "react";

import Button from "./Button";
import Field from "./Field";
import { depositContract, type ContractErrors } from "../services/school";
import { contractErrors } from "../utils/contracts";
import { REQUEST_ERRORS } from "../utils/validation";

type Props<T> = {
	applicationId: number;
	/** Remplacement d'un contrat déjà déposé : les dates actuelles sont proposées */
	current?: { start_date: string | null; end_date: string | null };
	onDeposited: (data: T) => void;
	onCancel?: () => void;
};

// Formulaire « Déposer le contrat » (JOB-045, REC-26) : le PDF et les dates de l'alternance
export default function ContractUploadForm<T>({ applicationId, current, onDeposited, onCancel }: Props<T>) {
	const [file, setFile] = useState<File | null>(null);
	const [start, setStart] = useState(current?.start_date ?? "");
	const [end, setEnd] = useState(current?.end_date ?? "");
	const [errors, setErrors] = useState<ContractErrors>({});
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const replacing = current !== undefined;

	const submit = async () => {
		if (saving) return;
		const found = contractErrors(file, start, end);
		setErrors(found);
		setError("");
		if (!file || Object.keys(found).length > 0) return;
		setSaving(true);
		const result = await depositContract<T>(applicationId, { file, start_date: start, end_date: end });
		setSaving(false);
		if (result.ok) {
			onDeposited(result.data);
			return;
		}
		setErrors(result.errors);
		if (Object.keys(result.errors).length > 0) return;
		if (result.reason === "conflict") setError("Le contrat ne peut pas être déposé : l’étudiant n’est rattaché à aucune école. Invitez-le à l’indiquer dans son espace.");
		else if (result.reason === "notFound") setError("Cette candidature n’est plus disponible. Actualisez la page.");
		else setError(REQUEST_ERRORS[result.reason === "unauthenticated" || result.reason === "network" ? result.reason : "server"]);
	};

	return (
		<form
			noValidate
			aria-label={replacing ? "Remplacer le contrat" : "Déposer le contrat"}
			aria-busy={saving}
			onSubmit={(event) => {
				event.preventDefault();
				void submit();
			}}
			className="flex flex-col gap-4 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4 sm:p-5"
		>
			<p className="text-sm text-[#6b7280]">
				{replacing ? "Le nouveau PDF remplace l’ancien : l’école devra le valider de nouveau." : "Le contrat est partagé avec l’étudiant et son école, qui le valide."} PDF de 10 Mo maximum.
			</p>
			<Field id={`contract-file-${applicationId}`} label="Contrat (PDF) *" error={errors.file}>
				<input type="file" accept="application/pdf,.pdf" disabled={saving} onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="py-2!" />
			</Field>
			<div className="grid gap-4 sm:grid-cols-2">
				<Field id={`contract-start-${applicationId}`} label="Date de début *" error={errors.start_date}>
					<input type="date" value={start} disabled={saving} onChange={(event) => setStart(event.target.value)} />
				</Field>
				<Field id={`contract-end-${applicationId}`} label="Date de fin *" error={errors.end_date}>
					<input type="date" value={end} min={start || undefined} disabled={saving} onChange={(event) => setEnd(event.target.value)} />
				</Field>
			</div>
			{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
			<div className="flex flex-wrap gap-3">
				<Button type="submit" disabled={saving}>{saving ? "Envoi…" : replacing ? "Remplacer le contrat" : "Déposer le contrat"}</Button>
				{onCancel && <Button variant="outline" onClick={onCancel} disabled={saving}>Annuler</Button>}
			</div>
		</form>
	);
}
