import { useState } from "react";

import ContractCard, { useAdvanceContract } from "../components/ContractCard";
import { FilterChips, schoolPanel, SchoolLayout, SchoolRequestState, useSchoolData } from "../components/SchoolLayout";
import { getSchoolContracts } from "../services/school";
import { CONTRACT_STAGE } from "../utils/school";

const filters = [
	{ key: "all", label: "Tous", stage: 0 },
	{ key: "deposited", label: "À valider", stage: CONTRACT_STAGE.DEPOSITED },
	{ key: "validated", label: "À signer", stage: CONTRACT_STAGE.VALIDATED },
	{ key: "signed", label: "Signés", stage: CONTRACT_STAGE.SIGNED },
];

// Contrats déposés par les entreprises pour les étudiants de l'école : l'école les valide puis les marque signés
export default function SchoolContractsPage() {
	const { result, retry, setData } = useSchoolData(getSchoolContracts);
	const [selected, setSelected] = useState("all");
	const { advance, saving, error } = useAdvanceContract((updated) => {
		if (result?.ok) setData(result.data.map((contract) => (contract.id === updated.id ? updated : contract)));
	});

	const contracts = result?.ok ? result.data : [];
	const stage = filters.find((filter) => filter.key === selected)?.stage ?? 0;
	const visible = contracts.filter((contract) => stage === 0 || contract.stage === stage);

	return (
		<SchoolLayout>
			<section className={schoolPanel}>
				<header className="flex flex-col gap-1">
					<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Contrats</h1>
					<p className="text-sm text-[#6b7280]">Validez les contrats déposés par les entreprises, puis marquez-les signés : vos étudiants en suivent l’avancement.</p>
				</header>
				<SchoolRequestState result={result} retry={retry} />
				{result?.ok && (
					<>
						<FilterChips
							label="Filtrer les contrats par étape"
							filters={filters.map(({ key, label, stage }) => ({ key, label, count: contracts.filter((contract) => stage === 0 || contract.stage === stage).length }))}
							selected={selected}
							onSelect={setSelected}
						/>
						{visible.length === 0 ? (
							<p role="status" className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-5 text-sm text-[#6b7280]">{contracts.length === 0 ? "Aucun contrat déposé pour le moment." : "Aucun contrat à cette étape."}</p>
						) : (
							<ul aria-label="Contrats des étudiants" className="flex flex-col gap-3">
								{visible.map((contract) => (
									<ContractCard key={contract.id} contract={contract} onAdvance={advance} saving={saving === contract.id} error={error?.id === contract.id ? error.message : ""} />
								))}
							</ul>
						)}
					</>
				)}
			</section>
		</SchoolLayout>
	);
}
