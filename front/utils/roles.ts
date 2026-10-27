// Shared account roles; the home page uses plural labels and a different order.
export const ROLES = [
	{ label: "Étudiant", homeLabel: "Étudiants", value: "student", homePath: "/students", homeOrder: 0 },
	{ label: "Entreprise", homeLabel: "Entreprises", value: "recruiter", homePath: "/signup?role=recruiter", homeOrder: 2 },
	{ label: "École", homeLabel: "Écoles", value: "school", homePath: "/schools", homeOrder: 1 },
] as const;

export type Role = (typeof ROLES)[number]["value"];

export const getRole = (value: string | null): Role =>
	ROLES.find((role) => role.value === value)?.value ?? "student";
