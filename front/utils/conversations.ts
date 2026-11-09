// Affichage de la liste des conversations (JOB-032), partagé avec le côté recruteur (JOB-041).

import type { ConversationSummary } from "../services/conversations";

// « Léa Martin – Acme »
export const interlocutorName = ({ interlocutor }: ConversationSummary) =>
	`${interlocutor.first_name} ${interlocutor.last_name} – ${interlocutor.organization}`;

// « LM » pour Léa Martin
export const interlocutorInitials = ({ interlocutor }: ConversationSummary) =>
	`${interlocutor.first_name[0] ?? ""}${interlocutor.last_name[0] ?? ""}`.toUpperCase();

// Aperçu du dernier message, précédé de « Vous : » quand c'est l'étudiant qui l'a envoyé
export const lastMessagePreview = ({ last_message }: ConversationSummary) => {
	if (last_message === null) return "Aucun message pour l’instant";
	return last_message.from_me ? `Vous : ${last_message.body}` : last_message.body;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const DAY = 24 * 60 * 60 * 1000;

// Comme la maquette : « 10:32 » aujourd'hui, « Hier », « Lun. » cette semaine, sinon « 12/10/2026 »
export function formatConversationDate(iso: string, now = new Date()) {
	const date = new Date(iso);
	const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
	if (days <= 0) return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
	if (days === 1) return "Hier";
	if (days < 7) {
		const weekday = date.toLocaleDateString("fr-FR", { weekday: "short" });
		return weekday.charAt(0).toUpperCase() + weekday.slice(1);
	}
	return date.toLocaleDateString("fr-FR");
}

// Date affichée : celle du dernier message, ou la création pour une conversation sans message
export const conversationDate = (conversation: ConversationSummary, now?: Date) =>
	formatConversationDate(conversation.last_message?.created_at ?? conversation.created_at, now);

// Couleurs des pastilles, reprises de la maquette Messages
const AVATAR_COLORS = ["bg-[#7c3aed]", "bg-primary", "bg-[#ec4899]", "bg-[#0d9488]"];

export const avatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];
