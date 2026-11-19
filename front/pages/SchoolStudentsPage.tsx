import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { CandidateAvatar } from "../components/CandidateIdentity";
import ExportPanel from "../components/ExportPanel";
import { SortArrows } from "./AdminUsersPage";
import { FilterChips, schoolPanel, SchoolLayout, SchoolRequestState, useSchoolData } from "../components/SchoolLayout";
import { decideSchoolRequest, getSchoolRequests, getSchoolStudents, type SchoolStudent, type StudentStatus } from "../services/school";
import { formatDate } from "../utils/applications";
import { fullName } from "../utils/candidates";
import type { ExportField } from "../utils/exports";
import { nextStudentSort, sortStudents, STUDENT_STATUS, type StudentSort, type StudentSortColumn } from "../utils/school";
import { focus } from "../utils/searchPageStyles";
import { REQUEST_ERRORS } from "../utils/validation";

const filters: { key: "all" | StudentStatus; label: string }[] = [
	{ key: "all", label: "Tous" },
	...(Object.entries(STUDENT_STATUS) as [StudentStatus, { label: string }][]).map(([key, { label }]) => ({ key, label })),
];

// Filtres de l'export : l'avancement, et la recherche en cours s'il y en a une
const exportFields = (query: string): ExportField[] => [
	{ kind: "checkboxes", key: "status", label: "Avancement", options: filters.filter(({ key }) => key !== "all").map(({ key, label }) => ({ value: key, label })) },
	...(query ? [{ kind: "toggle", key: "q", label: `Appliquer la recherche « ${query} »`, value: query } as const] : []),
];

const cell = "px-4 py-3.5";
const COLUMNS: { column: StudentSortColumn; label: string }[] = [
	{ column: "name", label: "Étudiant" },
	{ column: "status", label: "Avancement" },
	{ column: "application_count", label: "Candidatures envoyées" },
	{ column: "last_application_at", label: "Dernière candidature" },
];

type StudentsTableProps = {
	students: SchoolStudent[];
	sort: StudentSort;
	onSort: (sort: StudentSort) => void;
};

