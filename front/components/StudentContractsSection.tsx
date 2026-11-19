import { Link } from "react-router-dom";

import ContractDocument from "./ContractDocument";
import { SchoolRequestState, useSchoolData } from "./SchoolLayout";
import { getStudentContracts } from "../services/school";
import { CONTRACT_STAGE } from "../utils/school";
import { focus } from "../utils/searchPageStyles";

const STAGE_LABELS: Record<number, string> = {
	[CONTRACT_STAGE.DEPOSITED]: "En attente de validation par l’école",
	[CONTRACT_STAGE.VALIDATED]: "Validé par l’école",
	[CONTRACT_STAGE.SIGNED]: "Signé",
};

// Section « Mon contrat » de « Mon espace » (JOB-045) : le contrat déposé par l'entreprise
export default function StudentContractsSection() {
	const { result, retry } = useSchoolData(getStudentContracts);
	return (
		<section id="contract" aria-labelledby="student-contract" className="flex scroll-mt-6 flex-col gap-3 rounded-2xl border border-[#e5e7eb] bg-surface p-5 shadow-xs sm:p-6">
			<h2 id="student-contract" className="text-lg font-semibold">Mon contrat</h2>
			<SchoolRequestState result={result} retry={retry} />
			{result?.ok && result.data.length === 0 && <p className="text-sm text-[#6b7280]">Aucun contrat pour l’instant : l’entreprise le dépose une fois votre candidature acceptée.</p>}
			{result?.ok && result.data.length > 0 && (
				<ul className="flex flex-col gap-4">
					{result.data.map((contract) => (
						<li key={contract.id} className="flex flex-col gap-2">
							<p className="text-sm font-semibold sm:text-base">
								{contract.application_id ? (
									<Link to={`/applications/${contract.application_id}`} className={`rounded-sm hover:underline ${focus}`}>{contract.offer_title}</Link>
								) : (
									contract.offer_title
								)}{" "}
								• {contract.company}
							</p>
							<p className="text-xs text-[#6b7280] sm:text-sm">{STAGE_LABELS[contract.stage]}</p>
							<ContractDocument contract={contract} />
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
