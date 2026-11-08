// Shared account roles; the home page uses plural labels and a different order.
export const ROLES = [
	{ label: "Étudiant", homeLabel: "Étudiants", value: "student", apiName: "Student", homePath: "/students", homeOrder: 0 },
	{ label: "Entreprise", homeLabel: "Entreprises", value: "recruiter", apiName: "Recruiter", homePath: "/signup?role=recruiter", homeOrder: 2 },
	{ label: "École", homeLabel: "Écoles", value: "school", apiName: "School Manager", homePath: "/schools", homeOrder: 1 },
] as const;

export type Role = (typeof ROLES)[number]["value"];
export type RoleApiName = (typeof ROLES)[number]["apiName"];

export const getRole = (value: string | null): Role =>
	ROLES.find((role) => role.value === value)?.value ?? "student";

export const getRoleApiName = (value: Role): RoleApiName =>
    ROLES.find((role) => role.value === value)?.apiName ?? "Student";
