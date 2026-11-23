import AdminOrganizationsList, { type OrganizationColumn } from "../components/AdminOrganizationsList";
import type { AdminSchool } from "../services/adminOrganizations";

export const SCHOOL_COLUMNS: OrganizationColumn<AdminSchool>[] = [
	{ column: "name", label: "École", cell: (school) => school.name },
	{ column: "students", label: "Étudiants", cell: (school) => school.students },
	{ column: "managers", label: "Managers", cell: (school) => school.managers },
];

// Schools to validate or refuse, and to take back later
export default function AdminSchoolsPage() {
	return (
		<AdminOrganizationsList
			kind="schools"
			title="Écoles"
			description="Validez ou refusez les écoles inscrites sur la plateforme. Vous pouvez revenir sur votre choix à tout moment."
			columns={SCHOOL_COLUMNS}
			noun={["école", "écoles"]}
			search={{ name: "écoles", label: "Rechercher une école par nom", placeholder: "Rechercher par nom…" }}
			empty="Aucune école inscrite pour le moment."
			noMatch="Aucune école ne correspond à votre recherche."
		/>
	);
}
