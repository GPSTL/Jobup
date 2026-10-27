// Error messages and validators for the Connexion and Inscription forms.
// Each validator returns the error message, or "" when the value is valid.

export const MESSAGES = {
	prenomRequired: "Ce champ est obligatoire.",
	prenomInvalid: "Le prénom ne doit contenir que des lettres.",
	nomRequired: "Ce champ est obligatoire.",
	nomInvalid: "Le nom ne doit contenir que des lettres.",
	emailRequired: "Ce champ est obligatoire.",
	emailInvalid: "Adresse e-mail invalide (ex. : nom@exemple.fr).",
	passwordRequired: "Ce champ est obligatoire.",
	passwordWeak: "8 caractères minimum, dont une majuscule et un chiffre.",

	// Returned by the backend, to display once the forms are connected
	invalidCredentials: "Adresse e-mail ou mot de passe incorrect.",
	emailTaken: "Cette adresse e-mail est déjà utilisée.",
	serverError: "Une erreur est survenue, veuillez réessayer plus tard.",
	networkError: "Impossible de joindre le serveur. Vérifiez votre connexion internet et réessayez.",
};

const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '’-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

// Sign-up: enforces the password rules
export const validateNewPassword = (value: string) => {
	if (!value) return MESSAGES.passwordRequired;
	if (value.length < 8 || !/[A-Z]/.test(value) || !/\d/.test(value)) return MESSAGES.passwordWeak;
	return "";
};

// Login: only checks that a password was typed
export const validatePassword = (value: string) => (value ? "" : MESSAGES.passwordRequired);
