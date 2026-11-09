import { Navigate, useLocation } from "react-router-dom";

import ApplicationLoader from "../components/ApplicationLoader";
import ApplicationsLayout, { BackToApplications } from "../components/ApplicationsLayout";
import ApplicationStatusChip from "../components/ApplicationStatusChip";
import type { ApplicationDetail } from "../services/applications";
import { applicationSteps, companyInitials, sentDate, STATUS, type ApplicationStep } from "../utils/applications";
import { focus } from "../utils/searchPageStyles";

const sectionTitle = "text-[20px] font-semibold";

function Steps({ steps }: { steps: ApplicationStep[] }) {
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
								<span className="flex size-8 items-center justify-center rounded-full border-2 border-[#d1d5db] bg-white text-[14px] font-semibold text-[#6b7280]">
									{index + 1}
								</span>
							)}
							<div className="flex flex-col gap-0.5">
								<p className={`text-[16px] font-semibold ${step.done ? "text-[#111827]" : "text-[#6b7280]"}`}>{step.label}</p>
								{step.detail && <p className="text-[13px] text-[#6b7280]">{step.detail}</p>}
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
		<div className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] px-[18px] py-4">
			<img src="/static/img/applications/file.svg" width={24} height={24} alt="" />
			<p className="min-w-0 flex-1 text-[16px] font-semibold">{label}</p>
			<a
				href={url}
				download
				aria-label={downloadLabel}
				className={`flex items-center gap-2 rounded-[14px] border border-[#d1d5db] bg-white px-[22px] py-3.5 text-[16px] font-semibold text-[#111827] ${focus}`}
			>
				<img src="/static/img/applications/download.svg" width={18} height={18} alt="" />
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

	return (
		<ApplicationsLayout className="max-w-[1000px] gap-5 px-4 pt-8 pb-9 md:px-10">
			<BackToApplications />
			{submitted && (
				<p role="status" className="rounded-2xl bg-[#dcfce7] px-[18px] py-4 text-[16px] font-semibold text-[#16803d]">
					Candidature envoyée ! Elle a bien été transmise au recruteur.
				</p>
			)}

			<div className="flex flex-wrap items-center gap-4">
				<div aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-[18px] bg-[#10b981] text-[23px] font-bold text-white">
					{companyInitials(application.company)}
				</div>
				{/* basis : sur téléphone, la pastille passe à la ligne au lieu d'écraser le titre */}
				<div className="flex min-w-0 flex-1 basis-[180px] flex-col gap-1">
					<h1 className="text-[28px] font-semibold">{application.offer.title}</h1>
					<p className="text-[15px] text-[#6b7280]">{subtitle}</p>
				</div>
				<ApplicationStatusChip status={application.status} />
			</div>

			<h2 className={sectionTitle}>Suivi</h2>
			<Steps steps={applicationSteps(application)} />

			<h2 className={sectionTitle}>Documents envoyés</h2>
			{resume && <SentDocument label="CV" downloadLabel="Télécharger le CV" url={resume} />}
			{coverLetter && <SentDocument label="Lettre de motivation" downloadLabel="Télécharger la lettre de motivation" url={coverLetter} />}

			{application.message && (
				<>
					<h2 className={sectionTitle}>Présentation envoyée</h2>
					<p className="text-[16px] whitespace-pre-line text-[#6b7280]">{application.message}</p>
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
