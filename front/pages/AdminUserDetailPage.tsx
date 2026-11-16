import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import AdminNavbar from "../components/AdminNavbar";
import { getAdminUser, type AdminUserDetail, type AdminUserDetailResult } from "../services/adminUsers";
import { adminUsersLink } from "../utils/adminUsers";

export function AdminStudentProfile({ user }: { user: AdminUserDetail }) {
	const [downloadError, setDownloadError] = useState("");
	const [downloading, setDownloading] = useState(false);
	const download = async () => {
		if (!user.cv_url || downloading) return;
		setDownloading(true); setDownloadError("");
		try {
			const response = await fetch(user.cv_url, { credentials: "same-origin" });
			if (!response.ok) throw new Error();
			const url = URL.createObjectURL(await response.blob());
			const link = document.createElement("a");
			link.href = url;
			link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "CV";
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		} catch { setDownloadError("Le CV n’a pas pu être téléchargé. Veuillez réessayer."); }
		finally { setDownloading(false); }
	};
	const registered = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris" }).format(new Date(user.date_joined));
	return <section aria-labelledby="student-name" className="mx-auto max-w-[786px] rounded-[24px] bg-surface px-6 pt-6 pb-10 shadow-[0_4px_12px_rgba(0,0,0,0.1)] sm:px-12">
		<h1 id="student-name" className="text-center text-2xl font-semibold text-[#111827]">{user.first_name} {user.last_name}</h1>
		<div className="mt-10 flex flex-col items-center gap-8 sm:flex-row sm:gap-12">
			<svg className="size-44 shrink-0 sm:size-60" viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><circle cx="28" cy="28" r="26" /><circle cx="28" cy="22" r="9" /><path d="M14 49v-2a14 14 0 0 1 28 0v2" /></svg>
			<div className="min-w-0 space-y-5 text-xl font-medium">
				<p className="break-words"><span aria-hidden="true">▦ </span><span className="sr-only">École : </span>{user.school ?? "École non renseignée"}</p>
				<p className="flex items-center gap-2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m7 3 3 5-3 3c2 3 3 4 6 6l3-3 5 3-1 4C10 23 1 14 3 4Z" strokeLinejoin="round" /></svg><span className="sr-only">Téléphone : </span>{user.phone ?? "Téléphone non renseigné"}</p>
				<p className="break-all"><span aria-hidden="true">@ </span>{user.email}</p>
				<p>{user.applications_sent} candidature{user.applications_sent === 1 ? "" : "s"} envoyée{user.applications_sent === 1 ? "" : "s"}</p>
				<p className="text-sm font-normal text-[#6b7280]">A rejoint le <time dateTime={user.date_joined}>{registered}</time></p>
				{!user.is_active && <p className="text-base text-red-600">Compte suspendu{user.suspended_at && ` le ${new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris" }).format(new Date(user.suspended_at))}`}</p>}
				<div className="flex flex-col items-start gap-4 text-base font-semibold">
					<button type="button" onClick={download} disabled={!user.cv_url || downloading} className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-50">{downloading ? "Téléchargement…" : "Télécharger le CV"}</button>
					{!user.cv_url && <p className="text-sm font-normal text-[#6b7280]">Aucun CV disponible.</p>}
					{downloadError && <p role="alert" className="text-sm font-normal text-red-600">{downloadError}</p>}
					<button type="button" disabled title="Fonctionnalité bientôt disponible" className="cursor-not-allowed rounded-lg bg-[#e00000] px-4 py-2 text-white opacity-60">{user.is_active ? "Suspendre le compte" : "Compte suspendu"}</button>
				</div>
			</div>
		</div>
	</section>;
}

export default function AdminUserDetailPage() {
	const { id = "" } = useParams();
	const location = useLocation();
	// The table as it was left: search, filters, sort and page
	const back = adminUsersLink(location.state?.adminUsersReturnTo);
	const [attempt, setAttempt] = useState(0);
	const [loaded, setLoaded] = useState<{ id: string; attempt: number; result: AdminUserDetailResult } | null>(null);
	useEffect(() => {
		let ignore = false;
		getAdminUser(id).then((result) => { if (!ignore) setLoaded({ id, attempt, result }); });
		return () => { ignore = true; };
	}, [id, attempt]);
	const result = loaded?.id === id && loaded.attempt === attempt ? loaded.result : null;
	return <div className="min-h-dvh bg-[#f0f0f0] px-4 py-6 text-ink md:px-10 md:py-16">
		<header className="mx-auto max-w-[1472px]"><AdminNavbar /></header>
		<main className="mx-auto mt-10 max-w-[786px] md:mt-16" aria-busy={!result}>
			<Link to={back} className="mb-5 inline-block rounded text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">← Retour à la liste</Link>
			{!result ? <p role="status" className="py-12 text-center">Chargement de la fiche…</p> : result.ok ? <AdminStudentProfile key={result.user.id} user={result.user} />
				: <div className="rounded-3xl bg-surface p-10 text-center"><p role="alert">{result.reason === "notFound" ? "Cet étudiant est introuvable." : result.reason === "forbidden" ? "Accès interdit ou session expirée." : "Impossible de charger la fiche."}</p>{result.reason === "forbidden" ? <Link to="/login" className="mt-4 inline-block text-primary underline">Se connecter</Link> : result.reason !== "notFound" && <button onClick={() => setAttempt(attempt + 1)} className="mt-4 cursor-pointer text-primary underline">Réessayer</button>}</div>}
		</main>
	</div>;
}
