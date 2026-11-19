import { useState } from "react";
import { Link } from "react-router-dom";

import { CandidateAvatar } from "../components/CandidateIdentity";
import { FilterChips, schoolPanel, SchoolLayout, SchoolRequestState, useSchoolData } from "../components/SchoolLayout";
import { decideSchoolRequest, getSchoolRequests, getSchoolStudents, type StudentStatus } from "../services/school";
import { formatDate } from "../utils/applications";
import { fullName } from "../utils/candidates";
import { STUDENT_STATUS } from "../utils/school";
import { focus } from "../utils/searchPageStyles";
import { REQUEST_ERRORS } from "../utils/validation";

const filters: { key: "all" | StudentStatus; label: string }[] = [
	{ key: "all", label: "Tous" },
	...(Object.entries(STUDENT_STATUS) as [StudentStatus, { label: string }][]).map(([key, { label }]) => ({ key, label })),
];

// Étudiants de l'école et demandes de rattachement à valider (ETU : « Mon école » dans leur espace)
export default function SchoolStudentsPage() {
	const students = useSchoolData(getSchoolStudents);
	const requests = useSchoolData(getSchoolRequests);
	const [selected, setSelected] = useState<"all" | StudentStatus>("all");
	const [query, setQuery] = useState("");
	// Demande en cours de décision, et message d'échec
	const [deciding, setDeciding] = useState<number | null>(null);
	const [error, setError] = useState("");

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
						<FilterChips
							label="Filtrer les étudiants par avancement"
							filters={filters.map(({ key, label }) => ({ key, label, count: matching.filter((student) => key === "all" || student.status === key).length }))}
							selected={selected}
							onSelect={setSelected}
						/>
						{visible.length === 0 ? (
							<p role="status" className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-5 text-sm text-[#6b7280]">{all.length === 0 ? "Aucun étudiant rattaché à votre école pour le moment." : "Aucun étudiant ne correspond."}</p>
						) : (
							<ul aria-label="Étudiants de l’école" className="flex flex-col gap-2.5">
								{visible.map((student) => (
									<li key={student.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] px-5 py-3.5">
										<CandidateAvatar candidate={student} className="size-11 text-base" />
										<div className="min-w-0 flex-1 basis-40">
											<h2 className="text-base font-semibold break-words">{fullName(student)}</h2>
											<p className="text-xs sm:text-sm text-[#6b7280]">{student.application_count} candidature{student.application_count === 1 ? "" : "s"} envoyée{student.application_count === 1 ? "" : "s"}</p>
										</div>
										<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STUDENT_STATUS[student.status].className}`}>{STUDENT_STATUS[student.status].label}</span>
										<Link to={`/school/students/${student.id}`} className={`text-sm font-semibold text-primary hover:underline ${focus}`}>Voir le suivi<span className="sr-only"> de {fullName(student)}</span></Link>
									</li>
								))}
							</ul>
						)}
					</>
				)}
			</section>
		</SchoolLayout>
	);
}
