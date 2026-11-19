import type { ContractProgress } from "../services/school";
import { contractPeriod } from "../utils/contracts";
import { focus } from "../utils/searchPageStyles";

// PDF du contrat (JOB-045) et dates de l'alternance, pour le recruteur, l'étudiant et l'école.
// Le serveur vérifie l'accès à chaque téléchargement.
export default function ContractDocument({ contract }: { contract: ContractProgress }) {
	const period = contractPeriod(contract);
	if (!contract.file_url) return period ? <p className="text-sm text-[#6b7280]">{period}</p> : null;
	return (
		<div className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-[#e5e7eb] bg-surface px-4 py-3.5">
			<img src="/static/img/applications/file.svg" width={22} height={22} alt="" />
			<div className="min-w-0 flex-1 basis-40">
				<p className="text-sm font-semibold break-words sm:text-base">{contract.file_name}</p>
				{period && <p className="text-xs text-[#6b7280] sm:text-sm">{period}</p>}
			</div>
			<a
				href={contract.file_url}
				download
				className={`flex items-center gap-2 rounded-xl border border-[#d1d5db] bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-[#f9fafb] ${focus}`}
			>
				<img src="/static/img/applications/download.svg" width={16} height={16} alt="" />
				Télécharger le contrat
			</a>
		</div>
	);
}
