import { useEffect, useId, useRef, useState, type DragEvent } from "react";

import Button from "./Button";
import UploadIcon from "./UploadIcon";
import { MESSAGES, validateCv } from "../utils/validation";

type CvImportDialogProps = {
	open: boolean;
	/** The student already has a CV: the window says it will be replaced */
	replacing: boolean;
	onClose: () => void;
	/** Sends the file. Returns the error message to display, or "" when imported. */
	onImport: (file: File) => Promise<string>;
};

// "350 Ko", "1,2 Mo"
const formatSize = (bytes: number) =>
	bytes < 1024 * 1024
		? `${Math.ceil(bytes / 1024)} Ko`
		: `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;

// Window to import a CV, by drag and drop or with "Choisir un fichier" (ETU-02)
export default function CvImportDialog({ open, replacing, onClose, onImport }: CvImportDialogProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [error, setError] = useState("");
	// A file is dragged over the drop zone
	const [dragging, setDragging] = useState(false);
	const [uploading, setUploading] = useState(false);
	// Updated immediately, unlike the state, so fast double clicks are blocked too
	const uploadingRef = useRef(false);
	const titleId = useId();

	// Native modal window: the browser moves the focus inside and keeps it there, closes it with Escape,
	// and gives the focus back to the "Importer" button when it closes
	useEffect(() => {
		if (!open) return;
		const dialog = dialogRef.current;
		dialog?.showModal();
		return () => dialog?.close();
	}, [open]);

	const choose = (chosen: File | undefined) => {
		if (!chosen || uploadingRef.current) return;
		const invalid = validateCv(chosen);
		setError(invalid);
		// An invalid file is not kept, so "Importer" stays disabled
		setFile(invalid ? null : chosen);
	};

	// Also called by the browser when the window is closed with Escape
	const close = () => {
		if (uploadingRef.current) return;
		// Cleared for the next opening
		setFile(null);
		setError("");
		setDragging(false);
		onClose();
	};

	const confirm = async () => {
		if (!file || uploadingRef.current) return;

		uploadingRef.current = true;
		setUploading(true);
		let message: string;
		try {
			message = await onImport(file);
		} catch {
			message = MESSAGES.serverError;
		}
		uploadingRef.current = false;
		setUploading(false);

		if (message) {
			// The current CV is unchanged and the file is kept, so the user can try again
			setError(message);
			return;
		}
		close();
	};

	const onDragOver = (e: DragEvent) => {
		e.preventDefault();
		// No highlight while sending: a file dropped now would be ignored
		if (!uploadingRef.current) setDragging(true);
	};

	const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
		// Ignores the moves from one element of the zone to another
		if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
	};

	const onDrop = (e: DragEvent) => {
		e.preventDefault();
		setDragging(false);
		choose(e.dataTransfer.files[0]);
	};

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby={titleId}
			onClose={close}
			onCancel={(e) => {
				// No closing with Escape while the file is being sent
				if (uploadingRef.current) e.preventDefault();
			}}
			// A file dropped next to the zone must not be opened by the browser in place of the page
			onDragOver={(e) => e.preventDefault()}
			onDrop={(e) => e.preventDefault()}
			className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl bg-surface p-6 text-ink shadow-xl backdrop:bg-[rgba(0,0,0,0.5)]"
		>
			<h2 id={titleId} className="text-xl font-semibold">
				Importer un CV
			</h2>
			{replacing && <p className="mt-1 text-sm text-[#6c7386]">Le nouveau document remplacera automatiquement votre CV actuel.</p>}

			<div
				onDragOver={onDragOver}
				onDragLeave={onDragLeave}
				onDrop={onDrop}
				className={`mt-5 flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center motion-safe:transition-colors ${dragging ? "border-primary bg-[#dae8ff]/50" : "border-[#cfd4de]"} ${uploading ? "opacity-60" : ""}`}
			>
				<UploadIcon className="size-8 text-primary" />
				<p className="font-medium">Glissez-déposez votre CV ici</p>
				<p className="text-sm text-[#6c7386]">ou</p>
				{/* Disabled while sending, like "Annuler": the click would be ignored, so it should look so */}
				<Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
					Choisir un fichier
				</Button>
				<p className="text-sm text-[#6c7386]">PDF, DOCX ou DOC, 5 Mo maximum</p>
				<input
					ref={inputRef}
					type="file"
					accept=".pdf,.docx,.doc"
					onChange={(e) => {
						choose(e.target.files?.[0]);
						// Emptied so that choosing the same file again still triggers onChange
						e.target.value = "";
					}}
					className="hidden"
				/>
			</div>

			{file && (
				<p className="mt-4 rounded-xl bg-[#F9FAFB] px-3 py-2 text-sm">
					Fichier sélectionné : <span className="font-medium break-all">{file.name}</span> ({formatSize(file.size)})
				</p>
			)}
			{error && (
				<p role="alert" className="mt-3 text-sm font-medium text-[#DC2626]">
					{error}
				</p>
			)}

			<div className="mt-6 flex justify-end gap-2">
				<Button variant="outline" onClick={close} disabled={uploading}>
					Annuler
				</Button>
				<Button onClick={confirm} disabled={!file} className={uploading ? "cursor-wait opacity-70" : ""}>
					{uploading ? "Import en cours…" : "Importer"}
				</Button>
			</div>
		</dialog>
	);
}