// Tableau des étudiants (JOB-047, ECO-05), trié par colonne ; défile seul sur petit écran
export function SchoolStudentsTable({ students, sort, onSort }: StudentsTableProps) {
	return (
		<div role="region" aria-label="Étudiants de l’école" tabIndex={0} className={`overflow-x-auto rounded-2xl border border-[#e5e7eb] ${focus}`}>
			<table className="w-full min-w-[720px] border-collapse text-left text-sm text-ink">
				<thead className="bg-[#f9fafb] text-xs text-[#6b7280]">
					<tr>
						{COLUMNS.map(({ column, label }) => {
							const direction = sort === column ? "ascending" : sort === `-${column}` ? "descending" : undefined;
							return (
								<th key={column} scope="col" aria-sort={direction} className={`${cell} font-semibold`}>
									<button type="button" onClick={() => onSort(nextStudentSort(sort, column))} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-sm whitespace-nowrap hover:text-ink ${direction ? "text-ink" : ""} ${focus}`}>
										{label}
										<SortArrows direction={direction} />
									</button>
								</th>
							);
						})}
						<th scope="col" className={cell}><span className="sr-only">Suivi</span></th>
					</tr>
				</thead>
				<tbody>
					{sortStudents(students, sort).map((student) => (
						<tr key={student.id} className="border-t border-[#e5e7eb] hover:bg-[#f9fafb]">
							<th scope="row" className={`${cell} font-medium`}>
								<span className="flex items-center gap-3">
									<CandidateAvatar candidate={student} className="size-9 text-sm" />
									<span className="break-words">{fullName(student)}</span>
								</span>
							</th>
							<td className={cell}><span className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${STUDENT_STATUS[student.status].className}`}>{STUDENT_STATUS[student.status].label}</span></td>
							<td className={cell}>{student.application_count}</td>
							<td className={`${cell} whitespace-nowrap`}>{student.last_application_at ? <time dateTime={student.last_application_at}>{formatDate(student.last_application_at)}</time> : <span className="text-[#9ca3af]">Aucune</span>}</td>
							<td className={`${cell} text-right`}>
								<Link to={`/school/students/${student.id}`} className={`text-sm font-semibold whitespace-nowrap text-primary hover:underline ${focus}`}>Voir le suivi<span className="sr-only"> de {fullName(student)}</span></Link>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

// Étudiants de l'école et demandes de rattachement à valider (ETU : « Mon école » dans leur espace)
export default function SchoolStudentsPage() {
	const students = useSchoolData(getSchoolStudents);
	const requests = useSchoolData(getSchoolRequests);
	const [selected, setSelected] = useState<"all" | StudentStatus>("all");
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<StudentSort>("name");
	// Demande en cours de décision, et message d'échec
	const [deciding, setDeciding] = useState<number | null>(null);
	const [error, setError] = useState("");
	// Étudiant que l'école vient de retirer depuis sa fiche (JOB-049)
	const removed = (useLocation().state as { removedStudent?: string } | null)?.removedStudent;

	const decide = async (id: number, status: "accepted" | "refused") => {
		if (deciding !== null || !requests.result?.ok) return;
		setDeciding(id);
		setError("");
		const result = await decideSchoolRequest(id, status);
		setDeciding(null);
		// Déjà décidée ailleurs (404 ou 409) : elle disparaît de la liste comme les autres
		if (result.ok || result.reason === "conflict" || result.reason === "notFound") {
			requests.setData(requests.result.data.filter((request) => request.id !== id));
			if (status === "accepted") students.retry();
		} else setError(REQUEST_ERRORS[result.reason === "unauthenticated" || result.reason === "network" ? result.reason : "server"]);
	};

	const all = students.result?.ok ? students.result.data : [];
	const search = query.trim().toLocaleLowerCase("fr");
	const matching = all.filter((student) => fullName(student).toLocaleLowerCase("fr").includes(search));
	const visible = matching.filter((student) => selected === "all" || student.status === selected);

	return (
		<SchoolLayout>
			<section className={schoolPanel}>
				<header className="flex flex-col gap-1">
					<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Étudiants</h1>
					<p className="text-sm text-[#6b7280]">Suivez la recherche d’alternance de vos étudiants, de leurs candidatures jusqu’à la signature du contrat.</p>
				</header>
				{removed && <p role="status" className="rounded-xl bg-[#dcfce7] px-4 py-3 text-sm text-[#166534]">{removed} a été retiré de votre école.</p>}
				<SchoolRequestState result={students.result} retry={students.retry} />

				{requests.result?.ok && requests.result.data.length > 0 && (
					<section aria-label="Demandes de rattachement" className="flex flex-col gap-3">
						<h2 className="text-lg font-semibold">Demandes de rattachement ({requests.result.data.length})</h2>
						<ul className="flex flex-col gap-2.5">
							{requests.result.data.map(({ id, student, created_at }) => (
								<li key={id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] px-5 py-3.5">
									<CandidateAvatar candidate={student} className="size-11 text-base" />
									<div className="min-w-0 flex-1 basis-40">
										<p className="text-base font-semibold break-words">{fullName(student)}</p>
										<p className="text-xs sm:text-sm text-[#6b7280]">Demande du <time dateTime={created_at}>{formatDate(created_at)}</time></p>
									</div>
									<button type="button" onClick={() => decide(id, "accepted")} disabled={deciding !== null} className={`cursor-pointer rounded-xl bg-[#16803d] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50 ${focus}`}>
										Accepter<span className="sr-only"> la demande de {fullName(student)}</span>
									</button>
									<button type="button" onClick={() => decide(id, "refused")} disabled={deciding !== null} className={`cursor-pointer rounded-xl border border-[#b91c1c] px-5 py-2.5 text-sm font-semibold text-[#b91c1c] disabled:cursor-wait disabled:opacity-50 ${focus}`}>
										Refuser<span className="sr-only"> la demande de {fullName(student)}</span>
									</button>
								</li>
							))}
						</ul>
						{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
					</section>
				)}

				{students.result?.ok && (
					<>
						<div className="flex flex-col gap-1.5">
							<label htmlFor="student-search" className="text-sm font-medium">Rechercher un étudiant</label>
							<input id="student-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} className={`min-h-11 w-full max-w-md rounded-xl border border-[#d1d5db] bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20`} />
						</div>
						{all.length > 0 && (
							<ExportPanel
								url="/api/school/students/export"
								fields={exportFields(query.trim())}
								defaults={{ status: selected === "all" ? [] : [selected] }}
							/>
						)}
						<FilterChips
							label="Filtrer les étudiants par avancement"
							filters={filters.map(({ key, label }) => ({ key, label, count: matching.filter((student) => key === "all" || student.status === key).length }))}
							selected={selected}
							onSelect={setSelected}
						/>
						{visible.length === 0 ? (
							<p role="status" className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-5 text-sm text-[#6b7280]">{all.length === 0 ? "Aucun étudiant rattaché à votre école pour le moment." : "Aucun étudiant ne correspond."}</p>
						) : (
							<SchoolStudentsTable students={visible} sort={sort} onSort={setSort} />
						)}
					</>
				)}
			</section>
		</SchoolLayout>
	);
}
