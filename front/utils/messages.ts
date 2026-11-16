// Affichage du fil de messages (JOB-034), réutilisable côté école (JOB-039).

import type { Message } from "../services/messages";

// Longueur de Message.body côté Django
export const MAX_MESSAGE_LENGTH = 2000;

// Délai entre deux vérifications de nouveaux messages, tant que l'onglet est visible
export const REFRESH_DELAY = 10_000;

export const SEND_ERRORS = {
	invalid: "Le message n’a pas été envoyé : il est vide ou trop long.",
	notFound: "Le message n’a pas été envoyé : cette conversation n’existe plus.",
	server: "Le message n’a pas été envoyé. Réessayez dans un instant.",
	network: "Le message n’a pas été envoyé : impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",
};

// Pièces jointes (JOB-043). Politique à valider par l'équipe, la même que dans jobup/attachments.py :
// le serveur décide, ces valeurs ne servent qu'à prévenir avant l'envoi.
export const ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024;
export const ATTACHMENT_EXTENSIONS = ["pdf", "docx", "doc"];
// Pour le sélecteur de fichier
export const ATTACHMENT_ACCEPT = ATTACHMENT_EXTENSIONS.map((extension) => `.${extension}`).join(",");

// Raison pour laquelle le fichier choisi n'est pas ajouté, ou null s'il peut l'être. Seul le nom est
// vérifié ici : le contenu l'est par le serveur, qui répond avec la même formulation s'il refuse.
export function attachmentProblem(file: { name: string; size: number }) {
	if (file.size === 0) return "Le fichier est vide.";
	if (file.size > ATTACHMENT_MAX_SIZE) return "Le fichier ne doit pas dépasser 10 Mo.";
	const extension = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
	if (!file.name.includes(".") || !ATTACHMENT_EXTENSIONS.includes(extension)) return "Le fichier doit être au format PDF, DOCX ou DOC.";
	return null;
}

// Erreur affichée quand l'envoi échoue : celle du serveur si elle concerne le fichier, sinon la phrase générale.
// Le fichier choisi reste en place pour réessayer.
export function sendError(reason: keyof typeof SEND_ERRORS, message: string | undefined, withFile: boolean) {
	if (message) return message;
	return withFile && reason === "invalid" ? "Le message n’a pas été envoyé : le fichier ou le texte a été refusé." : SEND_ERRORS[reason];
}

// « 220 Ko », « 1,5 Mo » : tailles à la française, comme la maquette
export function formatFileSize(bytes: number) {
	const format = (value: number, unit: string) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} ${unit}`;
	if (bytes < 1024) return `${bytes} o`;
	if (bytes < 1024 * 1024) return format(bytes / 1024, "Ko");
	return format(bytes / (1024 * 1024), "Mo");
}

// Ajoute des messages au fil sans doublon (un rafraîchissement peut renvoyer un message déjà affiché après son envoi),
// dans l'ordre d'enregistrement par le serveur
export function mergeMessages(current: Message[], incoming: Message[]) {
	const byId = new Map(current.map((message) => [message.id, message]));
	for (const message of incoming) byId.set(message.id, message);
	return [...byId.values()].sort((a, b) => a.id - b.id);
}

// « 10:24 », à l'heure locale du navigateur
export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

// Comme la maquette : « Aujourd’hui », « Hier », sinon « Lundi 2 novembre », avec l'année si ce n'est pas l'année en cours
export function dayLabel(iso: string, now = new Date()) {
	const date = new Date(iso);
	const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
	if (dayKey(date) === dayKey(now)) return "Aujourd’hui";
	if (dayKey(date) === dayKey(yesterday)) return "Hier";
	const label = date.toLocaleDateString("fr-FR", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
	});
	return label.charAt(0).toUpperCase() + label.slice(1);
}

export type MessageDay = { key: string; label: string; messages: Message[] };

// Regroupe les messages, déjà dans l'ordre, par jour d'envoi
export function groupByDay(messages: Message[], now = new Date()): MessageDay[] {
	const days: MessageDay[] = [];
	for (const message of messages) {
		const key = dayKey(new Date(message.created_at));
		const last = days[days.length - 1];
		if (last?.key === key) last.messages.push(message);
		else days.push({ key, label: dayLabel(message.created_at, now), messages: [message] });
	}
	return days;
}
