import { Link, Navigate, useLocation } from "react-router-dom";

import ApplicationLoader from "../components/ApplicationLoader";
import ApplicationsLayout, { BackToApplications } from "../components/ApplicationsLayout";
import ApplicationStatusChip from "../components/ApplicationStatusChip";
import ContractDocument from "../components/ContractDocument";
import StudentInterviewSection from "../components/StudentInterviewSection";
import type { ApplicationDetail } from "../services/applications";
import { applicationSteps, companyInitials, sentDate, STATUS, type ApplicationStep } from "../utils/applications";
import { contractSteps } from "../utils/school";
import { focus } from "../utils/searchPageStyles";

const sectionTitle = "text-lg font-semibold";

export function Steps({ steps }: { steps: ApplicationStep[] }) {
	return (
		<ol className="flex flex-col gap-3 md:flex-row md:items-center">
			{steps.map((step, index) => {
				const next = steps[index + 1];
				return (
					<li key={step.label} className={`flex items-center gap-3 ${next ? "md:flex-1" : ""}`}>
						<div className="flex shrink-0 items-center gap-2.5">
							{step.done ? (
								<span className="flex size-8 items-center justify-center rounded-full border-2 border-primary bg-primary">
									<img src="/static/img/applications/check.svg" width={16} height={16} alt="" />
									<span className="sr-only">Étape franchie :</span>
								</span>
							) : (
								<span className="flex size-8 items-center justify-center rounded-full border-2 border-[#d1d5db] bg-surface text-xs font-semibold text-[#6b7280]">
									{index + 1}
								</span>
							)}
							<div className="flex flex-col gap-0.5">
								<p className={`text-sm font-semibold ${step.done ? "text-ink" : "text-[#6b7280]"}`}>{step.label}</p>
								{step.detail && <p className="text-xs text-[#6b7280]">{step.detail}</p>}
							</div>
						</div>
						{/* Le trait est bleu quand l'étape suivante est franchie (maquette) */}
						{next && <div aria-hidden="true" className={`hidden h-0.5 flex-1 md:block ${next.done ? "bg-primary" : "bg-[#d1d5db]"}`} />}
					</li>
				);
			})}
		</ol>
	);
}

function SentDocument({ label, downloadLabel, url }: { label: string; downloadLabel: string; url: string }) {
	return (
		<div className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3.5">
			<img src="/static/img/applications/file.svg" width={22} height={22} alt="" />
			<p className="min-w-0 flex-1 text-sm sm:text-base font-semibold">{label}</p>
			<a
				href={url}
				download
				aria-label={downloadLabel}
				className={`flex items-center gap-2 rounded-xl border border-[#d1d5db] bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-[#f9fafb] ${focus}`}
			>
				<img src="/static/img/applications/download.svg" width={16} height={16} alt="" />
				Télécharger
			</a>
		</div>
	);
}

type ApplicationDetailViewProps = {
	application: ApplicationDetail;
	/** Vrai juste après « Confirmer ma candidature » */
	submitted?: boolean;
};

export function ApplicationDetailView({ application, submitted = false }: ApplicationDetailViewProps) {
	const { resume, cover_letter: coverLetter } = application.documents;
	const subtitle = [application.company, sentDate(application)].filter(Boolean).join(" • ");
	// Entretien à choisir pendant l'étude de la candidature ; une fois acceptée, le créneau retenu reste affiché
	const { interview } = application;
	const underReview = application.status === STATUS.READ || application.status === STATUS.IN_REVIEW;
	const showInterview = interview && (underReview || (application.status === STATUS.ACCEPTED && interview.confirmed_slot));

	return (
		<ApplicationsLayout className="max-w-[1000px] gap-5 px-5 py-7 md:px-10 md:py-8">
			<BackToApplications />
			{submitted && (
				<p role="status" className="rounded-xl bg-[#dcfce7] px-4 py-3.5 text-sm font-semibold text-[#16803d]">
					Candidature envoyée ! Elle a bien été transmise au recruteur.
				</p>
			)}

			<div className="flex flex-wrap items-center gap-4">
				<div aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#10b981] text-xl font-bold text-white">
					{companyInitials(application.company)}
				</div>
				{/* basis : sur téléphone, la pastille passe à la ligne au lieu d'écraser le titre */}
				<div className="flex min-w-0 flex-1 basis-[180px] flex-col gap-0.5">
					<h1 className="text-2xl font-bold tracking-tight">{application.offer.title}</h1>
					<p className="text-sm text-[#6b7280]">{subtitle}</p>
				</div>
				<ApplicationStatusChip status={application.status} />
			</div>

			{showInterview && <StudentInterviewSection key={interview.id} applicationId={application.id} interview={interview} readOnly={!underReview} />}

			<h2 className={sectionTitle}>Suivi</h2>
			<Steps steps={applicationSteps(application)} />

			{application.status === STATUS.ACCEPTED && (
				<section aria-labelledby="contract-tracking" className="flex flex-col gap-5">
					<h2 id="contract-tracking" className={sectionTitle}>Suivi du contrat</h2>
					<Steps steps={contractSteps(application.contract, application.updated_at)} />
					{application.contract && <ContractDocument contract={application.contract} />}
					{application.school === null ? (
						<p className="text-sm text-[#6b7280]">Votre école n’est pas renseignée : <Link to="/student#school" className={`font-semibold text-primary hover:underline ${focus}`}>indiquez-la dans Mon espace</Link> pour que votre contrat soit suivi.</p>
					) : !application.contract && (
						<p className="text-sm text-[#6b7280]">L’entreprise doit déposer le contrat ; {application.school} le validera ensuite.</p>
					)}
				</section>
			)}

			<h2 className={sectionTitle}>Documents envoyés</h2>
			{resume && <SentDocument label="CV" downloadLabel="Télécharger le CV" url={resume} />}
			{coverLetter && <SentDocument label="Lettre de motivation" downloadLabel="Télécharger la lettre de motivation" url={coverLetter} />}

			{application.decision_message && (application.status === STATUS.ACCEPTED || application.status === STATUS.REFUSED) && (
				<section aria-label="Réponse du recruteur" className="flex flex-col gap-2">
					<h2 className={sectionTitle}>Message du recruteur</h2>
					<p className="whitespace-pre-line text-sm sm:text-base text-[#6b7280]">{application.decision_message}</p>
				</section>
			)}

			{application.message && (
				<>
					<h2 className={sectionTitle}>Présentation envoyée</h2>
					<p className="text-sm sm:text-base whitespace-pre-line text-[#6b7280]">{application.message}</p>
				</>
			)}
		</ApplicationsLayout>
	);
}

// Détail d'une candidature envoyée (JOB-033, ETU-14). Un brouillon n'a rien d'envoyé à montrer : il s'ouvre en reprise.
export default function ApplicationDetailPage() {
	const submitted = useLocation().state?.submitted === true;
	return (
		<ApplicationLoader>
			{(application) =>
				application.status === STATUS.DRAFT ? (
					<Navigate to={`/applications/${application.id}/edit`} replace />
				) : (
					<ApplicationDetailView application={application} submitted={submitted} />
				)
			}
		</ApplicationLoader>
	);
}
