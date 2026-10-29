// Error messages and validators for the forms (Connexion, Inscription, Mon espace).
// Each validator returns the error message, or "" when the value is valid.

export const MESSAGES = {
	prenomRequired: "Ce champ est obligatoire.",
	prenomInvalid: "Le prénom ne doit contenir que des lettres.",
	nomRequired: "Ce champ est obligatoire.",
	nomInvalid: "Le nom ne doit contenir que des lettres.",
	emailRequired: "Ce champ est obligatoire.",
	emailInvalid: "Adresse e-mail invalide (ex. : nom@exemple.fr).",
	telephoneRequired: "Ce champ est obligatoire.",
	telephoneInvalid: "Numéro invalide : 10 chiffres commençant par 0 (ex. : 06 12 34 56 78).",
	passwordRequired: "Ce champ est obligatoire.",
	passwordWeak: "8 caractères minimum, dont une majuscule et un chiffre.",
	etablissementRequired: "Ce champ est obligatoire.",
	domaineRequired: "Ce champ est obligatoire.",

	// Returned by the backend, to display once the forms are connected
	invalidCredentials: "Adresse e-mail ou mot de passe incorrect.",
	emailTaken: "Cette adresse e-mail est déjà utilisée.",
	serverError: "Une erreur est survenue, veuillez réessayer plus tard.",
	networkError: "Impossible de joindre le serveur. Vérifiez votre connexion internet et réessayez.",
	sessionExpired: "Votre session a expiré. Reconnectez-vous pour continuer.",

	// Mon espace
	photoFormat: "La photo doit être au format JPG ou PNG.",
	photoTooBig: "La photo ne doit pas dépasser 2 Mo.",
	cvFormat: "Le CV doit être au format PDF, DOCX ou DOC.",
	cvTooBig: "Le CV ne doit pas dépasser 5 Mo.",
};

// Message of a failed API call, by reason (see the services)
export const REQUEST_ERRORS = {
	unauthenticated: MESSAGES.sessionExpired,
	server: MESSAGES.serverError,
	network: MESSAGES.networkError,
};

// TODO JOB-008: confirm the maximum size of the photo (2 Mo, like the company logo of REC-25)
const PHOTO_MAX_SIZE = 2 * 1024 * 1024;
const CV_MAX_SIZE = 5 * 1024 * 1024;

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
	if (value.length < 8 || !/[A-Z]/.test(value) || !/\d/.test(value)) return MESSAGES.passwordWeak;
	return "";
};

// Login: only checks that a password was typed
export const validatePassword = (value: string) => (value ? "" : MESSAGES.passwordRequired);

export const validateEtablissement = (value: string) => (value ? "" : MESSAGES.etablissementRequired);

export const validateDomaine = (value: string) => (value ? "" : MESSAGES.domaineRequired);

export const validateMaxLength = (value: string, max: number) =>
	value.length > max ? `${max} caractères maximum (${value.length} actuellement).` : "";

export const validatePhoto = (file: File) => {
	if (file.type !== "image/jpeg" && file.type !== "image/png") return MESSAGES.photoFormat;
	if (file.size > PHOTO_MAX_SIZE) return MESSAGES.photoTooBig;
	return "";
};

// The extension is checked rather than the type: browsers do not always know the type of a .doc file
export const validateCv = (file: File) => {
	const extension = file.name.split(".").pop()?.toLowerCase();
	if (extension !== "pdf" && extension !== "docx" && extension !== "doc") return MESSAGES.cvFormat;
	if (file.size > CV_MAX_SIZE) return MESSAGES.cvTooBig;
	return "";
};
