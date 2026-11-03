// Affichage des entreprises (JOB-021) : libellés des secteurs, initiales, effectif et site web.

// Libellés français des valeurs de JobCategory (jobup/models.py)
export const SECTORS: Record<number, string> = {
	1: "Informatique",
	2: "Data et intelligence artificielle",
	3: "Cybersécurité",
	4: "Business et stratégie",
	5: "Management et administration",
	6: "Gestion de projet et produit",
	7: "Ingénierie",
	8: "Biotechnologies et sciences appliquées",
	9: "Énergie et environnement",
	10: "Marketing et croissance",
	11: "Vente et développement commercial",
	12: "Communication et relations publiques",
	13: "Finance et comptabilité",
	14: "Banque et assurance",
	15: "Juridique et conformité",
	16: "Conseil",
	17: "Design UX/UI et graphisme",
	18: "Médias, journalisme et contenu",
	19: "Arts, culture et divertissement",
	20: "Ressources humaines et recrutement",
	21: "Éducation et formation",
	22: "Social et associatif",
	23: "Santé",
	24: "Pharmacie et recherche",
	25: "Sport et bien-être",
	26: "Logistique et supply chain",
	27: "Immobilier et architecture",
	28: "Hôtellerie, restauration et tourisme",
	29: "Artisanat et construction",
	99: "Autre",
};

// Secteurs triés par libellé pour le menu de filtre ; « Autre » reste en dernier
export const SECTOR_OPTIONS = Object.entries(SECTORS)
	.map(([value, label]) => ({ value: Number(value), label }))
	.sort((a, b) => (a.value === 99 ? 1 : b.value === 99 ? -1 : a.label.localeCompare(b.label, "fr")));

export const sectorLabel = (sector: number | null) => (sector === null ? "" : (SECTORS[sector] ?? ""));

// Couleurs des initiales, reprises de la maquette Explorer les entreprises
const EMBLEM_COLORS = [
	"bg-[#eaf4f9] text-[#237aa5]",
	"bg-[#eef2e6] text-[#343e30]",
	"bg-[#f0edf7] text-[#504477]",
	"bg-[#eaf5f6] text-[#147a8f]",
	"bg-[#fbf0e9] text-[#8c6049]",
];

// Initiales affichées à la place d'un logo : « Atelier Studio » → « AS », « Qonto » → « Q »
// Les mots sans lettre ni chiffre (« & », « - ») sont ignorés : « Pixel & Co » → « PC »
export const companyEmblem = (name: string) =>
	name
		.split(/\s+/)
		.filter((word) => /^[\p{L}\p{N}]/u.test(word))
		.slice(0, 2)
		.map((word) => word[0].toUpperCase())
		.join("");

// Couleur stable pour une même entreprise
export const emblemColors = (id: number) => EMBLEM_COLORS[id % EMBLEM_COLORS.length];

// « 2 800 salariés »
export const formatEmployees = (employees: number) =>
	`${employees.toLocaleString("fr-FR")} ${employees > 1 ? "salariés" : "salarié"}`;

// « https://www.atelier-studio.fr/ » → « atelier-studio.fr »
export const websiteLabel = (url: string) => url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");

// « 10 oct. 2026 »
export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
