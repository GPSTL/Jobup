import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Link, Navigate } from "react-router-dom";

import NotificationList from "./NotificationList";
import { getNotifications, getUnreadCount, markAllRead, markRead, type AppNotification } from "../services/notifications";
import { badgeLabel, bellLabel, COUNT_REFRESH_DELAY, ROLE_NOTIFICATIONS, type NotificationRole } from "../utils/notifications";
import { REQUEST_ERRORS } from "../utils/validation";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

type PanelContentProps = {
	/** null pendant le chargement */
	notifications: AppNotification[] | null;
	error: string;
	onRetry: () => void;
	onOpen: (notification: AppNotification) => void;
	role: NotificationRole;
};

// Corps du panneau : chargement, erreur, aucune notification, ou la liste
export function NotificationPanelContent({ notifications, error, onRetry, onOpen, role }: PanelContentProps) {
	return (
		<div className="max-h-[min(420px,60vh)] overflow-y-auto">
			{notifications === null && !error && (
				<p role="status" className="border-t border-[#e5e7eb] px-5 py-6 text-[14px] text-[#6b7280]">
					Chargement des notifications…
				</p>
			)}
			{error && (
				<div role="alert" className="flex flex-col items-start gap-2 border-t border-[#e5e7eb] px-5 py-5 text-[14px]">
					<p>{error}</p>
					<button type="button" onClick={onRetry} className={`cursor-pointer rounded-sm font-semibold text-primary underline ${focus}`}>
						Réessayer
					</button>
				</div>
			)}
			{notifications?.length === 0 && <p className="border-t border-[#e5e7eb] px-5 py-6 text-[14px] text-[#6b7280]">Aucune notification pour l’instant.</p>}
			{notifications && notifications.length > 0 && <NotificationList notifications={notifications} onOpen={onOpen} role={role} />}
		</div>
	);
}

type NotificationBellProps = {
	/** Rôle connecté : pages des liens du panneau et couleurs des icônes */
	role?: NotificationRole;
};

