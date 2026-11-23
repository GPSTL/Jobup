import AdminOrganizationsList, { type OrganizationColumn } from "../components/AdminOrganizationsList";
import type { AdminCompany } from "../services/adminOrganizations";

const muted = (text: string) => <span className="text-[#9ca3af]">{text}</span>;

export const COMPANY_COLUMNS: OrganizationColumn<AdminCompany>[] = [
	{ column: "name", label: "Entreprise", cell: (company) => company.name },
	{ label: "SIRET", cell: (company) => <span className="whitespace-nowrap tabular-nums">{company.siret}</span> },
	{ column: "city", label: "Ville", cell: (company) => company.city || muted("Non renseignée") },
	{ column: "recruiters", label: "Recruteurs", cell: (company) => company.recruiters },
];

// Companies to validate or refuse, and to take back later
export default function AdminCompaniesPage() {
	return (
		<AdminOrganizationsList
			kind="companies"
			title="Entreprises"
			description="Validez ou refusez les entreprises inscrites sur la plateforme. Vous pouvez revenir sur votre choix à tout moment."
			columns={COMPANY_COLUMNS}
			noun={["entreprise", "entreprises"]}
			search={{ name: "entreprises", label: "Rechercher une entreprise par nom, SIRET ou ville", placeholder: "Rechercher par nom, SIRET ou ville…" }}
			empty="Aucune entreprise inscrite pour le moment."
			noMatch="Aucune entreprise ne correspond à votre recherche."
		/>
	);
}
