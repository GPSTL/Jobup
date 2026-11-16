// Affichage du suivi des candidatures (JOB-033, ETU-14).

import { z } from "zod";

import type { ApplicationSummary } from "../services/applications";

// Valeurs de ApplicationStatus dans jobup/models.py
export const STATUS = { DRAFT: 0, SUBMITTED: 1, READ: 2, IN_REVIEW: 3, ACCEPTED: 4, REFUSED: 5 };

// « Lue » n'existe pas dans la maquette : dès que le recruteur ouvre la candidature,
// l'étudiant voit « En cours d'étude » (écran recruteur « Détail candidature – décision »).
const UNDER_REVIEW = { label: "En cours d’étude", className: "bg-[#fef3c7] text-[#b45309]" };

// Libellés et couleurs des pastilles de la maquette
const CHIPS: Record<number, { label: string; className: string }> = {
	[STATUS.DRAFT]: { label: "Brouillon", className: "bg-[#f3f4f6] text-[#6b7280]" },
	[STATUS.SUBMITTED]: { label: "Postulée", className: "bg-[#dbeafe] text-[#1d4ed8]" },
	[STATUS.READ]: UNDER_REVIEW,
	[STATUS.IN_REVIEW]: UNDER_REVIEW,
	[STATUS.ACCEPTED]: { label: "Acceptée", className: "bg-[#dcfce7] text-[#16803d]" },
	[STATUS.REFUSED]: { label: "Refusée", className: "bg-[#fee2e2] text-[#b91c1c]" },
};

export const statusChip = (status: number) => CHIPS[status];

const isFinal = (status: number) => status === STATUS.ACCEPTED || status === STATUS.REFUSED;

// Le backend ne trie pas : la candidature la plus récemment modifiée en premier
export const byLastUpdate = <T extends Pick<ApplicationSummary, "updated_at">>(applications: T[]) =>
	[...applications].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

// « 08 oct. 2026 »
export const formatDate = (iso: string) =>
	new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

// « 08 oct. »
const formatShortDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

// « Envoyée le 08 oct. 2026 », ou rien pour une candidature pas encore envoyée
export const sentDate = ({ submitted_at }: ApplicationSummary) =>
	submitted_at ? `Envoyée le ${formatDate(submitted_at)}` : "";

// Dates d'une carte. L'API n'expose ni la création du brouillon ni l'historique des statuts :
// updated_at sert de date d'enregistrement du brouillon et de date de réponse.
export function cardDates(application: ApplicationSummary) {
	if (application.status === STATUS.DRAFT) return `Enregistrée le ${formatDate(application.updated_at)}`;
	if (isFinal(application.status)) return `${sentDate(application)} • Réponse le ${formatDate(application.updated_at)}`;
	return sentDate(application);
}

// « NT » pour Nova Tech
export const companyInitials = (company: string) =>
	company.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

export type ApplicationStep = {
	label: string;
	done: boolean;
	/** Date ou « En attente », vide quand la date n'est pas connue */
	detail: string;
};

const WAITING = "En attente";

// Frise « Suivi » du détail. Faute d'historique des statuts, seule la date de la dernière étape franchie est connue.
export function applicationSteps({ status, submitted_at, updated_at }: ApplicationSummary): ApplicationStep[] {
	const final = isFinal(status);
	const underReview = status === STATUS.READ || status === STATUS.IN_REVIEW;
	const reviewDetail = underReview ? formatShortDate(updated_at) : final ? "" : WAITING;
	return [
		{ label: "Postulée", done: true, detail: submitted_at ? formatShortDate(submitted_at) : "" },
		{ label: "En cours d’étude", done: underReview || final, detail: reviewDetail },
		{ label: "Réponse", done: final, detail: final ? formatShortDate(updated_at) : WAITING },
	];
}

// Limites de la maquette « Formulaire de candidature » et du modèle JobApplication
const MAX_MESSAGE_LENGTH = 1024;
const MAX_LETTER_SIZE = 10 * 1024 * 1024;

export const DRAFT_MESSAGES = {
	messageTooLong: `La présentation ne doit pas dépasser ${MAX_MESSAGE_LENGTH} caractères.`,
	letterType: "La lettre de motivation doit être au format PDF ou DOCX.",
	letterSize: "La lettre de motivation ne doit pas dépasser 10 Mo.",
	alreadySubmitted: "Cette candidature a déjà été envoyée : elle ne peut plus être modifiée.",
	invalid: "Cette candidature n’a pas pu être enregistrée : l’offre n’est peut-être plus disponible.",
	noResume: "Ajoutez un CV à votre profil pour envoyer votre candidature.",
};

// Renvoie le message d'erreur, ou "" quand le fichier est valide. Le fichier est facultatif.
export function validateCoverLetter(file?: File) {
	if (!file) return "";
	if (!/\.(pdf|docx)$/i.test(file.name)) return DRAFT_MESSAGES.letterType;
	if (file.size > MAX_LETTER_SIZE) return DRAFT_MESSAGES.letterSize;
	return "";
}

export const draftSchema = z.object({
	message: z.string().max(MAX_MESSAGE_LENGTH, DRAFT_MESSAGES.messageTooLong),
	coverLetter: z.custom<FileList>().optional().superRefine((files, ctx) => {
		const message = validateCoverLetter(files?.[0]);
		if (message) ctx.addIssue({ code: "custom", message });
	}),
});
export type DraftForm = z.infer<typeof draftSchema>;
