// Error messages and validators for the Connexion and Inscription forms.
// Each validator returns the error message, or "" when the value is valid.

export const MESSAGES = {
	prenomRequired: "Veuillez saisir votre prénom.",
	prenomInvalid: "Le prénom ne doit contenir que des lettres.",
	nomRequired: "Veuillez saisir votre nom.",
	nomInvalid: "Le nom ne doit contenir que des lettres.",
	emailRequired: "Veuillez saisir votre adresse mail.",
	emailInvalid: "Adresse mail invalide (ex. : nom@exemple.fr).",
	telephoneRequired: "Veuillez saisir votre numéro de téléphone.",
	telephoneInvalid: "Numéro invalide : 10 chiffres commençant par 0 (ex. : 06 12 34 56 78).",
	passwordRequired: "Veuillez saisir votre mot de passe.",
	passwordWeak: "Le mot de passe doit contenir au moins 8 caractères, dont une majuscule, une minuscule et un chiffre.",
	etablissementRequired: "Veuillez sélectionner votre établissement d’études.",
	domaineRequired: "Veuillez sélectionner le domaine recherché.",

	// Returned by the backend, to display once the forms are connected
	invalidCredentials: "Adresse mail ou mot de passe incorrect.",
	emailTaken: "Un compte existe déjà avec cette adresse mail.",
	serverError: "Une erreur est survenue, veuillez réessayer plus tard.",
};

const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '’-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^(?:0|\+33)[1-9]\d{8}$/;

export const validatePrenom = (value: string) => {
	if (!value.trim()) return MESSAGES.prenomRequired;
	if (!NAME_RE.test(value.trim())) return MESSAGES.prenomInvalid;
	return "";
};

export const validateNom = (value: string) => {
	if (!value.trim()) return MESSAGES.nomRequired;
	if (!NAME_RE.test(value.trim())) return MESSAGES.nomInvalid;
	return "";
};

export const validateEmail = (value: string) => {
	if (!value.trim()) return MESSAGES.emailRequired;
	if (!EMAIL_RE.test(value.trim())) return MESSAGES.emailInvalid;
	return "";
};

// Accepts spaces, dots and dashes between digits: 06 12 34 56 78, 06.12.34.56.78, +33 6 12 34 56 78
export const validateTelephone = (value: string) => {
	if (!value.trim()) return MESSAGES.telephoneRequired;
	if (!PHONE_RE.test(value.replace(/[\s.-]/g, ""))) return MESSAGES.telephoneInvalid;
	return "";
};

// Sign-up: enforces the password rules
export const validateNewPassword = (value: string) => {
	if (!value) return MESSAGES.passwordRequired;
	if (value.length < 8 || !/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value)) return MESSAGES.passwordWeak;
	return "";
};

// Login: only checks that a password was typed
export const validatePassword = (value: string) => (value ? "" : MESSAGES.passwordRequired);

export const validateEtablissement = (value: string) => (value ? "" : MESSAGES.etablissementRequired);

export const validateDomaine = (value: string) => (value ? "" : MESSAGES.domaineRequired);
