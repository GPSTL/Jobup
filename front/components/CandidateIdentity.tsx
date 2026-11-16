import { useState } from "react";

import type { CandidateSummary } from "../services/candidates";
import { initials } from "../utils/candidates";

type CandidateAvatarProps = {
	candidate: Pick<CandidateSummary, "first_name" | "last_name" | "photo_url">;
	/** Size of the circle and of the initials, e.g. "size-24 text-[32px]" */
	className: string;
};

// Photo of the candidate, or their initials when there is no photo or it does not load.
// Decorative: the name of the candidate is always written next to it.
export function CandidateAvatar({ candidate, className }: CandidateAvatarProps) {
	// Photo that failed to load: a candidate shown afterwards with another photo still gets theirs
	const [failedUrl, setFailedUrl] = useState<string | null>(null);
	const photoUrl = candidate.photo_url;

	if (photoUrl && photoUrl !== failedUrl) {
		return <img src={photoUrl} alt="" onError={() => setFailedUrl(photoUrl)} className={`shrink-0 rounded-full object-cover ${className}`} />;
	}
	return (
		<div aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full bg-[#7c3aed] font-bold text-white ${className}`}>
			{initials(candidate)}
		</div>
	);
}

// "Master MIAGE — Université Paris Nanterre". The card has to show the school (REC-01), so a missing one is stated.
export function EducationLine({ candidate }: { candidate: Pick<CandidateSummary, "education" | "school"> }) {
	return (
		<>
			{candidate.education && `${candidate.education} — `}
			{candidate.school ?? <span className="text-[#6b7280]">École non renseignée</span>}
		</>
	);
}
