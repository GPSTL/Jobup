import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Button from "../components/Button";
import { CandidateAvatar } from "../components/CandidateIdentity";
import ContractCard, { useAdvanceContract } from "../components/ContractCard";
import { schoolPanel, SchoolLayout, SchoolRequestState, useSchoolData } from "../components/SchoolLayout";
import { getSchoolStudent, startSchoolConversation } from "../services/school";
import { formatDate, statusChip } from "../utils/applications";
import { fullName } from "../utils/candidates";
import { STUDENT_STATUS } from "../utils/school";
import { focus } from "../utils/searchPageStyles";
import { REQUEST_ERRORS } from "../utils/validation";

const sectionTitle = "text-lg font-semibold";

// Suivi d'un étudiant de l'école : ses candidatures envoyées et l'avancement de son contrat
export default function SchoolStudentPage() {
	const { id = "" } = useParams();
	const navigate = useNavigate();
	const load = useCallback(() => getSchoolStudent(id), [id]);
	const { result, retry, setData } = useSchoolData(load);
	const [starting, setStarting] = useState(false);
	const [error, setError] = useState("");
	const advancing = useAdvanceContract((updated) => {
		if (result?.ok) setData({ ...result.data, contracts: result.data.contracts.map((contract) => (contract.id === updated.id ? updated : contract)) });
	});

	const write = async (studentId: number) => {
		if (starting) return;
		setStarting(true);
		setError("");
		const started = await startSchoolConversation(studentId);
		setStarting(false);
		if (started.ok) navigate(`/school/messages/${started.data.id}`);
		else setError(REQUEST_ERRORS[started.reason === "unauthenticated" || started.reason === "network" ? started.reason : "server"]);
	};

	const student = result?.ok ? result.data : null;
	return (
		<SchoolLayout>
			<section className={schoolPanel}>
				<Link to="/school/students" className={`w-fit text-sm font-semibold text-primary hover:underline ${focus}`}>← Retour aux étudiants</Link>
				<SchoolRequestState result={result} retry={retry} />
				{student && (
					<>
						<div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
							<CandidateAvatar candidate={student} className="size-14 text-lg" />
							<h1 className="min-w-0 flex-1 basis-40 text-2xl font-bold tracking-tight break-words">{fullName(student)}</h1>
							<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STUDENT_STATUS[student.status].className}`}>{STUDENT_STATUS[student.status].label}</span>
							{student.conversation_id ? (
								<Button to={`/school/messages/${student.conversation_id}`} variant="outline">Ouvrir la conversation</Button>
							) : (
								<Button onClick={() => write(student.id)} disabled={starting}>Écrire à l’étudiant</Button>
							)}
						</div>
						{error && <p role="alert" className="text-sm text-red-700">{error}</p>}

						<h2 className={sectionTitle}>Suivi du contrat</h2>
						{student.contracts.length === 0 ? (
							<p className="text-sm text-[#6b7280]">Aucun contrat déposé pour le moment.</p>
						) : (
							<ul className="flex flex-col gap-3">
								{student.contracts.map((contract) => (
									<ContractCard key={contract.id} contract={contract} onAdvance={advancing.advance} saving={advancing.saving === contract.id} error={advancing.error?.id === contract.id ? advancing.error.message : ""} showStudent={false} />
								))}
							</ul>
						)}

						<h2 className={sectionTitle}>Candidatures envoyées</h2>
						{student.applications.length === 0 ? (
							<p className="text-sm text-[#6b7280]">Aucune candidature envoyée pour le moment.</p>
						) : (
							<ul className="flex flex-col gap-2.5">
								{student.applications.map((application) => (
									<li key={application.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] px-5 py-3.5">
										<div className="min-w-0 flex-1 basis-40">
											<h3 className="text-base font-semibold break-words">{application.offer_title}</h3>
											<p className="text-xs sm:text-sm text-[#6b7280]">{application.company} • Envoyée le <time dateTime={application.submitted_at}>{formatDate(application.submitted_at)}</time></p>
										</div>
										<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusChip(application.status).className}`}>{statusChip(application.status).label}</span>
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
