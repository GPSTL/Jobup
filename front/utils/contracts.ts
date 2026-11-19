// Contrat d'alternance déposé par le recruteur (JOB-045) : vérifications avant l'envoi, mêmes
// règles que l'API (jobup/contracts.py), et affichage des dates.

import type { ContractErrors, ContractProgress } from "../services/school";
import { CONTRACT_STAGE } from "./school";

export const CONTRACT_MAX_SIZE = 10 * 1024 * 1024;

// « 04 janv. 2027 », sans décalage de fuseau : la date est lue telle quelle
export function formatDay(day: string): string {
	const [year, month, date] = day.split("-").map(Number);
	return new Date(year, month - 1, date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// « Du 04 janv. 2027 au 03 janv. 2028 », ou rien pour un contrat déposé sans dates
export function contractPeriod({ start_date, end_date }: Pick<ContractProgress, "start_date" | "end_date">): string {
	return start_date && end_date ? `Du ${formatDay(start_date)} au ${formatDay(end_date)}` : "";
}

// Date du jour en AAAA-MM-JJ, dans le fuseau du navigateur
export function today(now = new Date()): string {
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Remplaçable jusqu'à la veille du début, tant qu'il n'est pas signé ; le serveur décide en dernier
export function canReplaceContract(contract: ContractProgress, now = new Date()): boolean {
	if (contract.stage >= CONTRACT_STAGE.SIGNED) return false;
	return contract.start_date === null || today(now) < contract.start_date;
}

// Erreurs par champ avant l'envoi ; le contenu du PDF est vérifié par le serveur
export function contractErrors(file: File | null, start: string, end: string): ContractErrors {
	const errors: ContractErrors = {};
	if (!file) errors.file = "Ajoutez le contrat en PDF.";
	else if (file.size === 0) errors.file = "Le fichier est vide.";
	else if (file.size > CONTRACT_MAX_SIZE) errors.file = "Le fichier ne doit pas dépasser 10 Mo.";
	else if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) errors.file = "Le contrat doit être un fichier PDF.";
	if (!start) errors.start_date = "Indiquez la date de début.";
	if (!end) errors.end_date = "Indiquez la date de fin.";
	else if (start && end <= start) errors.end_date = "La date de fin doit être après la date de début.";
	return errors;
}
