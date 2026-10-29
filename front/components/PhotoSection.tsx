import { useRef, useState, type ChangeEvent } from "react";

import Button from "./Button";
import SectionCard from "./SectionCard";
import UserIcon from "./UserIcon";
import { validatePhoto } from "../utils/validation";

type PhotoSectionProps = {
	photoUrl: string | null;
	/** Sends the new photo. Returns the error message to display, or "" when saved. */
	onUpload: (file: File) => Promise<string>;
};

// Photo block of "Mon espace": "Modifier" opens the file picker, and the chosen photo is sent right away
export default function PhotoSection({ photoUrl, onUpload }: PhotoSectionProps) {
	const [error, setError] = useState("");
	const [uploading, setUploading] = useState(false);
	// Updated immediately, unlike the state, so a photo chosen during an upload is ignored
	const uploadingRef = useRef(false);
	const [saved, setSaved] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		// Emptied so that choosing the same file again still triggers onChange
		e.target.value = "";
		if (!file || uploadingRef.current) return;

		setSaved(false);
		const invalid = validatePhoto(file);
		setError(invalid);
		if (invalid) return;

		uploadingRef.current = true;
		setUploading(true);
		const message = await onUpload(file);
		uploadingRef.current = false;
		setUploading(false);
		setError(message);
		setSaved(!message);
	};

	return (
		<SectionCard
			title="Photo de profil"
			action={
				<Button
					variant="secondary"
					onClick={() => {
						if (!uploadingRef.current) inputRef.current?.click();
					}}
					className={uploading ? "cursor-wait opacity-70" : ""}
				>
					{uploading ? "Envoi…" : <>Modifier<span className="sr-only"> la photo de profil</span></>}
				</Button>
			}
		>
			<div className="flex items-center gap-4">
				{photoUrl ? (
					<img src={photoUrl} alt="Votre photo de profil" className="size-16 shrink-0 rounded-full object-cover" />
				) : (
					<span role="img" aria-label="Aucune photo de profil" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#E5E7EB] text-[#6c7386]">
						<UserIcon className="size-8" />
					</span>
				)}
				<div className="text-sm">
					<p>JPG ou PNG, 2 Mo maximum</p>
					<p className="text-[#6c7386]">Visible sur votre profil public et dans vos candidatures.</p>
				</div>
			</div>
			<input ref={inputRef} type="file" accept="image/jpeg,image/png" onChange={onChange} className="hidden" />
			{error && (
				<p role="alert" className="mt-2 text-sm font-medium text-[#DC2626]">
					{error}
				</p>
			)}
			<p role="status" className="text-sm font-medium text-[#15803d] [&:not(:empty)]:mt-2">
				{saved ? "Photo mise à jour." : ""}
			</p>
		</SectionCard>
	);
}
