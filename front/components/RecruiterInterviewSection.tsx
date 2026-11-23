import { useId, useState } from "react";

import Button from "./Button";
import CalendarIcon from "./CalendarIcon";
import { cancelInterview, proposeInterview, type Interview, type UpcomingInterview } from "../services/interviews";
import type { RecruiterApplication } from "../services/recruiterOffers";
import { formatDate, STATUS } from "../utils/applications";
import {
	draftErrors,
	draftsFrom,
	emptyDraft,
	interviewError,
	MAX_SLOTS,
	PROPOSAL_ERRORS,
	proposalFrom,
	slotDay,
	slotHours,
	slotLabel,
	UNAVAILABLE_FOR_RECRUITER,
	type SlotDraft,
} from "../utils/interviews";
import { focus } from "../utils/searchPageStyles";

const field = `w-full min-h-11 rounded-xl border border-[#d1d5db] bg-surface px-3 py-2 text-sm text-ink ${focus}`;
const label = "flex flex-col gap-1 text-xs font-semibold text-[#6b7280]";

const toMinutes = (time: string) => {
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
};
const toTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// « Ajouter un créneau » : le même jour, juste après le précédent et de la même durée, s'il tient dans la journée
export function nextDraft(previous: SlotDraft | undefined): SlotDraft {
	if (!previous?.date || !previous.start || !previous.end) return emptyDraft();
	const start = toMinutes(previous.end);
	const end = start + (toMinutes(previous.end) - toMinutes(previous.start));
	if (end <= start || end > 24 * 60 - 1) return { ...emptyDraft(), date: previous.date };
	return { date: previous.date, start: toTime(start), end: toTime(end) };
}

type ProposalFormProps = {
	applicationId: number;
	/** Proposition en attente à modifier ; sans elle, une première proposition */
	current: Interview | null;
	upcoming: UpcomingInterview[];
	onSaved: (application: RecruiterApplication) => void;
	onCancel: () => void;
};

