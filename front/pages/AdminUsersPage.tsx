import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import AdminNavbar from "../components/AdminNavbar";
import ChevronDownIcon from "../components/ChevronDownIcon";
import ExportPanel from "../components/ExportPanel";
import Pagination from "../components/Pagination";
import SearchIcon from "../components/SearchIcon";
import { getAdminUsers, type AdminUser, type AdminUsersResult } from "../services/adminUsers";
import {
	adminLoginLink,
	formatDate,
	hasCriteria,
	MAX_SELECTION,
	nextSort,
	PAGE_SIZES,
	queryFromParams,
	rangeLabel,
	ROLE_CHOICES,
	ROLE_LABELS,
	readSelection,
	saveSelection,
	searchFromQuery,
	sortDirection,
	toggleIds,
	withChanges,
	type AdminUserRole,
	type AdminUserSort,
	type AdminUserStatus,
	type AdminUsersQuery,
	type SortColumn,
} from "../utils/adminUsers";
import type { ExportField, ExportValues } from "../utils/exports";
import { field, focus, input, select } from "../utils/searchPageStyles";

const COLUMNS: { column: SortColumn; label: string }[] = [
	{ column: "first_name", label: "Prénom" },
	{ column: "last_name", label: "Nom" },
	{ column: "email", label: "E-mail" },
	{ column: "role", label: "Type de compte" },
	{ column: "date_joined", label: "Inscription" },
];

const cell = "px-4 py-3.5";
const chevron = "pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-gray-500";
const arrow = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>;

// Both triangles, the one of the current direction in the color of the text
export function SortArrows({ direction }: { direction: "ascending" | "descending" | undefined }) {
	return (
		<svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true" className="shrink-0">
			<path d="M5 1 9 6H1z" fill={direction === "ascending" ? "currentColor" : "#c4c8d0"} />
			<path d="M5 13 1 8h8z" fill={direction === "descending" ? "currentColor" : "#c4c8d0"} />
		</svg>
	);
}

const checkbox = "size-4 cursor-pointer accent-primary";

function AccountRow({ user, returnTo, selection }: { user: AdminUser; returnTo: string; selection?: Selection }) {
	const name = `${user.first_name} ${user.last_name}`;
	const checked = selection?.ids.includes(user.id) ?? false;
	return (
		<tr className={`border-t border-[#e1e3e8] ${checked ? "bg-[#eff6ff]" : "hover:bg-[#f9fafb]"}`}>
			{selection && (
				<td className={`${cell} w-10`}>
					<input type="checkbox" checked={checked} onChange={(e) => selection.onChange(toggleIds(selection.ids, [user.id], e.target.checked))} aria-label={`Sélectionner ${name}`} className={checkbox} />
				</td>
			)}
			<td className={cell}>{user.first_name}</td>
			<td className={`${cell} font-medium`}>{user.last_name}</td>
			<td className={`${cell} whitespace-nowrap`}>{user.email}</td>
			<td className={`${cell} whitespace-nowrap`}>{ROLE_LABELS[user.role] ?? "Inconnu"}</td>
			<td className={`${cell} whitespace-nowrap`}><time dateTime={user.date_joined}>{formatDate(user.date_joined)}</time></td>
			<td className={`${cell} whitespace-nowrap`}>
				{user.is_active ? (
					<span className="rounded-full bg-[#dcfce7] px-2.5 py-1 text-xs font-semibold text-[#166534]">Actif</span>
				) : (
					<span className="text-xs font-semibold text-[#e00000]">
						{user.suspended_at ? <>Suspendu le <time dateTime={user.suspended_at}>{formatDate(user.suspended_at)}</time></> : "Suspendu, date non renseignée"}
					</span>
				)}
			</td>
			<td className={`${cell} text-right`}>
				{user.detail_url ? (
					<Link to={user.detail_url} state={{ adminUsersReturnTo: returnTo }} aria-label={`Voir la fiche de ${name}`} title="Voir la fiche" className={`inline-flex rounded-full p-2 hover:bg-primary hover:text-on-primary ${focus}`}>
						{arrow}
					</Link>
				) : (
					<button type="button" disabled aria-label={`Fiche de ${name} bientôt disponible`} title="Fiche bientôt disponible" className="inline-flex p-2 text-[#9ca3af]">
						{arrow}
					</button>
				)}
			</td>
		</tr>
	);
}

/** Accounts ticked in the table, from every page */
type Selection = { ids: number[]; onChange: (ids: number[]) => void };

