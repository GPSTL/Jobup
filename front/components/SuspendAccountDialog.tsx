import { useEffect, useId, useRef } from "react";

import Button from "./Button";

type SuspendAccountDialogProps = {
	open: boolean;
	/** Name of the account, e.g. "Alice Martin" */
	name: string;
	/** The suspension is being sent: the window cannot be closed */
	pending: boolean;
	/** Message of a failed suspension, "" otherwise */
	error: string;
	onCancel: () => void;
	onConfirm: () => void;
};

// Confirmation before suspending an account (ADM-03): « Annuler » closes it without changing anything.
// Meant to be reused for the companies (ADM-06) and the schools (ADM-14)
export default function SuspendAccountDialog({ open, name, pending, error, onCancel, onConfirm }: SuspendAccountDialogProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const textId = useId();

	// Native modal window: the browser keeps the focus inside, closes it with Escape and gives
	// the focus back to « Suspendre le compte » when it closes
	useEffect(() => {
		if (!open) return;
		const dialog = dialogRef.current;
		dialog?.showModal();
		return () => dialog?.close();
	}, [open]);

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby={titleId}
			aria-describedby={textId}
			onClose={onCancel}
			onCancel={(e) => {
				// No closing with Escape while the suspension is sent
				if (pending) e.preventDefault();
			}}
			className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl bg-surface p-6 text-ink shadow-xl backdrop:bg-[rgba(0,0,0,0.5)]"
		>
			<h2 id={titleId} className="text-xl font-semibold">
				Suspendre le compte de {name} ?
			</h2>
			<p id={textId} className="mt-3 text-[15px] text-[#6c7386]">
				Ce compte ne pourra plus se connecter et sa session en cours sera fermée. Ses conversations restent visibles, grisées, chez ses interlocuteurs, qui ne pourront plus lui écrire. Vous pourrez rétablir le compte à tout moment.
			</p>
			{error && (
				<p role="alert" className="mt-3 text-sm font-medium text-[#DC2626]">
					{error}
				</p>
			)}
			<div className="mt-6 flex justify-end gap-2">
				<Button variant="outline" onClick={onCancel} disabled={pending}>
					Annuler
				</Button>
				<Button onClick={onConfirm} disabled={pending} className={`bg-[#e00000]! hover:bg-[#c00000]! ${pending ? "cursor-wait opacity-70" : ""}`}>
					{pending ? "Suspension…" : "Suspendre le compte"}
				</Button>
			</div>
		</dialog>
	);
}