// Un ou plusieurs créneaux, le lieu et un mot pour le candidat. Les créneaux sont vérifiés avant l'envoi :
// durée, date à venir, aucun chevauchement entre eux ni avec un entretien déjà confirmé.
export function InterviewProposalForm({ applicationId, current, upcoming, onSaved, onCancel }: ProposalFormProps) {
	const formId = useId();
	const [drafts, setDrafts] = useState<SlotDraft[]>(() => (current ? draftsFrom(current) : [emptyDraft()]));
	const [location, setLocation] = useState(current?.location ?? "");
	const [message, setMessage] = useState(current?.message ?? "");
	// Les erreurs des créneaux s'affichent après le premier envoi, puis suivent la saisie
	const [attempted, setAttempted] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<{ text: string; slot: number | null } | null>(null);
	const errors = draftErrors(drafts, upcoming);

	const update = (index: number, changes: Partial<SlotDraft>) => {
		setDrafts(drafts.map((draft, position) => (position === index ? { ...draft, ...changes } : draft)));
		setError(null);
	};

	const submit = async () => {
		setAttempted(true);
		if (saving || errors.some(Boolean)) return;
		setSaving(true);
		setError(null);
		const result = await proposeInterview(applicationId, proposalFrom(drafts, location, message));
		setSaving(false);
		if (result.ok) onSaved(result.data);
		else setError({ text: interviewError(result, PROPOSAL_ERRORS), slot: result.slot });
	};

	return (
		<form onSubmit={(event) => { event.preventDefault(); submit(); }} noValidate aria-labelledby={`${formId}-title`} className="flex flex-col gap-4 rounded-2xl border border-[#e5e7eb] bg-surface p-4 sm:p-5">
			<div>
				<h3 id={`${formId}-title`} className="text-base font-semibold">{current ? "Modifier les créneaux proposés" : "Proposer un entretien"}</h3>
				<p className="text-sm text-[#6b7280]">Proposez un ou plusieurs créneaux : le candidat choisira celui qui lui convient.</p>
			</div>

			{upcoming.length > 0 && (
				<div className="rounded-xl bg-[#f9fafb] px-4 py-3 text-sm">
					<p className="font-semibold">Vos prochains entretiens confirmés</p>
					<ul className="mt-1 flex flex-col gap-0.5 text-[#6b7280]">
						{upcoming.slice(0, 5).map((interview) => (
							<li key={`${interview.application_id}-${interview.starts_at}`}>{slotLabel(interview)} — {interview.candidate} ({interview.offer})</li>
						))}
					</ul>
				</div>
			)}

			<ol className="flex flex-col gap-3">
				{drafts.map((draft, index) => {
					const slotError = (attempted && errors[index]) || (error?.slot === index ? error.text : "");
					const errorId = `${formId}-slot-${index}-error`;
					return (
						<li key={index} className="flex flex-col gap-2 rounded-xl border border-[#e5e7eb] p-3">
							<div className="flex flex-wrap items-end gap-3">
								<span className="w-full text-sm font-semibold sm:w-auto sm:self-center">Créneau {index + 1}</span>
								<label className={`${label} w-full sm:w-44`}>
									Date
									<input type="date" value={draft.date} onChange={(event) => update(index, { date: event.target.value })} aria-invalid={slotError ? true : undefined} aria-describedby={slotError ? errorId : undefined} className={field} />
								</label>
								<label className={`${label} min-w-28 flex-1 sm:w-32 sm:flex-none`}>
									Début
									<input type="time" step={300} value={draft.start} onChange={(event) => update(index, { start: event.target.value })} aria-invalid={slotError ? true : undefined} className={field} />
								</label>
								<label className={`${label} min-w-28 flex-1 sm:w-32 sm:flex-none`}>
									Fin
									<input type="time" step={300} value={draft.end} onChange={(event) => update(index, { end: event.target.value })} aria-invalid={slotError ? true : undefined} className={field} />
								</label>
								{drafts.length > 1 && (
									<button type="button" onClick={() => setDrafts(drafts.filter((_, position) => position !== index))} className={`min-h-11 cursor-pointer rounded-xl px-3 text-sm font-semibold text-[#b91c1c] hover:bg-[#fef2f2] ${focus}`}>
										Retirer<span className="sr-only"> le créneau {index + 1}</span>
									</button>
								)}
							</div>
							{slotError && <p id={errorId} className="text-sm text-red-700">{slotError}</p>}
						</li>
					);
				})}
			</ol>
			{drafts.length < MAX_SLOTS && (
				<button type="button" onClick={() => setDrafts([...drafts, nextDraft(drafts[drafts.length - 1])])} className={`w-fit cursor-pointer rounded-xl px-1 py-1 text-sm font-semibold text-primary hover:underline ${focus}`}>
					+ Ajouter un créneau
				</button>
			)}

			<label className="flex flex-col gap-1.5 text-sm font-semibold">
				Lieu ou lien de la visio (facultatif)
				<input type="text" value={location} maxLength={200} onChange={(event) => setLocation(event.target.value)} placeholder="Adresse, ou « Visio : lien envoyé par message »" className={`${field} font-normal`} />
			</label>
			<label className="flex flex-col gap-1.5 text-sm font-semibold">
				Message pour l’entretien (facultatif)
				<textarea value={message} maxLength={1024} rows={3} onChange={(event) => setMessage(event.target.value)} className={`${field} font-normal`} />
			</label>

			{error && error.slot === null && <p role="alert" className="text-sm text-red-700">{error.text}</p>}
			{attempted && errors.some(Boolean) && <p role="alert" className="sr-only">Certains créneaux sont à corriger.</p>}
			<div className="flex flex-wrap gap-3">
				<Button type="submit" disabled={saving}>{saving ? "Envoi…" : current ? "Envoyer les nouveaux créneaux" : "Envoyer la proposition"}</Button>
				<Button variant="outline" onClick={onCancel} disabled={saving}>Annuler</Button>
			</div>
		</form>
	);
}

type RecruiterInterviewSectionProps = {
	application: RecruiterApplication;
	onChange: (application: RecruiterApplication) => void;
};

