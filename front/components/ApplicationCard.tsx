import { Link } from "react-router-dom";

import ApplicationStatusChip from "./ApplicationStatusChip";
import CalendarIcon from "./CalendarIcon";
import { SelectCheckbox, type Selection } from "./ExportSelection";
import type { ApplicationSummary } from "../services/applications";
import type { Interview } from "../services/interviews";
import { cardDates, companyInitials, STATUS } from "../utils/applications";
import { interviewSummary } from "../utils/interviews";
import { focus } from "../utils/searchPageStyles";

type ApplicationCardProps = {
	application: ApplicationSummary;
	/** Entretien proposé par le recruteur (colonne « Entretiens ») */
	interview?: Interview;
	/** Candidatures cochées pour l'export ; sans elle, la carte n'a pas de case */
	selection?: Selection;
};

// Carte d'une candidature : un brouillon se reprend, les autres s'ouvrent sur leur détail
export default function ApplicationCard({ application, interview, selection }: ApplicationCardProps) {
	const isDraft = application.status === STATUS.DRAFT;
	const title = application.offer.title;
	const toChoose = interview && !interview.confirmed_slot && interview.available_count > 0;
	const action = isDraft ? "Reprendre" : interview ? (toChoose ? "Choisir un créneau" : "Voir l’entretien") : "Voir le détail";

	return (
		<li className={`group relative flex flex-col gap-3 rounded-2xl border bg-surface p-4 shadow-2xs motion-safe:transition-all motion-safe:duration-200 hover:border-primary hover:shadow-md ${selection?.ids.includes(application.id) ? "border-primary" : "border-[#e5e7eb]"}`}>
			{/* La pastille passe sous le titre quand la colonne est étroite (trois colonnes) */}
			<div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
				<div className="flex min-w-0 flex-1 basis-[190px] items-center gap-3">
					{/* Au-dessus du lien étendu à toute la carte, pour rester cliquable */}
					{selection && <SelectCheckbox id={application.id} selection={selection} label={`Sélectionner la candidature ${title} pour l’export`} className="relative z-10" />}
					<span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#dbeafe] text-xs font-bold text-[#1d4ed8]">
						{companyInitials(application.company)}
					</span>
					<div className="min-w-0">
						<h3 className="line-clamp-2 text-base font-bold break-words text-ink">{title}</h3>
						<p className="truncate text-xs sm:text-sm text-[#6b7280]">{application.company}</p>
					</div>
				</div>
				<ApplicationStatusChip status={application.status} />
			</div>

			{interview && (
				<p className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium ${interview.confirmed_slot ? "bg-[#dcfce7] text-[#166534]" : "bg-[#eff6ff] text-[#1d4ed8]"}`}>
					<CalendarIcon width={16} height={16} className="shrink-0" />
					{interviewSummary(interview)}
				</p>
			)}

			<div className="flex flex-wrap items-center justify-between gap-x-3 border-t border-[#e5e7eb] pt-3">
				<p className="text-xs text-[#6b7280]">{cardDates(application)}</p>
				{/* Le lien s'étend à toute la carte (after:) : un clic n'importe où ouvre la candidature, pour un seul arrêt au clavier */}
				<Link
					to={isDraft ? `/applications/${application.id}/edit` : `/applications/${application.id}`}
					aria-label={`${action} : ${title}`}
					className={`ml-auto flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs sm:text-sm font-semibold text-primary after:absolute after:inset-0 after:rounded-2xl ${focus}`}
				>
					{isDraft ? (
						<>
							<img src="/static/img/applications/edit.svg" width={16} height={16} alt="" />
							Reprendre
						</>
					) : (
						<>
							{action}
							<img src="/static/img/applications/arrow.svg" width={16} height={16} alt="" className="motion-safe:transition-transform group-hover:translate-x-0.5" />
						</>
					)}
				</Link>
			</div>
		</li>
	);
}
