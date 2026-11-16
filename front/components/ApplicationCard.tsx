import { Link } from "react-router-dom";

import ApplicationStatusChip from "./ApplicationStatusChip";
import type { ApplicationSummary } from "../services/applications";
import { cardDates, STATUS } from "../utils/applications";
import { focus } from "../utils/searchPageStyles";

// Carte d'une candidature : un brouillon se reprend, les autres s'ouvrent sur leur détail
export default function ApplicationCard({ application }: { application: ApplicationSummary }) {
	const isDraft = application.status === STATUS.DRAFT;
	const title = application.offer.title;

	return (
		<li className="relative flex flex-col gap-1.5 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] px-[18px] py-4">
			<div className="flex items-center justify-between gap-3">
				<h3 className="min-w-0 text-[17px] font-semibold text-[#111827]">{title}</h3>
				<ApplicationStatusChip status={application.status} />
			</div>
			<p className="text-[14px] text-[#6b7280]">{application.company}</p>
			<div className="flex flex-wrap items-center justify-between gap-x-3">
				<p className="text-[13px] text-[#9ca3af]">{cardDates(application)}</p>
				{/* Le lien s'étend à toute la carte (after:) : un clic n'importe où ouvre la candidature, pour un seul arrêt au clavier */}
				<Link
					to={isDraft ? `/applications/${application.id}/edit` : `/applications/${application.id}`}
					aria-label={`${isDraft ? "Reprendre" : "Voir le détail"} : ${title}`}
					className={`ml-auto flex items-center gap-2 rounded-[14px] px-1 py-3.5 text-[16px] font-semibold text-primary after:absolute after:inset-0 after:rounded-2xl ${focus}`}
				>
					{isDraft ? (
						<>
							<img src="/static/img/applications/edit.svg" width={18} height={18} alt="" />
							Reprendre
						</>
					) : (
						<>
							Voir le détail
							<img src="/static/img/applications/arrow.svg" width={18} height={18} alt="" />
						</>
					)}
				</Link>
			</div>
		</li>
	);
}
