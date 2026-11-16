import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import Button from "../components/Button";
import NotificationList from "../components/NotificationList";
import RecruiterNavbar from "../components/RecruiterNavbar";
import StudentNavbar from "../components/StudentNavbar";
import { getNotifications, markAllRead, markRead, type AppNotification } from "../services/notifications";
import { ROLE_NOTIFICATIONS, type NotificationRole } from "../utils/notifications";
import { focus } from "../utils/searchPageStyles";
import { REQUEST_ERRORS } from "../utils/validation";

type NotificationsPageProps = {
	/** Rôle connecté, vérifié par RequireStudent ou RequireRecruiter */
	role?: NotificationRole;
};

// Toutes les notifications de l'étudiant (JOB-042) ou du recruteur (JOB-046) : « Voir toutes les notifications » du panneau de la cloche
export default function NotificationsPage({ role = "student" }: NotificationsPageProps) {
	// null pendant le premier chargement
	const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
	const [hasMore, setHasMore] = useState(false);
	const [unread, setUnread] = useState(0);
	const [error, setError] = useState("");
	const [moreError, setMoreError] = useState("");
	const [loadingMore, setLoadingMore] = useState(false);
	const [noSession, setNoSession] = useState(false);
	// Incrémenté par « Réessayer » pour relancer le chargement
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let ignore = false;
		setNotifications(null);
		setError("");
		getNotifications().then((result) => {
			if (ignore) return;
			if (result.ok) {
				setNotifications(result.notifications);
				setHasMore(result.hasMore);
				setUnread(result.unreadCount);
			} else if (result.reason === "unauthenticated") setNoSession(true);
			else setError(REQUEST_ERRORS[result.reason]);
		});
		return () => {
			ignore = true;
		};
	}, [attempt]);

	const loadMore = async () => {
		const last = notifications?.[notifications.length - 1];
		if (!last) return;
		setLoadingMore(true);
		setMoreError("");
		const result = await getNotifications(last.id);
		setLoadingMore(false);
		if (result.ok) {
			setNotifications((current) => [...(current ?? []), ...result.notifications]);
			setHasMore(result.hasMore);
		} else if (result.reason === "unauthenticated") setNoSession(true);
		else setMoreError(REQUEST_ERRORS[result.reason]);
	};

	const open = (notification: AppNotification) => {
		if (notification.read) return;
		setNotifications((current) => current?.map((item) => (item.id === notification.id ? { ...item, read: true } : item)) ?? null);
		setUnread((current) => Math.max(0, current - 1));
		markRead(notification.id);
	};

	const readAll = async () => {
		const result = await markAllRead();
		if (result.ok) {
			setUnread(0);
			setNotifications((current) => current?.map((item) => ({ ...item, read: true })) ?? null);
		} else if (result.reason === "unauthenticated") setNoSession(true);
		else setError(REQUEST_ERRORS[result.reason]);
	};

	// Session expirée pendant la consultation : retour à la connexion
	if (noSession) return <Navigate to="/login" replace />;

	return (
		<div className="min-h-dvh bg-[#f0f0f0] text-[#111827]">
			<header className="p-4">{role === "recruiter" ? <RecruiterNavbar /> : <StudentNavbar />}</header>
			<main className="px-4 pt-6 pb-16 md:px-6 md:pt-9">
				<div className="mx-auto flex max-w-[1000px] flex-col gap-5 rounded-[25px] bg-white px-4 pt-8 pb-9 leading-[normal] shadow-[0_4px_12px_rgba(0,0,0,0.1)] md:px-10">
					<div className="flex flex-wrap items-end gap-3">
						<div className="flex flex-col gap-1.5">
							<h1 className="text-[32px] font-semibold">Notifications</h1>
							<p className="text-[16px] text-[#6b7280]">{ROLE_NOTIFICATIONS[role].description}</p>
						</div>
						<div className="ml-auto flex items-center gap-4 text-[14px]">
							<Link to={ROLE_NOTIFICATIONS[role].preferences} className={`flex items-center gap-1.5 rounded-sm font-medium text-[#6b7280] hover:underline ${focus}`}>
								<img src="/static/img/notifications/settings.svg" width={16} height={16} alt="" />
								Préférences e-mail
							</Link>
							{unread > 0 && (
								<button type="button" onClick={readAll} className={`cursor-pointer rounded-sm font-semibold text-primary hover:underline ${focus}`}>
									Tout marquer comme lu
								</button>
							)}
						</div>
					</div>

					{notifications === null && !error && (
						<p role="status" className="text-[16px] text-[#6b7280]">
							Chargement des notifications…
						</p>
					)}
					{error && (
						<div role="alert" className="flex flex-col items-start gap-4">
							<p className="text-[16px]">{error}</p>
							<Button onClick={() => setAttempt(attempt + 1)}>Réessayer</Button>
						</div>
					)}
					{notifications?.length === 0 && <p className="text-[16px] text-[#6b7280]">Aucune notification pour l’instant.</p>}
					{notifications && notifications.length > 0 && (
						<div className="overflow-hidden rounded-2xl border border-[#e5e7eb] [&>ul>li:first-child>*]:border-t-0">
							<NotificationList notifications={notifications} onOpen={open} role={role} />
						</div>
					)}
					{hasMore && (
						<div className="flex flex-col items-center gap-2">
							<button
								type="button"
								onClick={loadMore}
								disabled={loadingMore}
								className={`cursor-pointer rounded-[14px] border border-[#d1d5db] bg-white px-[22px] py-3 text-[15px] font-semibold disabled:cursor-wait disabled:opacity-70 ${focus}`}
							>
								{loadingMore ? "Chargement…" : "Afficher plus"}
							</button>
							{moreError && <p role="alert" className="text-[14px] text-[#b91c1c]">{moreError}</p>}
						</div>
					)}
				</div>
			</main>
		</div>
	);
}
