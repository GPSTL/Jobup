import type { Profile } from "../services/profile";
import { completion } from "../utils/profileDetails";

type ProfileCompletionProps = {
	profile: Profile;
	/** null tant que le CV n'est pas chargé : il ne compte pas encore */
	hasCv: boolean | null;
};

// « Profil complété à 70 % » (JOB-071), et ce qu'il reste à remplir
export default function ProfileCompletion({ profile, hasCv }: ProfileCompletionProps) {
	const { percent, missing } = completion(profile, hasCv === true);
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-center justify-between gap-3 text-sm">
				<span id="profile-completion" className="font-semibold">
					Profil complété à {percent} %
				</span>
			</div>
			<div role="progressbar" aria-labelledby="profile-completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-[#e5e7eb]">
				<div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
			</div>
			<p className="text-sm text-[#6c7386]">
				{missing.length === 0 ? "Votre profil est complet : les recruteurs voient tout ce qui les aide à vous choisir." : `À compléter : ${missing.join(", ")}.`}
			</p>
		</div>
	);
}
