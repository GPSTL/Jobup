// Affichage de l'espace école et du suivi du contrat.

import type { ContractProgress, StudentStatus } from "../services/school";
import { formatShortDate, type ApplicationStep } from "./applications";

// Valeurs de ContractStage dans jobup/models.py
export const CONTRACT_STAGE = { DEPOSITED: 1, VALIDATED: 2, SIGNED: 3 };

// Pastilles d'avancement d'un étudiant, du moins au plus avancé
export const STUDENT_STATUS: Record<StudentStatus, { label: string; className: string }> = {
	searching: { label: "En recherche", className: "bg-[#f3f4f6] text-[#6b7280]" },
	applying: { label: "Candidatures en cours", className: "bg-[#dbeafe] text-[#1d4ed8]" },
	accepted: { label: "Candidature acceptée", className: "bg-[#ede7fe] text-[#6d28d9]" },
	contract: { label: "Contrat en cours", className: "bg-[#fef3c7] text-[#b45309]" },
	signed: { label: "Contrat signé", className: "bg-[#dcfce7] text-[#16803d]" },
};

// Ce que fait l'école pour faire avancer un contrat à l'étape suivante
export const CONTRACT_ACTIONS: Record<number, string> = {
	[CONTRACT_STAGE.DEPOSITED]: "Valider le contrat",
	[CONTRACT_STAGE.VALIDATED]: "Marquer comme signé",
};

const WAITING = "En attente";

// Frise « Suivi du contrat » : la candidature acceptée, puis les trois étapes du contrat.
// Sans contrat déposé, seule la première est franchie.
export function contractSteps(contract: ContractProgress | null, acceptedAt = ""): ApplicationStep[] {
	const stage = contract?.stage ?? 0;
	const date = (iso: string | null | undefined) => (iso ? formatShortDate(iso) : WAITING);
	return [
		{ label: "Candidature acceptée", done: true, detail: acceptedAt ? formatShortDate(acceptedAt) : "" },
		{ label: "Contrat déposé", done: stage >= CONTRACT_STAGE.DEPOSITED, detail: date(contract?.deposited_at) },
		{ label: "Validé par l’école", done: stage >= CONTRACT_STAGE.VALIDATED, detail: date(contract?.validated_at) },
		{ label: "Signé", done: stage >= CONTRACT_STAGE.SIGNED, detail: date(contract?.signed_at) },
	];
}