// Section « Entretien » de la candidature : proposer des créneaux pendant l'étude, suivre la réponse du
// candidat, modifier une proposition sans réponse ou annuler l'entretien
export default function RecruiterInterviewSection({ application, onChange }: RecruiterInterviewSectionProps) {
	const titleId = useId();
	const interview = application.interview ?? null;
	const underReview = application.status === STATUS.READ || application.status === STATUS.IN_REVIEW;
	const [editing, setEditing] = useState(false);
	const [confirmingCancel, setConfirmingCancel] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	// Une candidature décidée garde seulement l'entretien confirmé, pour mémoire
	if (!underReview && !interview?.confirmed_slot) return null;

	const cancel = async () => {
		setSaving(true);
		setError("");
		const result = await cancelInterview(application.id);
		setSaving(false);
		setConfirmingCancel(false);
		if (result.ok) onChange(result.data);
		else setError(interviewError(result, PROPOSAL_ERRORS));
	};

	const saved = (updated: RecruiterApplication) => {
		setEditing(false);
		onChange(updated);
	};

	return (
		<section aria-labelledby={titleId} className="flex flex-col gap-4 border-t border-[#e5e7eb] pt-5">
			<div className="flex items-center gap-3">
				<span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eff6ff] text-primary">
					<CalendarIcon width={20} height={20} />
				</span>
				<div className="min-w-0">
					<h2 id={titleId} className="text-lg font-semibold">Entretien</h2>
					<p className="text-sm text-[#6b7280]">
						{interview === null
							? "Proposez un ou plusieurs créneaux au candidat avant de rendre votre décision."
							: interview.confirmed_slot
								? "Le candidat a choisi son créneau."
								: `Proposé le ${formatDate(interview.created_at)} : en attente du choix du candidat.`}
					</p>
				</div>
			</div>

			{interview?.confirmed_slot && (
				<p role="status" className="flex flex-col rounded-xl border border-[#bbf7d0] bg-[#ecfdf3] px-4 py-3">
					<span className="text-xs font-semibold text-[#15803d]">Entretien confirmé</span>
					<span className="text-base font-bold">{slotDay(interview.confirmed_slot)}</span>
					<span className="text-sm">{slotHours(interview.confirmed_slot)}</span>
				</p>
			)}

			{interview && !interview.confirmed_slot && !editing && (
				<>
					<ul aria-label="Créneaux proposés" className="flex flex-col gap-2">
						{interview.slots.map((slot) => (
							<li key={slot.id} className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-sm ${slot.unavailable ? "opacity-60" : ""}`}>
								<span><span className="font-semibold">{slotDay(slot)}</span> · {slotHours(slot)}</span>
								{slot.unavailable && <span className="text-xs font-medium text-[#6b7280]">{UNAVAILABLE_FOR_RECRUITER[slot.unavailable]}</span>}
							</li>
						))}
					</ul>
					{interview.available_count === 0 && <p className="text-sm font-medium text-[#b45309]">Plus aucun créneau n’est libre pour le candidat : proposez-en d’autres.</p>}
				</>
			)}

			{interview && (interview.location || interview.message) && !editing && (
				<dl className="flex flex-col gap-2 text-sm">
					{interview.location && <div><dt className="font-semibold">Lieu</dt><dd className="break-words text-[#6b7280]">{interview.location}</dd></div>}
					{interview.message && <div><dt className="font-semibold">Message pour l’entretien</dt><dd className="whitespace-pre-line text-[#6b7280]">{interview.message}</dd></div>}
				</dl>
			)}

			{editing ? (
				<InterviewProposalForm applicationId={application.id} current={interview} upcoming={application.upcoming_interviews ?? []} onSaved={saved} onCancel={() => setEditing(false)} />
			) : (
				underReview && (
					<div className="flex flex-wrap items-center gap-3">
						{interview === null && <Button onClick={() => setEditing(true)}>Proposer un entretien</Button>}
						{interview && !interview.confirmed_slot && <Button variant="secondary" onClick={() => setEditing(true)} disabled={saving}>Modifier les créneaux</Button>}
						{interview && (confirmingCancel ? (
							<span role="group" aria-label="Confirmer l’annulation" className="flex flex-wrap items-center gap-2 text-sm">
								Annuler l’entretien ? Le candidat sera prévenu.
								<button type="button" onClick={cancel} disabled={saving} className={`cursor-pointer rounded-xl border border-[#b91c1c] px-4 py-2 font-semibold text-[#b91c1c] disabled:opacity-50 ${focus}`}>{saving ? "Annulation…" : "Oui, annuler"}</button>
								<button type="button" onClick={() => setConfirmingCancel(false)} disabled={saving} className={`cursor-pointer rounded-xl px-3 py-2 font-semibold text-ink hover:bg-[#f9fafb] ${focus}`}>Non</button>
							</span>
						) : (
							<button type="button" onClick={() => setConfirmingCancel(true)} className={`cursor-pointer rounded-xl px-3 py-2.5 text-sm font-semibold text-[#b91c1c] hover:bg-[#fef2f2] ${focus}`}>Annuler l’entretien</button>
						))}
					</div>
				)
			)}
			{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
		</section>
	);
}
