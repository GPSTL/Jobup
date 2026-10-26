import { useEffect, useState } from "react";

import Button from "./Button";
import CvImportDialog from "./CvImportDialog";
import SectionCard from "./SectionCard";
import { getCv, uploadCv, type Cv } from "../services/cv";
import { MESSAGES, REQUEST_ERRORS } from "../utils/validation";

// "12 mars 2026"
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

// CV block of "Mon espace" (JOB-019). Loads its own data, so it does not depend on the profile.
export default function CvSection() {
	// null when the student has not imported a CV yet
	const [cv, setCv] = useState<Cv | null>(null);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState("");
	// Incremented by "Réessayer" to load the CV again
	const [attempt, setAttempt] = useState(0);
	// Import window open
	const [importing, setImporting] = useState(false);
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		// Ignores the answer if the page was left in the meantime
		let ignore = false;
		getCv().then((result) => {
			if (ignore) return;
			setLoading(false);
			if (result.ok) setCv(result.cv);
			else setLoadError(result.reason === "invalid" ? MESSAGES.serverError : REQUEST_ERRORS[result.reason]);
		});
		return () => {
			ignore = true;
		};
	}, [attempt]);

	const retry = () => {
		setLoadError("");
		setLoading(true);
		setAttempt(attempt + 1);
	};

	const openImport = () => {
		setSaved(false);
		setImporting(true);
	};

	const onImport = async (file: File) => {
		const result = await uploadCv(file);
		if (!result.ok) return result.reason === "invalid" ? result.message : REQUEST_ERRORS[result.reason];
		setCv(result.cv);
		setSaved(true);
		return "";
	};

	const ready = !loading && !loadError;

	return (
		<>
			<SectionCard
				title="Mon CV"
				action={
					ready && (
						<Button variant="secondary" onClick={openImport}>
							Importer<span className="sr-only"> un CV</span>
						</Button>
					)
				}
			>
				{loading && <p className="text-[#6c7386]">Chargement de votre CV…</p>}
				{loadError && (
					<div role="alert" className="flex flex-wrap items-center gap-3">
						<p>{loadError}</p>
						<Button variant="outline" onClick={retry}>
							Réessayer
						</Button>
					</div>
				)}
				{ready && cv && (
					<>
						<p className="font-medium break-all">{cv.fileName}</p>
						<p className="mt-1 text-sm text-[#6c7386]">
							Mis à jour le {formatDate(cv.updatedAt)} • visible dans vos candidatures et votre profil public
						</p>
					</>
				)}
				{ready && !cv && (
					<>
						<p className="text-[#6c7386]">Vous n’avez pas encore importé de CV.</p>
						<p className="mt-1 text-sm text-[#6c7386]">PDF, DOCX ou DOC, 5 Mo maximum</p>
					</>
				)}
				<p role="status" className="text-sm font-medium text-[#15803d] [&:not(:empty)]:mt-2">
					{saved ? "Votre nouveau CV est enregistré." : ""}
				</p>
			</SectionCard>

			<CvImportDialog open={importing} replacing={cv !== null} onClose={() => setImporting(false)} onImport={onImport} />
		</>
	);
}
