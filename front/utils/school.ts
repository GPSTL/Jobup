// Affichage de l'espace école et du suivi du contrat.

import type { ContractPeriod, ContractProgress, SchoolContract, SchoolStudent, StudentStatus } from "../services/school";
import { formatShortDate, type ApplicationStep } from "./applications";

// Valeurs de ContractStage dans jobup/models.py
export const CONTRACT_STAGE = { DEPOSITED: 1, VALIDATED: 2, SIGNED: 3 };

// Pastilles d'avancement d'un étudiant, du moins au plus avancé
export const STUDENT_STATUS: Record<StudentStatus, { label: string; className: string }> = {
	searching: { label: "Sans candidature", className: "bg-[#f3f4f6] text-[#6b7280]" },
	applying: { label: "Candidatures en cours", className: "bg-[#dbeafe] text-[#1d4ed8]" },
	accepted: { label: "Candidature acceptée", className: "bg-[#ede7fe] text-[#6d28d9]" },
	contract: { label: "Contrat en cours", className: "bg-[#fef3c7] text-[#b45309]" },
	signed: { label: "Contrat signé", className: "bg-[#dcfce7] text-[#16803d]" },
};

// Alternance trouvée (JOB-047, ECO-05) : une candidature acceptée, puis le contrat
export const FOUND_STATUSES: StudentStatus[] = ["accepted", "contract", "signed"];

// Part des étudiants ayant trouvé leur alternance, en pourcentage arrondi ; 0 sans étudiant
export const foundRate = ({ students, found }: { students: number; found: number }) => (students ? Math.round((found / students) * 100) : 0);

// Tri du tableau des étudiants (JOB-047) : colonne, précédée de « - » pour l'ordre décroissant
export type StudentSortColumn = "name" | "status" | "application_count" | "last_application_at";
export type StudentSort = StudentSortColumn | `-${StudentSortColumn}`;

const STATUS_ORDER = Object.keys(STUDENT_STATUS) as StudentStatus[];

export function sortStudents(students: SchoolStudent[], sort: StudentSort): SchoolStudent[] {
	const descending = sort.startsWith("-");
	const column = (descending ? sort.slice(1) : sort) as StudentSortColumn;
	const name = (student: SchoolStudent) => `${student.last_name} ${student.first_name}`;
	const compare = (a: SchoolStudent, b: SchoolStudent): number => {
		if (column === "status") return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
		if (column === "application_count") return a.application_count - b.application_count;
		if (column === "last_application_at") {
			// Sans candidature : toujours en dernier
			if (a.last_application_at === b.last_application_at) return 0;
			if (a.last_application_at === null) return descending ? -1 : 1;
			if (b.last_application_at === null) return descending ? 1 : -1;
			return a.last_application_at.localeCompare(b.last_application_at);
		}
		return 0;
	};
	// Le nom départage, toujours dans l'ordre alphabétique
	return [...students].sort((a, b) => (descending ? -compare(a, b) : compare(a, b)) || (column === "name" && descending ? -1 : 1) * name(a).localeCompare(name(b), "fr"));
}

// Clic sur une colonne : croissant, puis décroissant ; les dates commencent par la plus récente
export function nextStudentSort(sort: StudentSort, column: StudentSortColumn): StudentSort {
	if (sort === column) return `-${column}`;
	if (sort === `-${column}`) return column;
	return column === "last_application_at" ? "-last_application_at" : column;
}

// Période de l'alternance (JOB-048, ECO-06) et étapes du contrat, sous les noms des filtres de l'API
export const CONTRACT_PERIOD: Record<ContractPeriod, { label: string; className: string }> = {
	upcoming: { label: "À venir", className: "bg-[#dbeafe] text-[#1d4ed8]" },
	ongoing: { label: "En cours", className: "bg-[#dcfce7] text-[#16803d]" },
	finished: { label: "Terminé", className: "bg-[#f3f4f6] text-[#6b7280]" },
};
export const STAGE_KEYS: Record<number, "deposited" | "validated" | "signed"> = {
	[CONTRACT_STAGE.DEPOSITED]: "deposited",
	[CONTRACT_STAGE.VALIDATED]: "validated",
	[CONTRACT_STAGE.SIGNED]: "signed",
};
export const STAGE_LABELS: Record<number, string> = {
	[CONTRACT_STAGE.DEPOSITED]: "À valider",
	[CONTRACT_STAGE.VALIDATED]: "À signer",
	[CONTRACT_STAGE.SIGNED]: "Signé",
};

// Tri du tableau des contrats : colonne, précédée de « - » pour l'ordre décroissant
export type ContractSortColumn = "student" | "start_date" | "end_date";
export type ContractSort = ContractSortColumn | `-${ContractSortColumn}`;

export function sortContracts(contracts: SchoolContract[], sort: ContractSort): SchoolContract[] {
	const descending = sort.startsWith("-");
	const column = (descending ? sort.slice(1) : sort) as ContractSortColumn;
	const name = ({ student }: SchoolContract) => `${student.last_name} ${student.first_name}`;
	const compare = (a: SchoolContract, b: SchoolContract): number => {
		if (column === "student") return name(a).localeCompare(name(b), "fr");
		const [left, right] = [a[column], b[column]];
		// Sans dates : toujours en dernier
		if (left === right) return 0;
		if (left === null) return descending ? -1 : 1;
		if (right === null) return descending ? 1 : -1;
		return left.localeCompare(right);
	};
	return [...contracts].sort((a, b) => (descending ? -compare(a, b) : compare(a, b)));
}

export function nextContractSort(sort: ContractSort, column: ContractSortColumn): ContractSort {
	if (sort === column) return `-${column}`;
	if (sort === `-${column}`) return column;
	return column;
}

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
