import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { flushSync } from "react-dom";

import Button from "./Button";
import SectionCard from "./SectionCard";
import { validateMaxLength } from "../utils/validation";

type TextSectionProps = {
	title: string;
	value: string;
	/** Shown instead of the value when it is empty */
	emptyText: string;
	/** Help text under the value and under the field */
	hint: string;
	placeholder: string;
	maxLength: number;
	/** Several lines (textarea) instead of one (input) */
	multiline?: boolean;
	/** Saves the new text. Returns the error message to display, or "" when saved. */
	onSave: (value: string) => Promise<string>;
};

const field = "w-full rounded-[10px] border-[1.5px] bg-surface px-3 py-2 text-ink outline-none transition-colors duration-150";

// Text block of "Mon espace" (presentation, desired position): the current text, or the form to change it
export default function TextSection({ title, value, emptyText, hint, placeholder, maxLength, multiline = false, onSave }: TextSectionProps) {
	const [editing, setEditing] = useState(false);
	// Text being typed: only sent on "Enregistrer", so "Annuler" keeps the current value
	const [draft, setDraft] = useState("");
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	// Updated immediately, unlike the state, so fast double clicks are blocked too
	const savingRef = useRef(false);
	const [saved, setSaved] = useState(false);

	const editButtonRef = useRef<HTMLButtonElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const id = useId();
	const length = draft.trim().length;

	const startEditing = () => {
		// Form prefilled with the current text
		setDraft(value);
		setError("");
		setSaved(false);
		setEditing(true);
	};

	// flushSync displays "Modifier" again right away, so it can receive the focus:
	// keyboard users stay on this block instead of going back to the top of the page
	const stopEditing = () => {
		flushSync(() => setEditing(false));
		editButtonRef.current?.focus();
	};

	const cancel = () => {
		if (!savingRef.current) stopEditing();
	};

	const onChange = (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
		setDraft(e.target.value);
		// The message disappears as soon as the text is fixed
		if (error) setError(validateMaxLength(e.target.value.trim(), maxLength));
	};

	const onSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (savingRef.current) return;

		const text = draft.trim();
		const invalid = validateMaxLength(text, maxLength);
		if (invalid) {
			setError(invalid);
			(textareaRef.current ?? inputRef.current)?.focus();
			return;
		}
		// Nothing changed: no need to call the API
		if (text === value) {
			stopEditing();
			return;
		}

		savingRef.current = true;
		setSaving(true);
		const message = await onSave(text);
		savingRef.current = false;
		setSaving(false);

		if (message) {
			// The typed text is kept, so the user can fix it or try again
			setError(message);
			return;
		}
		setSaved(true);
		stopEditing();
	};

	// Shared by the textarea and the input
	const fieldProps = {
		value: draft,
		onChange,
		placeholder,
		autoFocus: true,
		"aria-label": title,
		"aria-invalid": error !== "",
		"aria-describedby": error ? `${id}-hint ${id}-error` : `${id}-hint`,
		className: `${field} ${error ? "border-[#DC2626]" : "border-[#D1D5DB] focus:border-primary"}`,
	};

	return (
		<SectionCard
			title={title}
			action={
				!editing && (
					<Button ref={editButtonRef} variant="secondary" onClick={startEditing}>
						Modifier<span className="sr-only"> « {title} »</span>
					</Button>
				)
			}
		>
			{editing ? (
				<form
					onSubmit={onSubmit}
					onKeyDown={(e) => {
						if (e.key === "Escape") cancel();
					}}
					noValidate
					className="flex flex-col gap-2"
				>
					{multiline ? <textarea ref={textareaRef} rows={5} {...fieldProps} /> : <input ref={inputRef} type="text" {...fieldProps} />}
					<div className="flex justify-between gap-4 text-sm text-[#6c7386]">
						<p id={`${id}-hint`}>{hint}</p>
						<p className={`shrink-0 ${length > maxLength ? "font-medium text-[#DC2626]" : ""}`}>
							{length}/{maxLength}
						</p>
					</div>
					{error && (
						<p id={`${id}-error`} role="alert" className="text-sm font-medium text-[#DC2626]">
							{error}
						</p>
					)}
					<div className="mt-1 flex justify-end gap-2">
						<Button variant="outline" onClick={cancel}>
							Annuler
						</Button>
						<Button type="submit" className={saving ? "cursor-wait opacity-70" : ""}>
							{saving ? "Enregistrement…" : "Enregistrer"}
						</Button>
					</div>
				</form>
			) : (
				<>
					<p className={value ? "break-words whitespace-pre-line" : "text-[#6c7386]"}>{value || emptyText}</p>
					<p className="mt-1 text-sm text-[#6c7386]">{hint}</p>
				</>
			)}
			{/* Always present (empty by default), so screen readers announce the message when it appears */}
			<p role="status" className="text-sm font-medium text-[#15803d] [&:not(:empty)]:mt-2">
				{saved ? "Modifications enregistrées." : ""}
			</p>
		</SectionCard>
	);
}
