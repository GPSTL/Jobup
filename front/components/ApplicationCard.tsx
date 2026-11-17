import { Link } from "react-router-dom";

import ApplicationStatusChip from "./ApplicationStatusChip";
import type { ApplicationSummary } from "../services/applications";
import { cardDates, companyInitials, STATUS } from "../utils/applications";
import { focus } from "../utils/searchPageStyles";

// Carte d'une candidature : un brouillon se reprend, les autres s'ouvrent sur leur détail
export default function ApplicationCard({ application }: { application: ApplicationSummary }) {
	const isDraft = application.status === STATUS.DRAFT;
	const title = application.offer.title;

	return (
		<li className="group relative flex flex-col gap-3 rounded-2xl border border-[#e5e7eb] bg-surface p-4 shadow-2xs motion-safe:transition-all motion-safe:duration-200 hover:border-primary hover:shadow-md">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#dbeafe] text-xs font-bold text-[#1d4ed8]">
						{companyInitials(application.company)}
					</span>
					<div className="min-w-0">
						<h3 className="truncate text-base font-bold text-ink">{title}</h3>
						<p className="truncate text-xs sm:text-sm text-[#6b7280]">{application.company}</p>
					</div>
				</div>
				<ApplicationStatusChip status={application.status} />
			</div>

			<div className="flex flex-wrap items-center justify-between gap-x-3 border-t border-[#e5e7eb] pt-3">
				<p className="text-xs text-[#6b7280]">{cardDates(application)}</p>
				{/* Le lien s'étend à toute la carte (after:) : un clic n'importe où ouvre la candidature, pour un seul arrêt au clavier */}
				<Link
					to={isDraft ? `/applications/${application.id}/edit` : `/applications/${application.id}`}
					aria-label={`${isDraft ? "Reprendre" : "Voir le détail"} : ${title}`}
					className={`ml-auto flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs sm:text-sm font-semibold text-primary after:absolute after:inset-0 after:rounded-2xl ${focus}`}
				>
					{isDraft ? (
						<>
							<img src="/static/img/applications/edit.svg" width={16} height={16} alt="" />
							Reprendre
						</>
					) : (
						<>
							Voir le détail
							<img src="/static/img/applications/arrow.svg" width={16} height={16} alt="" className="motion-safe:transition-transform group-hover:translate-x-0.5" />
						</>
					)}
				</Link>
			</div>
		</li>
	);
}
