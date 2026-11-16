import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import AdminNavbar from "../components/AdminNavbar";
import Pagination from "../components/Pagination";
import { getAdminUsers, type AdminUser, type AdminUsersResult } from "../services/adminUsers";

const date = (value: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris" }).format(new Date(value));

export function AdminUserCard({ user }: { user: AdminUser }) {
	const location = useLocation();
	const name = `${user.first_name} ${user.last_name}`;
	const arrow = <svg width="24" height="36" viewBox="0 0 24 36" fill="none" stroke="currentColor" strokeWidth="4" aria-hidden="true"><path d="m6 5 12 13L6 31" strokeLinecap="round" strokeLinejoin="round" /></svg>;
	return <li className="flex min-h-32 items-center gap-4 rounded-[28px] border border-[#e1e3e8] px-4 py-4 sm:gap-7 sm:px-5">
		<svg className="size-14 shrink-0" viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><circle cx="28" cy="28" r="26" /><circle cx="28" cy="22" r="9" /><path d="M14 49v-2a14 14 0 0 1 28 0v2" /></svg>
		<div className="min-w-0 flex-1 space-y-1.5 text-base">
			<p className="break-words">{name}</p><p className="break-all">{user.email}</p>
			<p>Rejoint le <time dateTime={user.date_joined}>{date(user.date_joined)}</time></p>
			{!user.is_active && <p className="text-[#e00000]">{user.suspended_at ? <>Suspendu le <time dateTime={user.suspended_at}>{date(user.suspended_at)}</time></> : "Compte suspendu — date non renseignée"}</p>}
		</div>
		{user.detail_url ? <Link to={user.detail_url} state={{ adminUsersReturnTo: location.pathname + location.search }} aria-label={`Voir la fiche de ${name}`} className="shrink-0 rounded p-2 focus-visible:outline-2 focus-visible:outline-primary">{arrow}</Link>
			: <button type="button" disabled aria-label={`Fiche de ${name} bientôt disponible`} title="Fiche bientôt disponible" className="shrink-0 p-2 text-[#9ca3af]">{arrow}</button>}
	</li>;
}

export function AdminUsersContent({ result, onRetry, onPageChange }: { result: AdminUsersResult | null; onRetry: () => void; onPageChange: (page: number) => void }) {
	if (!result) return <p role="status" className="py-20 text-center">Chargement des utilisateurs…</p>;
	if (!result.ok) {
		const messages = { forbidden: "Accès interdit ou session expirée. Connectez-vous avec un compte administrateur.", notFound: "Cette page n’existe plus.", server: "Impossible de charger les utilisateurs.", network: "Connexion au serveur impossible." };
		return <div className="py-20 text-center"><p role="alert">{messages[result.reason]}</p>
			{result.reason === "forbidden" ? <Link to="/login" className="mt-4 inline-block text-primary underline">Se connecter</Link>
				: <button onClick={result.reason === "notFound" ? () => onPageChange(1) : onRetry} className="mt-4 cursor-pointer text-primary underline">{result.reason === "notFound" ? "Revenir à la première page" : "Réessayer"}</button>}
		</div>;
	}
	if (result.results.length === 0) return <p role="status" className="py-20 text-center">Aucun utilisateur inscrit pour le moment.</p>;
	return <>
		<ul aria-label="Utilisateurs inscrits" className="grid grid-cols-1 gap-x-12 gap-y-3 md:grid-cols-2">{result.results.map((user) => <AdminUserCard key={user.id} user={user} />)}</ul>
		<div className="mt-12"><Pagination currentPage={result.page} totalPages={result.total_pages} onPageChange={onPageChange} /></div>
	</>;
}

export default function AdminUsersPage() {
	const [params, setParams] = useSearchParams();
	const rawPage = params.get("page") ?? "1";
	const page = /^[1-9]\d{0,8}$/.test(rawPage) ? Number(rawPage) : 1;
	const [attempt, setAttempt] = useState(0);
	const [loaded, setLoaded] = useState<{ page: number; attempt: number; result: AdminUsersResult } | null>(null);
	useEffect(() => {
		let ignore = false;
		getAdminUsers(page).then((result) => { if (!ignore) setLoaded({ page, attempt, result }); });
		return () => { ignore = true; };
	}, [page, attempt]);
	const result = loaded?.page === page && loaded.attempt === attempt ? loaded.result : null;
	return <div className="min-h-dvh bg-[#f0f0f0] px-4 py-6 text-ink md:px-10 md:py-16">
		<header className="mx-auto max-w-[1472px]"><AdminNavbar /></header>
		<main className="mx-auto mt-10 max-w-[1472px] rounded-[28px] bg-surface px-4 pt-6 pb-7 shadow-[0_4px_12px_rgba(0,0,0,0.1)] md:mt-16 md:px-20" aria-busy={result === null}>
			<h1 className="mb-10 text-center text-3xl font-semibold text-[#111827] md:text-4xl">Liste d’utilisateurs</h1>
			<AdminUsersContent result={result} onRetry={() => setAttempt(attempt + 1)} onPageChange={(next) => setParams({ page: String(next) })} />
		</main>
	</div>;
}
