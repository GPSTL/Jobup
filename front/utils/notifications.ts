// Affichage des notifications (JOB-042, JOB-046) : heure relative, pastille, icône de chaque type,
// et ce qui change d'un rôle à l'autre (pages, préférences affichées).

import type { NotificationKind, NotificationPreferences } from "../services/notifications";

// Vérification régulière du nombre de non lues, tant que l'onglet est visible
export const COUNT_REFRESH_DELAY = 30_000;

// Préférence e-mail dans « Mon espace » : cible du lien « Préférences e-mail » du panneau
export const PREFERENCES_ANCHOR = "notifications";

export type NotificationRole = "student" | "recruiter" | "school";

type RoleNotifications = {
	/** Page « Voir toutes les notifications » */
	page: string;
	/** Bloc « Notifications » de « Mon espace », cible de « Préférences e-mail » */
	preferences: string;
	/** Sous-titre de la page des notifications */
	description: string;
	/** Interrupteurs de « Mon espace », dans l'ordre et avec les libellés de la maquette du rôle */
	settings: { key: keyof NotificationPreferences; label: string }[];
};

export const ROLE_NOTIFICATIONS: Record<NotificationRole, RoleNotifications> = {
	// Maquettes « Notifications étudiant » et « Mon espace – Compte et abonnement »
	student: {
		page: "/notifications",
		preferences: `/student#${PREFERENCES_ANCHOR}`,
		description: "Les nouveaux messages, les changements de vos candidatures, les entretiens proposés et le suivi de votre contrat.",
		settings: [
			{ key: "messages", label: "Nouveaux messages" },
			{ key: "application_status", label: "Changement de statut de candidature" },
			{ key: "school_updates", label: "École et suivi du contrat" },
			{ key: "email", label: "Recevoir aussi par e-mail" },
		],
	},
	// Maquettes « Notifications recruteur » et « Mon espace recruteur – Compte et abonnement »
	recruiter: {
		page: "/recruiter/notifications",
		preferences: `/recruiter/account#${PREFERENCES_ANCHOR}`,
		description: "Les nouvelles candidatures à vos offres, les entretiens choisis par les candidats et leurs messages.",
		settings: [
			{ key: "new_applications", label: "Nouvelles candidatures" },
			{ key: "messages", label: "Nouveaux messages" },
			{ key: "email", label: "Recevoir aussi par e-mail" },
		],
	},
	school: {
		page: "/school/notifications",
		preferences: `/school#${PREFERENCES_ANCHOR}`,
		description: "Les demandes de rattachement, les contrats à valider et les messages des étudiants.",
		settings: [
			{ key: "school_updates", label: "Demandes et contrats" },
			{ key: "messages", label: "Nouveaux messages" },
			{ key: "email", label: "Recevoir aussi par e-mail" },
		],
	},
};

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

type KindIcon = { src: string; background: string };

// Icône et couleur de fond de chaque type, comme la maquette « Notifications étudiant »
export const KIND_ICONS: Record<NotificationKind, KindIcon> = {
	message: { src: "/static/img/notifications/message.svg", background: "bg-[#dbeafe]" },
	application_update: { src: "/static/img/notifications/refresh.svg", background: "bg-[#fef3c7]" },
	application_accepted: { src: "/static/img/notifications/check.svg", background: "bg-[#dcfce7]" },
	// La maquette n'a pas d'icône pour un refus : celle d'une mise à jour
	application_refused: { src: "/static/img/notifications/refresh.svg", background: "bg-[#fef3c7]" },
	new_application: { src: "/static/img/notifications/user-plus.svg", background: "bg-[#dbeafe]" },
	school_request: { src: "/static/img/notifications/user-plus.svg", background: "bg-[#dbeafe]" },
	contract_update: { src: "/static/img/notifications/check.svg", background: "bg-[#dcfce7]" },
	// Entretien proposé, confirmé ou annulé
	interview: { src: "/static/img/notifications/calendar.svg", background: "bg-[#dbeafe]" },
};

// Maquette « Notifications recruteur » : le bleu y est réservé aux candidatures, les messages sont en violet
const RECRUITER_ICONS: Partial<Record<NotificationKind, KindIcon>> = {
	message: { src: "/static/img/notifications/message-violet.svg", background: "bg-[#ede7fe]" },
};

// Type inconnu (ajouté côté serveur sans être branché ici) : l'icône générique de la maquette
export const kindIcon = (kind: string, role: NotificationRole = "student") =>
	(role === "recruiter" ? RECRUITER_ICONS[kind as NotificationKind] : undefined) ??
	KIND_ICONS[kind as NotificationKind] ?? { src: "/static/img/notifications/mail.svg", background: "bg-[#ede7fe]" };
