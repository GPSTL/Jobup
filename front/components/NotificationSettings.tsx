import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import Button from "./Button";
import { getPreferences, updatePreferences, type NotificationPreferences } from "../services/notifications";
import { PREFERENCES_ANCHOR, ROLE_NOTIFICATIONS, type NotificationRole } from "../utils/notifications";
import { MESSAGES, REQUEST_ERRORS } from "../utils/validation";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// Titre et espacement de la maquette de chaque « Mon espace »
const LAYOUT: Record<NotificationRole, { section: string; heading: string }> = {
	student: { section: "gap-2", heading: "text-lg font-semibold" },
	recruiter: { section: "gap-4", heading: "text-[20px] font-semibold text-[#111827]" },
	school: { section: "gap-4", heading: "text-[20px] font-semibold text-[#111827]" },
};

type SettingsCardProps = {
	role: NotificationRole;
	/** null pendant le chargement */
	preferences: NotificationPreferences | null;
	loadError: string;
	saveError: string;
	/** Interrupteur en cours d'enregistrement */
	saving: keyof NotificationPreferences | null;
	onToggle: (key: keyof NotificationPreferences) => void;
	onRetry: () => void;
};

// Carte des interrupteurs : chargement, erreur, ou les préférences du rôle
export function NotificationSettingsCard({ role, preferences, loadError, saveError, saving, onToggle, onRetry }: SettingsCardProps) {
	return (
		<div className="flex flex-col gap-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-5 py-[18px]">
			{loadError && (
				<div role="alert" className="flex flex-col items-start gap-3">
					<p>{loadError}</p>
					<Button onClick={onRetry}>Réessayer</Button>
				</div>
			)}
			{!preferences && !loadError && (
				<p role="status" className="text-[#6b7280]">
					Chargement de vos préférences…
				</p>
			)}
			{preferences &&
				ROLE_NOTIFICATIONS[role].settings.map(({ key, label }) => (
					<div key={key} className="flex items-center gap-3">
						<span id={`notification-${key}`} className="min-w-0 flex-1 text-[16px] text-[#111827]">
							{label}
						</span>
						<button
							type="button"
							role="switch"
							aria-checked={preferences[key]}
							aria-labelledby={`notification-${key}`}
							aria-busy={saving === key}
							onClick={() => onToggle(key)}
							className={`shrink-0 cursor-pointer rounded-full aria-busy:cursor-wait aria-busy:opacity-70 ${focus}`}
						>
							<img src={`/static/img/notifications/toggle-${preferences[key] ? "on" : "off"}.svg`} width={44} height={24} alt="" />
						</button>
					</div>
				))}
			{saveError && (
				<p role="alert" className="text-[14px] font-medium text-[#b91c1c]">
					{saveError}
				</p>
			)}
			{preferences && <p className="text-[13px] text-[#6b7280]">Les notifications restent toujours visibles dans l’application, même sans e-mail.</p>}
		</div>
	);
}

type NotificationSettingsProps = {
	/** Rôle connecté : interrupteurs et libellés de sa maquette « Mon espace » */
	role?: NotificationRole;
};

// Section « Notifications » de « Mon espace » (JOB-042, JOB-046) : chaque interrupteur est enregistré aussitôt.
// L'e-mail double les notifications de l'application, il ne les remplace pas.
export default function NotificationSettings({ role = "student" }: NotificationSettingsProps) {
	const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
	const [loadError, setLoadError] = useState("");
	const [attempt, setAttempt] = useState(0);
	// Interrupteur en cours d'enregistrement, et message d'échec
	const [saving, setSaving] = useState<keyof NotificationPreferences | null>(null);
	const [saveError, setSaveError] = useState("");
	const section = useRef<HTMLElement>(null);
	const { hash } = useLocation();

	useEffect(() => {
		let ignore = false;
		setLoadError("");
		getPreferences().then((result) => {
			if (ignore) return;
			if (result.ok) setPreferences(result.preferences);
			else setLoadError(result.reason === "invalid" ? MESSAGES.serverError : REQUEST_ERRORS[result.reason]);
		});
		return () => {
			ignore = true;
		};
	}, [attempt]);

	// Arrivée par « Préférences e-mail » du panneau des notifications : la section est mise en vue
	useEffect(() => {
		if (hash === `#${PREFERENCES_ANCHOR}` && preferences) section.current?.scrollIntoView({ block: "center" });
	}, [hash, preferences]);

	const toggle = async (key: keyof NotificationPreferences) => {
		if (!preferences || saving) return;
		const previous = preferences;
		// Affiché aussitôt, rétabli si l'enregistrement échoue
		setPreferences({ ...preferences, [key]: !preferences[key] });
		setSaving(key);
		setSaveError("");
		const result = await updatePreferences({ [key]: !previous[key] });
		setSaving(null);
		if (result.ok) setPreferences(result.preferences);
		else {
			setPreferences(previous);
			setSaveError(`La préférence n’a pas été enregistrée. ${result.reason === "invalid" ? MESSAGES.serverError : REQUEST_ERRORS[result.reason]}`);
		}
	};

	return (
		<section ref={section} id={PREFERENCES_ANCHOR} aria-labelledby="notification-settings" className={`flex scroll-mt-6 flex-col ${LAYOUT[role].section}`}>
			<h2 id="notification-settings" className={LAYOUT[role].heading}>
				Notifications
			</h2>
			<NotificationSettingsCard
				role={role}
				preferences={preferences}
				loadError={loadError}
				saveError={saveError}
				saving={saving}
				onToggle={toggle}
				onRetry={() => setAttempt(attempt + 1)}
			/>
		</section>
	);
}
