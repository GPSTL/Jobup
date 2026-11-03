import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import Button from "./Button";
import { OfferError, removeOffer, updateOffer, type Offer, type OfferChanges } from "../services/offers";

function Modal({ title, children, busy, onClose }: { title: string; children: ReactNode; busy: boolean; onClose: () => void }) {
	const dialog = useRef<HTMLDialogElement>(null);
	useEffect(() => { const node = dialog.current!; node.showModal(); return () => node.close(); }, []);
	return <dialog ref={dialog} aria-labelledby="offer-dialog-title" aria-busy={busy}
		onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
		className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-[25px] bg-white p-6 text-[#111827] shadow-xl backdrop:bg-black/40 sm:p-8">
		<h2 id="offer-dialog-title" className="mb-6 text-2xl font-semibold">{title}</h2>{children}
	</dialog>;
}

export function EditOfferDialog({ offer, onClose, onSaved }: { offer: Offer; onClose: () => void; onSaved: (offer: Offer) => void }) {
	const [values, setValues] = useState<OfferChanges>({ title: offer.title, description: offer.description,
		image_url: offer.image_url, requirements: offer.requirements, contract_type: offer.contract_type,
		duration: offer.duration, start_date: offer.start_date, company: offer.company, location: offer.location });
	const [busy, setBusy] = useState(false);
	const pending = useRef(false);
	const [error, setError] = useState<OfferError | null>(null);
	async function submit(event: FormEvent) {
		event.preventDefault();
		if (pending.current) return;
		pending.current = true; setBusy(true); setError(null);
		try { onSaved(await updateOffer(offer.id, values)); }
		catch (error) { setError(error as OfferError); }
		finally { pending.current = false; setBusy(false); }
	}
	const fields: { key: keyof OfferChanges; label: string; max?: number; type?: string; required?: boolean }[] = [
		{ key: "title", label: "Intitulé de l’offre", max: 128, required: true },
		{ key: "image_url", label: "Image (URL HTTP ou HTTPS)", type: "url", max: 200 },
		{ key: "contract_type", label: "Contrat" },
		{ key: "requirements", label: "Compétences", max: 256 },
		{ key: "duration", label: "Durée", max: 64 },
		{ key: "start_date", label: "Date de début", type: "date" },
		{ key: "description", label: "Description", max: 2048, required: true },
		{ key: "company", label: "Nom affiché de l’entreprise", max: 128 },
		{ key: "location", label: "Lieu", max: 128 },
	];
	return <Modal title="Modifier l’offre" busy={busy} onClose={onClose}>
		<form onSubmit={submit}>
			<fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
				{fields.map(({ key, label, max, type, required }) => {
					const props = { id: `offer-${key}`, name: key, value: values[key] || "", required, maxLength: max,
						"aria-invalid": !!error?.fields[key], "aria-describedby": error?.fields[key] ? `error-${key}` : undefined,
						onChange: (event: { target: { value: string } }) => setValues(current => ({ ...current, [key]: key === "start_date" ? event.target.value || null : event.target.value })),
						className: "mt-1 w-full rounded-xl border border-gray-300 bg-white p-3 focus:border-primary focus:outline-primary" };
					return <div key={key} className={key === "description" ? "sm:col-span-2" : ""}>
						<label htmlFor={props.id} className="text-sm font-medium">{label}{required ? " *" : ""}</label>
						{key === "description" ? <textarea {...props} rows={5} /> : key === "contract_type" ? <select {...props}>
							<option value="">Non précisé</option><option value="alternance">Alternance</option><option value="stage">Stage</option><option value="cdd">CDD</option><option value="cdi">CDI</option>
						</select> : <input {...props} type={type || "text"} />}
						{error?.fields[key] && <p id={`error-${key}`} className="text-sm text-red-700">{error.fields[key].join(" ")}</p>}
					</div>;
				})}
			</fieldset>
			<p className="mt-3 text-sm text-gray-500">Le nom affiché ne change pas l’entreprise propriétaire de l’offre.</p>
			{error && <p role="alert" className="mt-4 text-red-700">{error.message}</p>}
			<div className="mt-6 flex justify-end gap-3">
				<Button disabled={busy} onClick={onClose} className="bg-gray-200! text-gray-900!">Annuler</Button>
				<Button type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</Button>
			</div>
		</form>
	</Modal>;
}

export function DeleteOfferDialog({ offer, onClose, onDeleted }: { offer: Offer; onClose: () => void; onDeleted: () => void }) {
	const [busy, setBusy] = useState(false);
	const pending = useRef(false);
	const [error, setError] = useState("");
	async function confirm() {
		if (pending.current) return;
		pending.current = true; setBusy(true); setError("");
		try { await removeOffer(offer.id); onDeleted(); }
		catch (error) { setError((error as Error).message); }
		finally { pending.current = false; setBusy(false); }
	}
	return <Modal title="Supprimer l’offre ?" busy={busy} onClose={onClose}>
		<p>Voulez-vous supprimer l’offre « <strong>{offer.title}</strong> » de {offer.company} ?</p>
		<p className="mt-3 text-gray-600">Elle ne sera plus visible par les étudiants. Les candidatures existantes seront conservées.</p>
		{error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
		<div className="mt-6 flex justify-end gap-3">
			<Button disabled={busy} onClick={onClose} className="bg-gray-200! text-gray-900!">Annuler</Button>
			<Button disabled={busy} onClick={confirm} className="bg-red-700!">{busy ? "Suppression…" : "Supprimer"}</Button>
		</div>
	</Modal>;
}