// Cloche de la barre de navigation (JOB-042, JOB-046) : nombre de non lues, et panneau des dernières notifications
export default function NotificationBell({ role = "student" }: NotificationBellProps) {
	const [count, setCount] = useState(0);
	const [open, setOpen] = useState(false);
	// null pendant le chargement du panneau
	const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
	const [error, setError] = useState("");
	const [noSession, setNoSession] = useState(false);
	const [attempt, setAttempt] = useState(0);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const panelId = useId();

	const refreshCount = useCallback(() => {
		getUnreadCount().then((result) => {
			if (result.ok) setCount(result.unreadCount);
			else if (result.reason === "unauthenticated") setNoSession(true);
		});
	}, []);

	// Nombre de non lues : au chargement, régulièrement tant que l'onglet est visible, et dès qu'il le redevient
	useEffect(() => {
		refreshCount();
		const refresh = () => {
			if (document.visibilityState === "visible") refreshCount();
		};
		const timer = setInterval(refresh, COUNT_REFRESH_DELAY);
		document.addEventListener("visibilitychange", refresh);
		return () => {
			clearInterval(timer);
			document.removeEventListener("visibilitychange", refresh);
		};
	}, [refreshCount]);

	// Ouverture du panneau : les dernières notifications, à jour
	useEffect(() => {
		if (!open) return;
		let ignore = false;
		setNotifications(null);
		setError("");
		getNotifications().then((result) => {
			if (ignore) return;
			if (result.ok) {
				setNotifications(result.notifications);
				setCount(result.unreadCount);
			} else if (result.reason === "unauthenticated") setNoSession(true);
			else setError(REQUEST_ERRORS[result.reason]);
		});
		return () => {
			ignore = true;
		};
	}, [open, attempt]);

	// Un clic en dehors ferme le panneau
	useEffect(() => {
		if (!open) return;
		const close = (event: MouseEvent) => {
			if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", close);
		return () => document.removeEventListener("mousedown", close);
	}, [open]);

	// Échap ferme le panneau et rend le focus à la cloche
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key === "Escape" && open) {
			event.stopPropagation();
			setOpen(false);
			buttonRef.current?.focus();
		}
	};

	// La notification ouverte est marquée comme lue ; son lien s'ouvre aussitôt
	const openNotification = (notification: AppNotification) => {
		setOpen(false);
		if (notification.read) return;
		setNotifications((current) => current?.map((item) => (item.id === notification.id ? { ...item, read: true } : item)) ?? null);
		setCount((current) => Math.max(0, current - 1));
		markRead(notification.id).then((result) => {
			if (result.ok) setCount(result.unreadCount);
		});
	};

	const readAll = async () => {
		const result = await markAllRead();
		if (result.ok) {
			setCount(0);
			setNotifications((current) => current?.map((item) => ({ ...item, read: true })) ?? null);
		} else if (result.reason === "unauthenticated") setNoSession(true);
		else setError(REQUEST_ERRORS[result.reason]);
	};

	// Session expirée : retour à la connexion, comme les autres pages
	if (noSession) return <Navigate to="/login" replace />;

	return (
		<div ref={wrapperRef} className="relative" onKeyDown={onKeyDown}>
			<button
				ref={buttonRef}
				type="button"
				aria-expanded={open}
				aria-controls={panelId}
				aria-label={bellLabel(count)}
				onClick={() => setOpen(!open)}
				className={`relative flex size-11 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-(--navbar-interaction-bg) aria-expanded:bg-primary/20 ${focus}`}
			>
				<img src="/static/img/notifications/bell.svg" width={22} height={22} alt="" className="notification-bell-icon" />
				{count > 0 && (
					<span aria-hidden="true" className="absolute top-1 left-6 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#dc2626] px-[5px] text-[11px] leading-none font-bold text-white">
						{badgeLabel(count)}
					</span>
				)}
			</button>

			<div
				id={panelId}
				role="region"
				aria-label="Notifications"
				hidden={!open}
				// Petits écrans : la cloche n'est pas au bord, le panneau prend la largeur de l'écran moins ses marges
				className="absolute top-full right-0 z-20 mt-3 w-[460px] overflow-hidden rounded-[18px] border border-[#e5e7eb] bg-white text-left leading-[normal] shadow-[0_12px_32px_rgba(0,0,0,0.16)] max-sm:fixed max-sm:inset-x-4 max-sm:top-20 max-sm:w-auto"
			>
				<div className="flex items-center gap-2 px-5 pt-4 pb-3.5">
					<h2 className="text-[19px] font-semibold text-[#111827]">Notifications</h2>
					{count > 0 && (
						<span className="rounded-full bg-[#dc2626] px-2 py-0.5 text-[12px] font-bold text-white">
							{count}
							<span className="sr-only"> non lue{count > 1 ? "s" : ""}</span>
						</span>
					)}
					{count > 0 && (
						<button type="button" onClick={readAll} className={`ml-auto cursor-pointer rounded-sm text-[13px] font-semibold text-primary hover:underline ${focus}`}>
							Tout marquer comme lu
						</button>
					)}
				</div>

				<NotificationPanelContent notifications={notifications} error={error} onRetry={() => setAttempt(attempt + 1)} onOpen={openNotification} role={role} />

				<div className="flex items-center gap-1.5 border-t border-[#e5e7eb] px-5 pt-3.5 pb-4 text-[14px]">
					<Link to={ROLE_NOTIFICATIONS[role].page} onClick={() => setOpen(false)} className={`rounded-sm font-semibold text-primary hover:underline ${focus}`}>
						Voir toutes les notifications
					</Link>
					<Link
						to={ROLE_NOTIFICATIONS[role].preferences}
						onClick={() => setOpen(false)}
						className={`ml-auto flex items-center gap-1.5 rounded-sm font-medium text-[#6b7280] hover:underline ${focus}`}
					>
						<img src="/static/img/notifications/settings.svg" width={16} height={16} alt="" />
						Préférences e-mail
					</Link>
				</div>
			</div>
		</div>
	);
}
