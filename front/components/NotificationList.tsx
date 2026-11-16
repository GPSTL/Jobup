import { Link } from "react-router-dom";

import type { AppNotification } from "../services/notifications";
import { kindIcon, relativeTime, type NotificationRole } from "../utils/notifications";

type NotificationListProps = {
	notifications: AppNotification[];
	/** Clic sur une notification : la page la marque comme lue (puis le lien s'ouvre) */
	onOpen: (notification: AppNotification) => void;
	/** Les couleurs des icônes suivent la maquette du rôle */
	role?: NotificationRole;
	now?: Date;
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary";

// Notifications du panneau de la cloche et de la page « Notifications » (maquettes « Notifications étudiant » et « Notifications recruteur »)
export default function NotificationList({ notifications, onOpen, role = "student", now }: NotificationListProps) {
	return (
		<ul>
			{notifications.map((notification) => {
				const icon = kindIcon(notification.kind, role);
				const content = (
					<>
						<span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${icon.background}`}>
							<img src={icon.src} width={20} height={20} alt="" />
						</span>
						<span className="flex min-w-0 flex-1 flex-col gap-[3px]">
							<span className={`text-[15px] text-[#111827] ${notification.read ? "font-medium" : "font-semibold"}`}>
								{!notification.read && <span className="sr-only">Non lue : </span>}
								{notification.title}
							</span>
							{notification.body && <span className="text-[14px] text-[#6b7280] [overflow-wrap:anywhere]">{notification.body}</span>}
							<time dateTime={notification.created_at} className={`text-[12px] font-medium ${notification.read ? "text-[#6b7280]" : "text-primary"}`}>
								{relativeTime(notification.created_at, now)}
							</time>
						</span>
						{/* self-start : sans lui, la ligne flex étire le point sur toute la hauteur de la notification */}
						{!notification.read && <img src="/static/img/notifications/unread.svg" width={10} height={10} alt="" className="mt-1.5 shrink-0 self-start" />}
					</>
				);
				const row = `flex w-full gap-3 border-t border-[#e5e7eb] px-5 py-3.5 text-left leading-[normal] ${notification.read ? "bg-white hover:bg-[#f9fafb]" : "bg-[#f6faff] hover:bg-[#eaf3ff]"} ${focus}`;
				return (
					<li key={notification.id}>
						{notification.link ? (
							<Link to={notification.link} onClick={() => onOpen(notification)} className={row}>
								{content}
							</Link>
						) : (
							<button type="button" onClick={() => onOpen(notification)} className={`cursor-pointer ${row}`}>
								{content}
							</button>
						)}
					</li>
				);
			})}
		</ul>
	);
}
