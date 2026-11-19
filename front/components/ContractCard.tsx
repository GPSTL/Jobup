import { useState } from "react";
import { Link } from "react-router-dom";

import { CandidateAvatar } from "./CandidateIdentity";
import { Steps } from "../pages/ApplicationDetailPage";
import { advanceContract, type SchoolContract } from "../services/school";
import { fullName } from "../utils/candidates";
import { CONTRACT_ACTIONS, contractSteps } from "../utils/school";
import { focus } from "../utils/searchPageStyles";
import { REQUEST_ERRORS } from "../utils/validation";

// Passage d'un contrat à l'étape suivante : le contrat en cours d'enregistrement et l'erreur éventuelle
export function useAdvanceContract(onAdvanced: (contract: SchoolContract) => void) {
	const [saving, setSaving] = useState<number | null>(null);
	const [error, setError] = useState<{ id: number; message: string } | null>(null);
	const advance = async (contract: SchoolContract) => {
		if (saving !== null) return;
		setSaving(contract.id);
		setError(null);
		const result = await advanceContract(contract.id, contract.stage + 1);
		setSaving(null);
		if (result.ok) onAdvanced(result.data);
		else {
			const message = result.reason === "conflict" ? "Ce contrat a déjà changé d’étape. Actualisez la page." : REQUEST_ERRORS[result.reason === "unauthenticated" || result.reason === "network" ? result.reason : "server"];
			setError({ id: contract.id, message });
		}
	};
	return { advance, saving, error };
}

type ContractCardProps = {
	contract: SchoolContract;
	/** Fait passer le contrat à l'étape suivante */
	onAdvance: (contract: SchoolContract) => void;
	saving: boolean;
	error: string;
	/** Nom de l'étudiant et lien vers sa fiche, absents sur sa propre fiche */
	showStudent?: boolean;
};

// Contrat d'un étudiant avec sa frise d'avancement et, tant qu'il n'est pas signé, l'action de l'école
export default function ContractCard({ contract, onAdvance, saving, error, showStudent = true }: ContractCardProps) {
	const action = CONTRACT_ACTIONS[contract.stage];
	return (
		<li className="flex flex-col gap-4 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-5">
			<div className="flex flex-wrap items-center gap-4">
				{showStudent && <CandidateAvatar candidate={contract.student} className="size-11 text-base" />}
				<div className="min-w-0 flex-1 basis-40">
					{showStudent && (
						<h2 className="text-base font-semibold break-words">
							<Link to={`/school/students/${contract.student.id}`} className={`rounded-sm hover:underline ${focus}`}>{fullName(contract.student)}</Link>
						</h2>
					)}
					<p className={showStudent ? "text-xs sm:text-sm text-[#6b7280]" : "text-base font-semibold"}>{contract.offer_title} • {contract.company}</p>
				</div>
				{action && (
					<button type="button" onClick={() => onAdvance(contract)} disabled={saving} className={`cursor-pointer rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60 ${focus}`}>
						{action}<span className="sr-only"> : {fullName(contract.student)}</span>
					</button>
				)}
			</div>
			<Steps steps={contractSteps(contract)} />
			{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
		</li>
	);
}
