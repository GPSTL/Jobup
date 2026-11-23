import { useState } from "react";
import { Link } from "react-router-dom";

import { CandidateAvatar } from "../components/CandidateIdentity";
import { useAdvanceContract } from "../components/ContractCard";
import ExportPanel from "../components/ExportPanel";
import { FilterChips, schoolPanel, SchoolLayout, SchoolRequestState, useSchoolData } from "../components/SchoolLayout";
import { getSchoolContracts, type ContractPeriod, type SchoolContract } from "../services/school";
import { fullName } from "../utils/candidates";
import { formatDay } from "../utils/contracts";
import type { ExportField } from "../utils/exports";
import { highlightText } from "../utils/highlight";
import { CONTRACT_ACTIONS, CONTRACT_PERIOD, CONTRACT_STAGE, nextContractSort, sortContracts, STAGE_KEYS, STAGE_LABELS, type ContractSort, type ContractSortColumn } from "../utils/school";
import { focus } from "../utils/searchPageStyles";
import { SortArrows } from "./AdminUsersPage";

const filters = [
	{ key: "all", label: "Tous", stage: 0 },
	{ key: "deposited", label: "À valider", stage: CONTRACT_STAGE.DEPOSITED },
	{ key: "validated", label: "À signer", stage: CONTRACT_STAGE.VALIDATED },
	{ key: "signed", label: "Signés", stage: CONTRACT_STAGE.SIGNED },
];

// JOB-048 : en cours ou terminés, comme le demande le ticket, et les alternances à venir
const periods: { key: "all" | ContractPeriod; label: string }[] = [
	{ key: "all", label: "Toutes les périodes" },
	{ key: "ongoing", label: "En cours" },
	{ key: "finished", label: "Terminés" },
	{ key: "upcoming", label: "À venir" },
];

const exportFields: ExportField[] = [
	{ kind: "checkboxes", key: "period", label: "Période", options: periods.filter(({ key }) => key !== "all").map(({ key, label }) => ({ value: key, label })) },
	{ kind: "checkboxes", key: "stage", label: "Étape", options: filters.filter(({ key }) => key !== "all").map(({ key, label }) => ({ value: key, label })) },
];

const cell = "px-4 py-3.5";
const COLUMNS: { column: ContractSortColumn | null; label: string }[] = [
	{ column: "student", label: "Étudiant" },
	{ column: null, label: "Offre" },
	{ column: "start_date", label: "Début" },
	{ column: "end_date", label: "Fin" },
	{ column: null, label: "Statut" },
	{ column: null, label: "Étape" },
	{ column: null, label: "Contrat" },
];

type ContractsTableProps = {
	contracts: SchoolContract[];
	sort: ContractSort;
	onSort: (sort: ContractSort) => void;
	onAdvance: (contract: SchoolContract) => void;
	/** Contrat en cours d'enregistrement, et l'erreur de l'action sur un contrat */
	saving: number | null;
	error: { id: number; message: string } | null;
	highlightQuery?: string;
};

