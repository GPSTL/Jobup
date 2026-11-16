import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import Button from "./Button";
import { getPreferences, updatePreferences, type NotificationPreferences } from "../services/notifications";
import { PREFERENCES_ANCHOR } from "../utils/notifications";
import { MESSAGES, REQUEST_ERRORS } from "../utils/validation";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// Ordre et libellés de la maquette « Mon espace – Compte et abonnement »
const SETTINGS: { key: keyof NotificationPreferences; label: string }[] = [
	{ key: "messages", label: "Nouveaux messages" },
	{ key: "application_status", label: "Changement de statut de candidature" },
	{ key: "email", label: "Recevoir aussi par e-mail" },
];

// Section « Notifications » de « Mon espace » (JOB-042) : chaque interrupteur est enregistré aussitôt.
// L'e-mail double les notifications de l'application, il ne les remplace pas.
export default function NotificationSettings() {
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
		<section ref={section} id={PREFERENCES_ANCHOR} aria-labelledby="notification-settings" className="flex scroll-mt-6 flex-col gap-2">
			<h2 id="notification-settings" className="text-lg font-semibold">
				Notifications
			</h2>
			<div className="flex flex-col gap-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-5 py-[18px]">
				{loadError && (
					<div role="alert" className="flex flex-col items-start gap-3">
						<p>{loadError}</p>
						<Button onClick={() => setAttempt(attempt + 1)}>Réessayer</Button>
					</div>
				)}
				{!preferences && !loadError && (
					<p role="status" className="text-[#6b7280]">
						Chargement de vos préférences…
					</p>
				)}
				{preferences &&
					SETTINGS.map(({ key, label }) => (
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
								onClick={() => toggle(key)}
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
				{preferences && (
					<p className="text-[13px] text-[#6b7280]">
						Les notifications restent toujours visibles dans l’application, même sans e-mail.
					</p>
				)}
			</div>
		</section>
	);
}