type AdminUsersTableProps = {
	users: AdminUser[];
	sort: AdminUserSort;
	onSort: (sort: AdminUserSort) => void;
	/** Without it, the table has no checkboxes */
	selection?: Selection;
};

// Ticks or unticks the accounts of the page; half ticked when only some of them are
function SelectPage({ users, selection }: { users: AdminUser[]; selection: Selection }) {
	const ids = users.map((user) => user.id);
	const ticked = ids.filter((id) => selection.ids.includes(id)).length;
	const ref = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (ref.current) ref.current.indeterminate = ticked > 0 && ticked < ids.length;
	}, [ticked, ids.length]);
	return <input ref={ref} type="checkbox" checked={ticked === ids.length} onChange={(e) => selection.onChange(toggleIds(selection.ids, ids, e.target.checked))} aria-label="Sélectionner tous les comptes de la page" className={checkbox} />;
}

// Wider than a phone: the table scrolls sideways inside its frame, never the page. The frame is
// positioned so that the hidden header (sr-only, absolute) stays inside it too
export function AdminUsersTable({ users, sort, onSort, selection }: AdminUsersTableProps) {
	const location = useLocation();
	const returnTo = location.pathname + location.search;
	return (
		<div role="region" aria-label="Comptes utilisateurs" tabIndex={0} className={`relative overflow-x-auto rounded-2xl border border-[#e1e3e8] ${focus}`}>
			<table className="w-full min-w-[900px] border-collapse text-left text-sm text-ink">
				<thead className="bg-[#f9fafb] text-xs text-[#6b7280]">
					<tr>
						{selection && <th scope="col" className={`${cell} w-10`}><SelectPage users={users} selection={selection} /></th>}
						{COLUMNS.map(({ column, label }) => {
							const direction = sortDirection(sort, column);
							return (
								<th key={column} scope="col" aria-sort={direction} className={`${cell} font-semibold`}>
									<button
										type="button"
										onClick={() => onSort(nextSort(sort, column))}
										className={`inline-flex cursor-pointer items-center gap-1.5 rounded-sm whitespace-nowrap hover:text-ink ${direction ? "text-ink" : ""} ${focus}`}
									>
										{label}
										<SortArrows direction={direction} />
									</button>
								</th>
							);
						})}
						<th scope="col" className={`${cell} font-semibold`}>Statut</th>
						<th scope="col" className={cell}><span className="sr-only">Fiche</span></th>
					</tr>
				</thead>
				<tbody>
					{users.map((user) => <AccountRow key={user.id} user={user} returnTo={returnTo} selection={selection} />)}
				</tbody>
			</table>
		</div>
	);
}

// Results follow the typing (ADM-09), 300 ms after the last key
export function SearchField({ value, onSearch, label = "Rechercher un utilisateur par nom, e-mail, école ou entreprise", placeholder = "Rechercher par nom, e-mail, école ou entreprise…" }: { value: string; onSearch: (q: string) => void; label?: string; placeholder?: string }) {
	const [typed, setTyped] = useState(value);
	const [shown, setShown] = useState(value);
	// The search changed elsewhere (« Réinitialiser », browser arrows): the field follows
	if (value !== shown) {
		setShown(value);
		if (value !== typed.trim()) setTyped(value);
	}

	useEffect(() => {
		const q = typed.trim();
		if (q === value) return;
		const timer = setTimeout(() => onSearch(q), 300);
		return () => clearTimeout(timer);
	}, [typed, value, onSearch]);

	return (
		<label className={`${field} lg:flex-1`}>
			<SearchIcon width={20} height={20} className="text-gray-500" />
			<span className="sr-only">{label}</span>
			<input type="search" value={typed} maxLength={100} onChange={(e) => setTyped(e.target.value)} placeholder={placeholder} className={input} />
		</label>
	);
}

type AdminUsersToolbarProps = {
	query: AdminUsersQuery;
	onSearch: (q: string) => void;
	onChange: (changes: Partial<AdminUsersQuery>) => void;
	onReset: () => void;
};

