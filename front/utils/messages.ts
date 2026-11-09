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