// Tableau des contrats (JOB-048, ECO-06) : étudiant, entreprise, dates, statut, PDF et action de l'école
export function SchoolContractsTable({ contracts, sort, onSort, onAdvance, saving, error, highlightQuery }: ContractsTableProps) {
	return (
		<div role="region" aria-label="Contrats des étudiants" tabIndex={0} className={`overflow-x-auto rounded-2xl border border-[#e5e7eb] ${focus}`}>
			<table className="w-full min-w-[960px] border-collapse text-left text-sm text-ink">
				<thead className="bg-[#f9fafb] text-xs text-[#6b7280]">
					<tr>
						{COLUMNS.map(({ column, label }) => {
							if (column === null) return <th key={label} scope="col" className={`${cell} font-semibold whitespace-nowrap`}>{label}</th>;
							const direction = sort === column ? "ascending" : sort === `-${column}` ? "descending" : undefined;
							return (
								<th key={label} scope="col" aria-sort={direction} className={`${cell} font-semibold`}>
									<button type="button" onClick={() => onSort(nextContractSort(sort, column))} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-sm whitespace-nowrap hover:text-ink ${direction ? "text-ink" : ""} ${focus}`}>
										{label}
										<SortArrows direction={direction} />
									</button>
								</th>
							);
						})}
						<th scope="col" className={cell}><span className="sr-only">Action</span></th>
					</tr>
				</thead>
				<tbody>
					{sortContracts(contracts, sort).map((contract) => {
						const action = CONTRACT_ACTIONS[contract.stage];
						const period = contract.period ? CONTRACT_PERIOD[contract.period] : null;
						const failed = error?.id === contract.id ? error.message : "";
						return (
							<tr key={contract.id} className="border-t border-[#e5e7eb] align-top hover:bg-[#f9fafb]">
								<th scope="row" className={`${cell} font-medium`}>
									<Link to={`/school/students/${contract.student.id}`} className={`flex items-center gap-3 rounded-sm hover:underline ${focus}`}>
										<CandidateAvatar candidate={contract.student} className="size-9 text-sm" />
										<span className="break-words">{highlightText(fullName(contract.student), highlightQuery)}</span>
									</Link>
								</th>
								<td className={cell}>
									<p className="font-medium">{highlightText(contract.offer_title, highlightQuery)}</p>
									<p className="text-xs text-[#6b7280]">{highlightText(contract.company, highlightQuery)}</p>
								</td>
								<td className={`${cell} whitespace-nowrap`}>{contract.start_date ? formatDay(contract.start_date) : <span className="text-[#9ca3af]">—</span>}</td>
								<td className={`${cell} whitespace-nowrap`}>{contract.end_date ? formatDay(contract.end_date) : <span className="text-[#9ca3af]">—</span>}</td>
								<td className={cell}>{period ? <span className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${period.className}`}>{period.label}</span> : <span className="text-xs text-[#9ca3af]">Dates non renseignées</span>}</td>
								<td className={`${cell} whitespace-nowrap`}>{STAGE_LABELS[contract.stage]}</td>
								<td className={`${cell} whitespace-nowrap`}>
									{contract.file_url ? (
										<a href={contract.file_url} download className={`font-semibold text-primary hover:underline ${focus}`}>
											Télécharger<span className="sr-only"> le contrat de {fullName(contract.student)}</span>
										</a>
									) : (
										<span className="text-xs text-[#9ca3af]">Pas de PDF</span>
									)}
								</td>
								<td className={`${cell} text-right`}>
									{action && (
										<button type="button" onClick={() => onAdvance(contract)} disabled={saving === contract.id} className={`cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm font-semibold whitespace-nowrap text-on-primary hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60 ${focus}`}>
											{action}<span className="sr-only"> : {fullName(contract.student)}</span>
										</button>
									)}
									{failed && <p role="alert" className="mt-2 text-xs text-red-700">{failed}</p>}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

// Contrats déposés par les entreprises pour les étudiants de l'école : l'école les valide puis les marque signés
export default function SchoolContractsPage() {
	const { result, retry, setData } = useSchoolData(getSchoolContracts);
	const [selected, setSelected] = useState("all");
	const [period, setPeriod] = useState<"all" | ContractPeriod>("all");
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<ContractSort>("student");
	const { advance, saving, error } = useAdvanceContract((updated) => {
		if (result?.ok) setData(result.data.map((contract) => (contract.id === updated.id ? updated : contract)));
	});

	const contracts = result?.ok ? result.data : [];
	const search = query.trim().toLocaleLowerCase("fr");
	const matching = contracts.filter((contract) => !search || `${fullName(contract.student)} ${contract.offer_title} ${contract.company}`.toLocaleLowerCase("fr").includes(search));
	const stage = filters.find((filter) => filter.key === selected)?.stage ?? 0;
	const inPeriod = matching.filter((contract) => period === "all" || contract.period === period);
	const visible = inPeriod.filter((contract) => stage === 0 || contract.stage === stage);

	return (
		<SchoolLayout>
			<section className={schoolPanel}>
				<header className="flex flex-col gap-1">
					<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Contrats</h1>
					<p className="text-sm text-[#6b7280]">Validez les contrats déposés par les entreprises, puis marquez-les signés : vos étudiants en suivent l’avancement.</p>
				</header>
				<SchoolRequestState result={result} retry={retry} />
				{result?.ok && (
					<>
						{contracts.length > 0 && (
							<div className="flex flex-col gap-1.5">
								<label htmlFor="contract-search" className="text-sm font-medium">Rechercher un contrat</label>
								<input id="contract-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Étudiant, offre ou entreprise…" className="min-h-11 w-full max-w-md rounded-xl border border-[#d1d5db] bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
							</div>
						)}
						{contracts.length > 0 && (
							<ExportPanel
								url="/api/school/contracts/export"
								fields={exportFields}
								defaults={{ period: period === "all" ? [] : [period], stage: stage === 0 ? [] : [STAGE_KEYS[stage]] }}
							/>
						)}
						<FilterChips
							label="Filtrer les contrats par étape"
							filters={filters.map(({ key, label, stage }) => ({ key, label, count: inPeriod.filter((contract) => stage === 0 || contract.stage === stage).length }))}
							selected={selected}
							onSelect={setSelected}
						/>
						<FilterChips
							label="Filtrer les contrats par période"
							filters={periods.map(({ key, label }) => ({ key, label, count: matching.filter((contract) => key === "all" || contract.period === key).length }))}
							selected={period}
							onSelect={setPeriod}
						/>
						{visible.length === 0 ? (
							<p role="status" className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-5 text-sm text-[#6b7280]">{contracts.length === 0 ? "Aucun contrat déposé pour le moment." : "Aucun contrat ne correspond à ces filtres."}</p>
						) : (
							<SchoolContractsTable contracts={visible} sort={sort} onSort={setSort} onAdvance={advance} saving={saving} error={error} highlightQuery={query} />
						)}
					</>
				)}
			</section>
		</SchoolLayout>
	);
}
