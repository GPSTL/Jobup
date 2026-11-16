// Formulaire « Page entreprise » du « Mon espace » recruteur (JOB-066) : limites et messages
// identiques à l'API (jobup/recruiter_company.py), pour afficher l'erreur avant l'envoi.
import type { CompanyForm, CompanyFormField, OwnCompany } from "../services/companies";

export const COMPANY_LIMITS = { name: 128, city: 64, description: 2048 };
const LOGO_MAX_SIZE = 2 * 1024 * 1024;

export const COMPANY_MESSAGES = {
	name: "Le nom de l’entreprise est obligatoire (128 caractères maximum).",
	sector: "Choisissez un secteur dans la liste.",
	city: "La localisation ne doit pas dépasser 64 caractères.",
	description: "La présentation ne doit pas dépasser 2048 caractères.",
	logoFormat: "Le logo doit être au format JPG ou PNG.",
	logoTooBig: "Le logo ne doit pas dépasser 2 Mo.",
};

export const formFromCompany = (company: OwnCompany): CompanyForm => ({
	name: company.name,
	sector: company.sector ?? "",
	city: company.city,
	description: company.description,
});

// Erreurs du formulaire, champ par champ ; un objet vide quand tout est valide
export function validateCompanyForm(form: CompanyForm): Partial<Record<CompanyFormField, string>> {
	const errors: Partial<Record<CompanyFormField, string>> = {};
	const name = form.name.trim();
	if (!name || name.length > COMPANY_LIMITS.name) errors.name = COMPANY_MESSAGES.name;
	if (form.sector === "") errors.sector = COMPANY_MESSAGES.sector;
	if (form.city.trim().length > COMPANY_LIMITS.city) errors.city = COMPANY_MESSAGES.city;
	if (form.description.trim().length > COMPANY_LIMITS.description) errors.description = COMPANY_MESSAGES.description;
	return errors;
}

export const validateLogo = (file: File) => {
	if (file.type !== "image/jpeg" && file.type !== "image/png") return COMPANY_MESSAGES.logoFormat;
	if (file.size > LOGO_MAX_SIZE) return COMPANY_MESSAGES.logoTooBig;
	return "";
};

// Valeurs envoyées : espaces de début et de fin retirés, comme le fait l'API
export const trimmedForm = (form: CompanyForm): CompanyForm => ({
	name: form.name.trim(),
	sector: form.sector,
	city: form.city.trim(),
	description: form.description.trim(),
});

// « 3 offres en cours », comme sur la carte du répertoire
export const activeOffersLabel = (count: number) => `${count} ${count > 1 ? "offres en cours" : "offre en cours"}`;
