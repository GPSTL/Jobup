import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import AdminNavbar from "../components/AdminNavbar";
import { CandidateAvatar } from "../components/CandidateIdentity";
import DownloadIcon from "../components/DownloadIcon";
import GraduationCapIcon from "../components/GraduationCapIcon";
import SuspendAccountDialog from "../components/SuspendAccountDialog";
import { getAdminUser, setSuspension, type AdminUserDetail, type AdminUserDetailResult } from "../services/adminUsers";
import { adminLoginLink, adminUsersLink, formatDate } from "../utils/adminUsers";
import { focus } from "../utils/searchPageStyles";

const icon = { width: 22, height: 22, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const phoneIcon = <svg viewBox="0 0 24 24" {...icon}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" /></svg>;
const mailIcon = <svg viewBox="0 0 24 24" {...icon}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></svg>;
const sendIcon = <svg viewBox="0 0 24 24" {...icon}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>;
const calendarIcon = <svg viewBox="0 0 24 24" {...icon}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;

// One line of the profile: the icon stands for the label, read by screen readers only
function Detail({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
	return (
		<div className="flex items-center gap-3">
			<dt className="shrink-0 text-[#6b7280]">
				{icon}
				<span className="sr-only">{label}</span>
			</dt>
			<dd className="min-w-0 break-words">{children}</dd>
		</div>
	);
}

const missing = (text: string) => <span className="text-[#6b7280]">{text}</span>;

export function applicationsLabel(count: number) {
	if (count === 0) return "Aucune candidature envoyée";
	return count === 1 ? "1 candidature envoyée" : `${count} candidatures envoyées`;
}

const ACTION_ERRORS = {
	forbidden: "Accès interdit ou session expirée. Reconnectez-vous.",
	notFound: "Cet étudiant est introuvable.",
	server: "Une erreur est survenue, veuillez réessayer.",
	network: "Connexion au serveur impossible. Vérifiez votre connexion et réessayez.",
};

type AdminStudentProfileProps = {
	user: AdminUserDetail;
	/** The account was suspended or given back: the page shows the updated profile */
	onChange?: (user: AdminUserDetail) => void;
};

// Profile of a student for the administrators (ADM-02): school, phone, e-mail, applications sent,
// signup date, the CV, then « Suspendre le compte » after a confirmation (ADM-03) for an active
// account, or « Rétablir le compte » (ADM-04) for a suspended one
export function AdminStudentProfile({ user, onChange }: AdminStudentProfileProps) {
	const [confirming, setConfirming] = useState(false);
	const [pending, setPending] = useState(false);
	// Updated at once, unlike the state: a double click sends one request
	const pendingRef = useRef(false);
	const [error, setError] = useState("");
	const [done, setDone] = useState("");
	const name = `${user.first_name} ${user.last_name}`;

	const change = async (suspended: boolean) => {
		if (pendingRef.current) return;
		pendingRef.current = true;
		setPending(true);
		setError("");
		setDone("");
		const result = await setSuspension(user.id, suspended);
		pendingRef.current = false;
		setPending(false);
		if (!result.ok) {
			setError(ACTION_ERRORS[result.reason]);
			return;
		}
		setConfirming(false);
		setDone(suspended ? "Le compte est suspendu." : "Le compte est rétabli.");
		onChange?.(result.user);
	};

	return (
		<section aria-labelledby="student-name" className="mx-auto max-w-[786px] rounded-[24px] bg-surface px-6 pt-6 pb-10 shadow-[0_4px_12px_rgba(0,0,0,0.1)] sm:px-12">
			<h1 id="student-name" className="text-center text-2xl font-semibold text-[#111827]">
				{user.first_name} {user.last_name}
			</h1>
			{!user.is_active && (
				<p className="mt-2 text-center font-medium text-[#e00000]">
					{user.suspended_at ? <>Suspendu le <time dateTime={user.suspended_at}>{formatDate(user.suspended_at)}</time></> : "Compte suspendu, date non renseignée"}
				</p>
			)}
			<div className="mt-10 flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:gap-12">
				<CandidateAvatar candidate={user} className="size-44 text-[56px] sm:size-60 sm:text-[72px]" />
				<div className="w-full min-w-0 sm:flex-1">
					<dl className="space-y-5 text-xl font-medium text-[#111827]">
						<Detail icon={<GraduationCapIcon width={22} height={22} aria-hidden="true" />} label="École">
							{user.school ?? missing("École non renseignée")}
						</Detail>
						<Detail icon={phoneIcon} label="Téléphone">
							{user.phone ?? missing("Téléphone non renseigné")}
						</Detail>
						<Detail icon={mailIcon} label="E-mail">
							<span className="break-all">{user.email}</span>
						</Detail>
						<Detail icon={sendIcon} label="Candidatures">
							{applicationsLabel(user.applications_sent)}
						</Detail>
						<Detail icon={calendarIcon} label="Inscription">
							Inscription le <time dateTime={user.date_joined}>{formatDate(user.date_joined)}</time>
						</Detail>
					</dl>
					<div className="mt-8 flex flex-col items-start gap-3 text-base font-semibold">
						{/* A plain link, as for the recruiters: the server names the file (Content-Disposition) */}
						{user.cv_url ? (
							<a href={user.cv_url} download className={`inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-on-primary hover:bg-primary/90 ${focus}`}>
								<DownloadIcon width={18} height={18} />
								Télécharger le CV
							</a>
						) : (
							<p className="text-base font-normal text-[#6b7280]">CV non déposé</p>
						)}
						{user.is_active ? (
							<button
								type="button"
								onClick={() => {
									setError("");
									setDone("");
									setConfirming(true);
								}}
								className={`cursor-pointer rounded-lg bg-[#e00000] px-4 py-2 text-white hover:bg-[#c00000] ${focus}`}
							>
								Suspendre le compte
							</button>
						) : (
							<button
								type="button"
								onClick={() => change(false)}
								disabled={pending}
								className={`cursor-pointer rounded-lg px-4 py-2 text-primary inset-ring inset-ring-primary hover:bg-[#dae8ff] disabled:cursor-wait disabled:opacity-70 ${focus}`}
							>
								{pending ? "Rétablissement…" : "Rétablir le compte"}
							</button>
						)}
						{/* Outside the window: the error of « Rétablir le compte » */}
						{error && !confirming && <p role="alert" className="text-sm font-medium text-[#DC2626]">{error}</p>}
						<p role="status" className="text-sm font-normal text-[#6b7280]">{done}</p>
					</div>
					{user.is_active && <SuspendAccountDialog
						open={confirming}
						name={name}
						pending={pending}
						error={confirming ? error : ""}
						onCancel={() => {
							if (pendingRef.current) return;
							setConfirming(false);
							setError("");
						}}
						onConfirm={() => change(true)}
					/>}
				</div>
			</div>
		</section>
	);
}

const ERRORS = {
	notFound: "Cet étudiant est introuvable.",
	forbidden: "Accès interdit ou session expirée.",
	server: "Impossible de charger la fiche.",
	network: "Connexion au serveur impossible.",
};

export default function AdminUserDetailPage() {
	const { id = "" } = useParams();
	const location = useLocation();
	// The table as it was left: search, filters, sort and page
	const back = adminUsersLink(location.state?.adminUsersReturnTo);
	const [attempt, setAttempt] = useState(0);
	const [loaded, setLoaded] = useState<{ id: string; attempt: number; result: AdminUserDetailResult } | null>(null);

	useEffect(() => {
		let ignore = false;
		getAdminUser(id).then((result) => {
			if (!ignore) setLoaded({ id, attempt, result });
		});
		return () => {
			ignore = true;
		};
	}, [id, attempt]);

	const result = loaded?.id === id && loaded.attempt === attempt ? loaded.result : null;
	return (
		<div className="min-h-dvh bg-[#f0f0f0] px-4 py-6 text-ink md:px-10 md:py-16">
			<header><AdminNavbar /></header>
			<main className="mx-auto mt-10 max-w-[786px] md:mt-16" aria-busy={!result}>
				<Link to={back} className={`mb-5 inline-block rounded text-primary hover:underline ${focus}`}>← Retour à la liste</Link>
				{!result ? (
					<p role="status" className="py-12 text-center">Chargement de la fiche…</p>
				) : result.ok ? (
					<AdminStudentProfile key={result.user.id} user={result.user} onChange={(user) => setLoaded({ id, attempt, result: { ok: true, user } })} />
				) : (
					<div className="rounded-3xl bg-surface p-10 text-center">
						<p role="alert">{ERRORS[result.reason]}</p>
						{result.reason === "forbidden" ? (
							<Link to={adminLoginLink(location.pathname)} className="mt-4 inline-block text-primary underline">Se connecter</Link>
						) : result.reason !== "notFound" && (
							<button type="button" onClick={() => setAttempt(attempt + 1)} className="mt-4 cursor-pointer text-primary underline">Réessayer</button>
						)}
					</div>
				)}
			</main>
		</div>
	);
}
