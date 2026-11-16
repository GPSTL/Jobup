// Affichage des notifications (JOB-042) : heure relative, pastille, icône de chaque type.

import type { NotificationKind } from "../services/notifications";

// Vérification régulière du nombre de non lues, tant que l'onglet est visible
export const COUNT_REFRESH_DELAY = 30_000;

// Préférence e-mail dans « Mon espace » : cible du lien « Préférences e-mail » du panneau
export const PREFERENCES_ANCHOR = "notifications";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

// Comme la maquette : « À l’instant », « Il y a 5 min », « Il y a 2 h », « Hier », puis « 15 oct. »
export function relativeTime(iso: string, now = new Date()) {
	const date = new Date(iso);
	const elapsed = now.getTime() - date.getTime();
	if (elapsed < MINUTE) return "À l’instant";
	if (elapsed < HOUR) return `Il y a ${Math.floor(elapsed / MINUTE)} min`;
	if (dayStart(date) === dayStart(now)) return `Il y a ${Math.floor(elapsed / HOUR)} h`;
	if (dayStart(now) - dayStart(date) <= 24 * HOUR + HOUR) return "Hier";
	return date.toLocaleDateString("fr-FR", {
		day: "numeric",
		month: "short",
		year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
	});
}

// Pastille de la cloche : au-delà de 9, « 9+ » pour tenir dans le rond
export const badgeLabel = (count: number) => (count > 9 ? "9+" : String(count));

// Nom accessible de la cloche, avec le nombre de non lues
export function bellLabel(count: number) {
	if (count === 0) return "Notifications";
	return `Notifications, ${count} non lue${count > 1 ? "s" : ""}`;
}

// Icône et couleur de fond de chaque type, comme la maquette « Notifications étudiant »
export const KIND_ICONS: Record<NotificationKind, { src: string; background: string }> = {
	message: { src: "/static/img/notifications/message.svg", background: "bg-[#dbeafe]" },
	application_update: { src: "/static/img/notifications/refresh.svg", background: "bg-[#fef3c7]" },
	application_accepted: { src: "/static/img/notifications/check.svg", background: "bg-[#dcfce7]" },
	// La maquette n'a pas d'icône pour un refus : celle d'une mise à jour
	application_refused: { src: "/static/img/notifications/refresh.svg", background: "bg-[#fef3c7]" },
};

// Type inconnu (ajouté côté serveur par REC-32 ou ECO-21) : l'icône générique de la maquette
export const kindIcon = (kind: string) =>
	KIND_ICONS[kind as NotificationKind] ?? { src: "/static/img/notifications/mail.svg", background: "bg-[#ede7fe]" };
