import { useId, useState } from "react";

import Button from "./Button";
import CalendarIcon from "./CalendarIcon";
import { chooseInterviewSlot, type Interview, type SlotUnavailable } from "../services/interviews";
import { CHOICE_ERRORS, interviewError, slotDay, slotHours, UNAVAILABLE_FOR_STUDENT } from "../utils/interviews";

// Refus de l'API qui disent pourquoi le créneau n'est plus libre : il est grisé sans recharger la page
const REFUSED_SLOT: Record<string, SlotUnavailable> = { "Slot taken": "taken", "Student busy": "busy", "Slot passed": "passed" };

type InterviewDetailsProps = { interview: Interview };

// Lieu et message du recruteur, sous les créneaux
function InterviewDetails({ interview }: InterviewDetailsProps) {
	if (!interview.location && !interview.message) return null;
	return (
		<dl className="flex flex-col gap-2 text-sm">
			{interview.location && (
				<div>
					<dt className="font-semibold">Lieu</dt>
					<dd className="break-words text-[#6b7280]">{interview.location}</dd>
				</div>
			)}
			{interview.message && (
				<div>
					<dt className="font-semibold">Message du recruteur</dt>
					<dd className="whitespace-pre-line text-[#6b7280]">{interview.message}</dd>
				</div>
			)}
		</dl>
	);
}

type StudentInterviewViewProps = {
	interview: Interview;
	/** Candidature décidée : l'entretien confirmé reste affiché, sans choix possible */
	readOnly?: boolean;
	picked: number | null;
	onPick: (slotId: number) => void;
	onConfirm: () => void;
	saving: boolean;
	error: string;
};

// Créneaux proposés par le recruteur, à choisir ; puis le créneau retenu
export function StudentInterviewView({ interview, readOnly = false, picked, onPick, onConfirm, saving, error }: StudentInterviewViewProps) {
	const titleId = useId();
	const confirmed = interview.confirmed_slot;
	return (
		<section aria-labelledby={titleId} className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-[#eff6ff] p-4 sm:p-5">
			<div className="flex items-center gap-3">
				<span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-primary">
					<CalendarIcon width={20} height={20} />
				</span>
				<div className="min-w-0">
					<h2 id={titleId} className="text-lg font-semibold">Entretien</h2>
					<p className="text-sm text-[#6b7280]">
						{confirmed ? "Vous avez confirmé ce créneau auprès du recruteur." : "Le recruteur vous propose de le rencontrer : choisissez le créneau qui vous convient."}
					</p>
				</div>
			</div>

			{confirmed ? (
				<p role="status" className="flex flex-col rounded-xl bg-surface px-4 py-3">
					<span className="text-xs font-semibold text-[#15803d]">Entretien confirmé</span>
					<span className="text-base font-bold">{slotDay(confirmed)}</span>
					<span className="text-sm">{slotHours(confirmed)}</span>
				</p>
			) : readOnly ? null : (
				<form onSubmit={(event) => { event.preventDefault(); onConfirm(); }} className="flex flex-col gap-3">
					<fieldset className="flex flex-col gap-2">
						<legend className="mb-2 text-sm font-semibold">Créneaux proposés</legend>
						{interview.slots.map((slot) => {
							const reason = slot.unavailable;
							return (
								<label key={slot.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-surface px-4 py-3 ${reason ? "cursor-not-allowed border-[#e5e7eb] opacity-60" : picked === slot.id ? "cursor-pointer border-primary" : "cursor-pointer border-[#e5e7eb] hover:border-primary"}`}>
									<input type="radio" name={`interview-${interview.id}`} value={slot.id} checked={picked === slot.id} disabled={reason !== null || saving} onChange={() => onPick(slot.id)} className="size-4 accent-primary" />
									<span className="flex min-w-0 flex-1 flex-col">
										<span className="text-sm font-semibold">{slotDay(slot)}</span>
										<span className="text-sm text-[#6b7280]">{slotHours(slot)}</span>
									</span>
									{reason && <span className="text-xs font-medium text-[#6b7280]">{UNAVAILABLE_FOR_STUDENT[reason]}</span>}
								</label>
							);
						})}
					</fieldset>
					{interview.available_count === 0 && (
						<p className="text-sm text-[#6b7280]">Aucun de ces créneaux n’est encore libre : le recruteur peut vous en proposer d’autres, ou vous pouvez lui écrire.</p>
					)}
					{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
					<div>
						<Button type="submit" disabled={picked === null || saving}>{saving ? "Confirmation…" : "Confirmer ce créneau"}</Button>
					</div>
				</form>
			)}
			<InterviewDetails interview={interview} />
		</section>
	);
}

type StudentInterviewSectionProps = {
	applicationId: number;
	interview: Interview;
	readOnly?: boolean;
};

// Section « Entretien » du détail d'une candidature (vue étudiant)
export default function StudentInterviewSection({ applicationId, interview: initial, readOnly }: StudentInterviewSectionProps) {
	const [interview, setInterview] = useState<Interview | null>(initial);
	const [picked, setPicked] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	if (interview === null) {
		return <p role="status" className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4 text-sm text-[#6b7280]">Le recruteur a annulé cet entretien.</p>;
	}

	const confirm = async () => {
		if (picked === null || saving) return;
		setSaving(true);
		setError("");
		const result = await chooseInterviewSlot(applicationId, picked);
		setSaving(false);
		if (result.ok) {
			setInterview(result.data.interview ?? null);
			return;
		}
		if (result.reason === "notFound" && result.error === "Interview not found") {
			setInterview(null);
			return;
		}
		setError(interviewError(result, CHOICE_ERRORS));
		const reason = result.reason === "rejected" ? REFUSED_SLOT[result.error] : undefined;
		if (reason) {
			setInterview({
				...interview,
				slots: interview.slots.map((slot) => (slot.id === picked ? { ...slot, unavailable: reason } : slot)),
				available_count: Math.max(0, interview.available_count - 1),
			});
			setPicked(null);
		}
	};

	return <StudentInterviewView interview={interview} readOnly={readOnly} picked={picked} onPick={setPicked} onConfirm={confirm} saving={saving} error={error} />;
}