export function AdminUsersToolbar({ query, onSearch, onChange, onReset }: AdminUsersToolbarProps) {
	return (
		<form role="search" aria-label="Rechercher et filtrer les utilisateurs" onSubmit={(e) => e.preventDefault()} className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
			<SearchField value={query.q} onSearch={onSearch} />
			<label className="relative lg:w-[220px]">
				<span className="sr-only">Type de compte</span>
				<select value={query.role} onChange={(e) => onChange({ role: e.target.value as AdminUserRole })} className={select}>
					<option value="">Tous les types</option>
					{ROLE_CHOICES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
					{/* An administrator filter of the URL stays shown: the form always matches the table */}
					{query.role === "admin" && <option value="admin">Administrateurs</option>}
				</select>
				<ChevronDownIcon width={20} height={20} className={chevron} />
			</label>
			<label className="relative lg:w-[220px]">
				<span className="sr-only">Statut du compte</span>
				<select value={query.status} onChange={(e) => onChange({ status: e.target.value as AdminUserStatus })} className={select}>
					<option value="">Tous les statuts</option>
					<option value="active">Actifs</option>
					<option value="suspended">Suspendus</option>
				</select>
				<ChevronDownIcon width={20} height={20} className={chevron} />
			</label>
			{hasCriteria(query) && (
				<button type="button" onClick={onReset} className={`cursor-pointer self-start rounded-xl px-3 py-2.5 text-sm font-semibold text-primary hover:underline lg:self-auto ${focus}`}>
					Réinitialiser
				</button>
			)}
		</form>
	);
}

const ERRORS = {
	forbidden: "Accès interdit ou session expirée. Connectez-vous avec un compte administrateur.",
	notFound: "Cette page n’existe plus.",
	server: "Impossible de charger les utilisateurs.",
	network: "Connexion au serveur impossible.",
};

type AdminUsersResultsProps = {
	/** Answer shown: that of the table on screen, or the previous one while the next loads */
	result: AdminUsersResult | null;
	loading: boolean;
	query: AdminUsersQuery;
	onChange: (changes: Partial<AdminUsersQuery>) => void;
	onRetry: () => void;
	onReset: () => void;
	selection?: Selection;
};

export function AdminUsersResults({ result, loading, query, onChange, onRetry, onReset, selection }: AdminUsersResultsProps) {
	if (!result) return <p role="status" className="py-16 text-center text-sm text-[#6b7280]">Chargement des utilisateurs…</p>;
	if (!result.ok) {
		return (
			<div className="py-16 text-center">
				<p role="alert" className="text-sm">{ERRORS[result.reason]}</p>
				{result.reason === "forbidden" ? (
					<Link to={adminLoginLink("/administration/users")} className="mt-4 inline-block text-sm font-semibold text-primary underline">Se connecter</Link>
				) : (
					<button type="button" onClick={result.reason === "notFound" ? () => onChange({ page: 1 }) : onRetry} className="mt-4 cursor-pointer text-sm font-semibold text-primary underline">
						{result.reason === "notFound" ? "Revenir à la première page" : "Réessayer"}
					</button>
				)}
			</div>
		);
	}
	if (result.count === 0) {
		// ADM-09: a message when no account matches
		if (!hasCriteria(query)) return <p role="status" className="py-16 text-center text-sm text-[#6b7280]">Aucun utilisateur inscrit pour le moment.</p>;
		return (
			<div className="py-16 text-center">
				<p role="status" className="text-sm text-[#6b7280]">Aucun utilisateur ne correspond à votre recherche.</p>
				<button type="button" onClick={onReset} className="mt-4 cursor-pointer text-sm font-semibold text-primary underline">Réinitialiser les filtres</button>
			</div>
		);
	}
	return (
		<div className={loading ? "opacity-60" : ""}>
			<AdminUsersTable users={result.results} sort={query.sort} onSort={(sort) => onChange({ sort })} selection={selection} />
			<div className="mt-6 flex flex-col items-center gap-4 text-xs sm:text-sm text-[#6b7280] lg:flex-row lg:justify-between">
				<p role="status">{rangeLabel(result.count, result.page, result.page_size, result.results.length)}</p>
				<Pagination currentPage={result.page} totalPages={result.total_pages} onPageChange={(page) => onChange({ page })} />
				<label className="flex items-center gap-2">
					Lignes par page
					<select value={query.page_size} onChange={(e) => onChange({ page_size: Number(e.target.value) })} className={`cursor-pointer rounded-lg border border-[#d1d5db] bg-surface px-2.5 py-1.5 text-ink ${focus}`}>
						{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
					</select>
				</label>
			</div>
		</div>
	);
}

// Role of the export for each type of account of the table (the export calls managers "school")
const EXPORT_ROLES: Record<AdminUserRole, string> = { "": "", student: "student", manager: "school", recruiter: "recruiter", admin: "admin" };

// Starting values of the export: the filters of the table
export const exportDefaults = (query: AdminUsersQuery): ExportValues => ({ role: EXPORT_ROLES[query.role], status: query.status });

// Filters of the export: the current ones of the table, and the ticked accounts
export function exportFields(query: AdminUsersQuery, selected: number[]): ExportField[] {
	const fields: ExportField[] = [
		{ kind: "select", key: "role", label: "Type de compte", options: [{ value: "", label: "Tous les types" }, { value: "student", label: "Étudiants" }, { value: "school", label: "Managers" }, { value: "recruiter", label: "Recruteurs" }, { value: "admin", label: "Administrateurs" }] },
		{ kind: "select", key: "status", label: "Statut du compte", options: [{ value: "", label: "Tous les statuts" }, { value: "active", label: "Actifs" }, { value: "suspended", label: "Suspendus" }] },
	];
	if (selected.length > 0) fields.push({ kind: "toggle", key: "ids", label: `Seulement les ${selected.length} compte${selected.length > 1 ? "s" : ""} sélectionné${selected.length > 1 ? "s" : ""}`, value: selected.join(",") });
	if (query.q) fields.push({ kind: "toggle", key: "q", label: `Appliquer la recherche « ${query.q} »`, value: query.q });
	return fields;
}

// Data table of the accounts of every role (ADM-01): search, filters by account type and status, sort by column, pagination
export default function AdminUsersPage() {
	const [params, setParams] = useSearchParams();
	const query = queryFromParams(params);
	const search = searchFromQuery(query);
	const [attempt, setAttempt] = useState(0);
	const [loaded, setLoaded] = useState<{ search: string; attempt: number; result: AdminUsersResult } | null>(null);
	// Kept while a profile is open, so that « Retour à la liste » gives the table back as it was
	const [selected, setSelected] = useState(readSelection);
	useEffect(() => saveSelection(selected), [selected]);

	useEffect(() => {
		// A newer search cancels this request: its answer never replaces the newer one
		const controller = new AbortController();
		getAdminUsers(search, controller.signal).then((result) => {
			if (!controller.signal.aborted) setLoaded({ search, attempt, result });
		});
		return () => controller.abort();
	}, [search, attempt]);

	// Each change is a step of the browser history, except the typing of the search
	const update = useCallback(
		(changes: Partial<AdminUsersQuery>, replace = false) => setParams((previous) => searchFromQuery(withChanges(queryFromParams(previous), changes)), { replace }),
		[setParams],
	);
	const onSearch = useCallback((q: string) => update({ q }, true), [update]);
	const onReset = () => update({ q: "", status: "", role: "" });

	const current = loaded && loaded.search === search && loaded.attempt === attempt ? loaded.result : null;
	// While the next answer loads, the previous table stays on screen
	const shown = current ?? (loaded?.result.ok ? loaded.result : null);

	return (
		<div className="min-h-dvh bg-[#f8fafc] px-4 pt-4 pb-16 text-ink md:px-6 md:pt-6">
			<header><AdminNavbar /></header>
			<main className="mx-auto mt-8 max-w-[1236px] rounded-2xl border border-[#e5e7eb] bg-surface px-5 py-7 shadow-xs md:px-10 md:py-8" aria-busy={current === null}>
				<div className="mb-6 flex flex-col gap-1">
					<h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Utilisateurs</h1>
					<p className="text-sm text-[#6b7280]">Consultez et gérez les comptes inscrits sur la plateforme : étudiants, managers, recruteurs et administrateurs.</p>
				</div>
				<AdminUsersToolbar query={query} onSearch={onSearch} onChange={update} onReset={onReset} />
				<div className="mb-6 flex flex-col gap-3">
					<ExportPanel url="/api/administration/users/export" fields={exportFields(query, selected)} defaults={exportDefaults(query)} />
					{selected.length > 0 && (
						<p role="status" className="text-sm text-[#6b7280]">
							<strong className="text-ink">{selected.length}</strong> compte{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}{selected.length === MAX_SELECTION ? ` (${MAX_SELECTION} au maximum)` : ""}
						</p>
					)}
				</div>
				<AdminUsersResults result={shown} loading={current === null} query={query} onChange={update} onRetry={() => setAttempt(attempt + 1)} onReset={onReset} selection={{ ids: selected, onChange: setSelected }} />
			</main>
		</div>
	);
}
