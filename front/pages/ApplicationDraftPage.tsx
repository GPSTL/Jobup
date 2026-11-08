import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import ApplicationLoader from "../components/ApplicationLoader";
import ApplicationsLayout, { BackToApplications } from "../components/ApplicationsLayout";
import { saveDraft, submitApplication, type ApplicationDetail } from "../services/applications";
import { draftSchema, DRAFT_MESSAGES, STATUS, type DraftForm } from "../utils/applications";
import { focus } from "../utils/searchPageStyles";
import { MESSAGES } from "../utils/validation";

const FORM_ERRORS = {
	alreadySubmitted: DRAFT_MESSAGES.alreadySubmitted,
	invalid: DRAFT_MESSAGES.invalid,
	noResume: DRAFT_MESSAGES.noResume,
	server: MESSAGES.serverError,
	network: MESSAGES.networkError,
};

const label = "text-[16px] font-semibold";
const fieldError = "text-[14px] font-medium text-[#DC2626]";
const button = `h-14 w-full cursor-pointer rounded-[14px] text-[18px] font-semibold disabled:cursor-wait disabled:opacity-70 ${focus}`;

export function DraftEditor({ application }: { application: ApplicationDetail }) {
	const navigate = useNavigate();
	const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<DraftForm>({
		resolver: zodResolver(draftSchema),
		defaultValues: { message: application.message },
	});
	const [savedLetter, setSavedLetter] = useState(application.documents.cover_letter);
	const [formError, setFormError] = useState("");
	const [saved, setSaved] = useState(false);
	const [noSession, setNoSession] = useState(false);
	// Bouton en cours : pour n'afficher l'attente que sur lui
	const [sending, setSending] = useState(false);
	const chosenLetter = watch("coverLetter")?.[0];

	const fail = (reason: "noSession" | keyof typeof FORM_ERRORS) => {
		if (reason === "noSession") setNoSession(true);
		else setFormError(FORM_ERRORS[reason]);
	};

	// Enregistre toujours le brouillon d'abord, pour que l'envoi parte avec les dernières modifications
	const save = (submit: boolean) => handleSubmit(async ({ message, coverLetter }) => {
		setFormError("");
		setSaved(false);
		setSending(submit);
		const draft = await saveDraft(application.offer.id, message, coverLetter?.[0]);
		if (!draft.ok) return fail(draft.reason);
		setSavedLetter(draft.application.documents.cover_letter);
		// La lettre est enregistrée : le champ se vide pour ne pas la renvoyer au prochain enregistrement
		setValue("coverLetter", undefined);
		if (!submit) {
			setSaved(true);
			return;
		}

		const sent = await submitApplication(application.id);
		if (!sent.ok) return fail(sent.reason);
		navigate(`/applications/${application.id}`, { replace: true, state: { submitted: true } });
	});

	// Session expirée pendant la saisie : retour à la connexion
	if (noSession) return <Navigate to="/login" replace />;

	return (
		<ApplicationsLayout className="max-w-[464px] gap-6 px-4 py-[39px] sm:px-[73px]">
			<BackToApplications />

			<div className="flex flex-col gap-2 text-center">
				<h1 className="text-[36px] font-semibold">Reprendre ma candidature</h1>
				<p className="text-[18px] text-[#6b7280]">{application.offer.title} chez {application.company}</p>
			</div>

			<form onSubmit={save(true)} noValidate aria-busy={isSubmitting} className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<label htmlFor="message" className={label}>Présentation</label>
					<textarea
						id="message"
						placeholder="À propos de moi"
						aria-invalid={!!errors.message}
						aria-describedby={errors.message ? "message-error" : undefined}
						className="h-[94px] w-full resize-y rounded-[14px] border border-[#d1d5db] bg-white px-[18px] py-4 text-[18px] outline-none placeholder:text-[#9ca3af] focus:border-primary"
						{...register("message")}
					/>
					{errors.message && <p id="message-error" className={fieldError}>{errors.message.message}</p>}
				</div>

				{/* L'API ne prend pas de CV dans le brouillon : l'envoi joint celui du profil */}
				<div className="flex flex-col gap-2">
					<p className={label}>CV</p>
					<p className="text-[16px] text-[#6b7280]">Le CV de votre profil sera joint à l’envoi.</p>
				</div>

				<div className="flex flex-col gap-2">
					<label htmlFor="cover-letter" className={label}>Lettre de motivation (PDF ou DOCX)</label>
					{/* Le champ fichier invisible couvre la zone : clic, glisser-déposer et clavier passent par lui */}
					<div className="relative flex h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-primary bg-[#f9fafb] p-5 text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
						<img src="/static/img/applications/upload.svg" width={24} height={24} alt="" />
						<p className="max-w-full truncate text-[18px] font-semibold">{chosenLetter ? chosenLetter.name : "Déposer votre lettre de motivation"}</p>
						<p id="cover-letter-hint" className="text-[14px] text-[#6b7280]">Fichier unique • 10 Mo max</p>
						<input
							id="cover-letter"
							type="file"
							accept=".pdf,.docx"
							aria-invalid={!!errors.coverLetter}
							aria-describedby={errors.coverLetter ? "cover-letter-error cover-letter-hint" : "cover-letter-hint"}
							className="absolute inset-0 cursor-pointer opacity-0"
							{...register("coverLetter")}
						/>
					</div>
					{errors.coverLetter && <p id="cover-letter-error" className={fieldError}>{errors.coverLetter.message}</p>}
					{savedLetter && (
						<a href={savedLetter} download className={`w-fit rounded-sm text-[14px] font-semibold text-primary hover:underline ${focus}`}>
							Télécharger la lettre enregistrée
						</a>
					)}
				</div>

				{formError && <p role="alert" className={fieldError}>{formError}</p>}
				{saved && <p role="status" className="text-[14px] font-medium text-[#16803d]">Brouillon enregistré.</p>}

				<div className="flex flex-col gap-3">
					<button type="submit" disabled={isSubmitting} className={`${button} bg-primary text-on-primary hover:bg-primary/90`}>
						{isSubmitting && sending ? "Envoi…" : "Confirmer ma candidature"}
					</button>
					<p className="text-center text-[14px] text-[#6b7280]">
						En cliquant sur Confirmer, vous acceptez que votre CV soit traité pour cette opportunité.
					</p>
					<button
						type="button"
						disabled={isSubmitting}
						onClick={save(false)}
						className={`${button} border border-[#d1d5db] bg-white text-[#111827] hover:bg-[#f9fafb]`}
					>
						{isSubmitting && !sending ? "Enregistrement…" : "Enregistrer le brouillon"}
					</button>
				</div>
			</form>
		</ApplicationsLayout>
	);
}

// Reprise d'une candidature commencée mais non envoyée (JOB-033, ETU-14) : enregistrement du brouillon
// ou envoi au recruteur. Le parcours de candidature depuis une offre (ETU-04) pourra réutiliser cet envoi.
export default function ApplicationDraftPage() {
	return (
		<ApplicationLoader>
			{(application) =>
				application.status === STATUS.DRAFT ? (
					<DraftEditor application={application} />
				) : (
					<Navigate to={`/applications/${application.id}`} replace />
				)
			}
		</ApplicationLoader>
	);
}
