import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import AdminNavbar from "../components/AdminNavbar";
import ChevronDownIcon from "../components/ChevronDownIcon";
import Pagination from "../components/Pagination";
import SearchIcon from "../components/SearchIcon";
import { getAdminUserFilters, getAdminUsers, type AdminSchool, type AdminUser, type AdminUsersResult } from "../services/adminUsers";
import {
	adminLoginLink,
	formatDate,
	hasCriteria,
	nextSort,
	PAGE_SIZES,
	queryFromParams,
	rangeLabel,
	searchFromQuery,
	sortDirection,
	withChanges,
	type AdminUserSort,
	type AdminUserStatus,
	type AdminUsersQuery,
	type SortColumn,
} from "../utils/adminUsers";
import { field, focus, input, select } from "../utils/searchPageStyles";

const COLUMNS: { column: SortColumn; label: string }[] = [
	{ column: "first_name", label: "Prénom" },
	{ column: "last_name", label: "Nom" },
	{ column: "email", label: "E-mail" },
	{ column: "school", label: "École" },
	{ column: "date_joined", label: "Inscription" },
];

const cell = "px-4 py-3";
const chevron = "pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-gray-500";
const arrow = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>;

// Both triangles, the one of the current direction in the color of the text
function SortArrows({ direction }: { direction: "ascending" | "descending" | undefined }) {
	return (
		<svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true" className="shrink-0">
			<path d="M5 1 9 6H1z" fill={direction === "ascending" ? "currentColor" : "#c4c8d0"} />
			<path d="M5 13 1 8h8z" fill={direction === "descending" ? "currentColor" : "#c4c8d0"} />
		</svg>
	);
}

function AccountRow({ user, returnTo }: { user: AdminUser; returnTo: string }) {
	const name = `${user.first_name} ${user.last_name}`;
	return (
		<tr className="border-t border-[#e1e3e8] hover:bg-[#f9fafb]">
			<td className={cell}>{user.first_name}</td>
			<td className={`${cell} font-medium`}>{user.last_name}</td>
			<td className={`${cell} whitespace-nowrap`}>{user.email}</td>
			<td className={cell}>{user.school ?? <span className="text-[#9ca3af]">Non renseignée</span>}</td>
			<td className={`${cell} whitespace-nowrap`}><time dateTime={user.date_joined}>{formatDate(user.date_joined)}</time></td>
			<td className={`${cell} whitespace-nowrap`}>
				{user.is_active ? (
					<span className="rounded-full bg-[#dcfce7] px-2.5 py-1 text-[13px] font-medium text-[#166534]">Actif</span>
				) : (
					<span className="font-medium text-[#e00000]">
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

type AdminUsersTableProps = {
	users: AdminUser[];
	sort: AdminUserSort;
	onSort: (sort: AdminUserSort) => void;
};

// Wider than a phone: the table scrolls sideways inside its frame, never the page. The frame is
// positioned so that the hidden header (sr-only, absolute) stays inside it too
export function AdminUsersTable({ users, sort, onSort }: AdminUsersTableProps) {
	const location = useLocation();
	const returnTo = location.pathname + location.search;
	return (
		<div role="region" aria-label="Comptes étudiants" tabIndex={0} className={`relative overflow-x-auto rounded-[20px] border border-[#e1e3e8] ${focus}`}>
			<table className="w-full min-w-[860px] border-collapse text-left text-[15px] text-[#111827]">
				<thead className="bg-[#f9fafb] text-[13px] text-[#6b7280]">
					<tr>
						{COLUMNS.map(({ column, label }) => {
							const direction = sortDirection(sort, column);
							return (
								<th key={column} scope="col" aria-sort={direction} className={`${cell} font-semibold`}>
									<button
										type="button"
										onClick={() => onSort(nextSort(sort, column))}
										className={`inline-flex cursor-pointer items-center gap-1.5 rounded-sm whitespace-nowrap hover:text-[#111827] ${direction ? "text-[#111827]" : ""} ${focus}`}
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
					{users.map((user) => <AccountRow key={user.id} user={user} returnTo={returnTo} />)}
				</tbody>
			</table>
		</div>
	);
}

// Results follow the typing (ADM-09), 300 ms after the last key
function SearchField({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
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
			<span className="sr-only">Rechercher un étudiant par nom, e-mail ou école</span>
			<input type="search" value={typed} maxLength={100} onChange={(e) => setTyped(e.target.value)} placeholder="Rechercher par nom, e-mail ou école…" className={input} />
		</label>
	);
}

type AdminUsersToolbarProps = {
	query: AdminUsersQuery;
	/** Values of the "École" filter: null while they load */
	schools: AdminSchool[] | "error" | null;
	onSearch: (q: string) => void;
	onChange: (changes: Partial<AdminUsersQuery>) => void;
	onReset: () => void;
};

export function AdminUsersToolbar({ query, schools, onSearch, onChange, onReset }: AdminUsersToolbarProps) {
	const choices = Array.isArray(schools) ? schools : [];
	// A school of the URL that is not offered (any more) stays shown: the form always matches the table
	const unknownSchool = query.school !== "" && !choices.some((school) => String(school.id) === query.school);
	return (
		<form role="search" aria-label="Rechercher et filtrer les étudiants" onSubmit={(e) => e.preventDefault()} className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
			<SearchField value={query.q} onSearch={onSearch} />
			<label className="relative lg:w-[220px]">
				<span className="sr-only">Statut du compte</span>
				<select value={query.status} onChange={(e) => onChange({ status: e.target.value as AdminUserStatus })} className={select}>
					<option value="">Tous les statuts</option>
					<option value="active">Actifs</option>
					<option value="suspended">Suspendus</option>
				</select>
				<ChevronDownIcon width={20} height={20} className={chevron} />
			</label>
			<label className="relative lg:w-[280px]">
				<span className="sr-only">École</span>
				<select value={query.school} disabled={!Array.isArray(schools)} onChange={(e) => onChange({ school: e.target.value })} className={`${select} disabled:cursor-default disabled:bg-[#f9fafb] disabled:text-[#9ca3af]`}>
					<option value="">{schools === "error" ? "Écoles indisponibles" : "Toutes les écoles"}</option>
					{choices.map((school) => <option key={school.id} value={String(school.id)}>{school.name}</option>)}
					{unknownSchool && <option value={query.school}>École sélectionnée</option>}
				</select>
				<ChevronDownIcon width={20} height={20} className={chevron} />
			</label>
			{hasCriteria(query) && (
				<button type="button" onClick={onReset} className={`cursor-pointer self-start rounded-[14px] px-3 py-3.5 font-semibold text-primary hover:underline lg:self-auto ${focus}`}>
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
};

export function AdminUsersResults({ result, loading, query, onChange, onRetry, onReset }: AdminUsersResultsProps) {
	if (!result) return <p role="status" className="py-20 text-center">Chargement des utilisateurs…</p>;
	if (!result.ok) {
		return (
			<div className="py-20 text-center">
				<p role="alert">{ERRORS[result.reason]}</p>
				{result.reason === "forbidden" ? (
					<Link to={adminLoginLink("/administration/users")} className="mt-4 inline-block text-primary underline">Se connecter</Link>
				) : (
					<button type="button" onClick={result.reason === "notFound" ? () => onChange({ page: 1 }) : onRetry} className="mt-4 cursor-pointer text-primary underline">
						{result.reason === "notFound" ? "Revenir à la première page" : "Réessayer"}
					</button>
				)}
			</div>
		);
	}
	if (result.count === 0) {
		// ADM-09: a message when no student matches
		if (!hasCriteria(query)) return <p role="status" className="py-20 text-center">Aucun étudiant inscrit pour le moment.</p>;
		return (
			<div className="py-20 text-center">
				<p role="status">Aucun étudiant ne correspond à votre recherche.</p>
				<button type="button" onClick={onReset} className="mt-4 cursor-pointer text-primary underline">Réinitialiser les filtres</button>
			</div>
		);
	}
	return (
		<div className={loading ? "opacity-60" : ""}>
			<AdminUsersTable users={result.results} sort={query.sort} onSort={(sort) => onChange({ sort })} />
			<div className="mt-6 flex flex-col items-center gap-4 text-[14px] text-[#6b7280] lg:flex-row lg:justify-between">
				<p role="status">{rangeLabel(result.count, result.page, result.page_size, result.results.length)}</p>
				<Pagination currentPage={result.page} totalPages={result.total_pages} onPageChange={(page) => onChange({ page })} />
				<label className="flex items-center gap-2">
					Lignes par page
					<select value={query.page_size} onChange={(e) => onChange({ page_size: Number(e.target.value) })} className={`cursor-pointer rounded-[10px] border border-[#d1d5db] bg-white px-2 py-1.5 text-[#111827] ${focus}`}>
						{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
					</select>
				</label>
			</div>
		</div>
	);
}

// Data table of the student accounts (ADM-01): search, filters by status and school, sort by column, pagination
export default function AdminUsersPage() {
	const [params, setParams] = useSearchParams();
	const query = queryFromParams(params);
	const search = searchFromQuery(query);
	const [attempt, setAttempt] = useState(0);
	const [loaded, setLoaded] = useState<{ search: string; attempt: number; result: AdminUsersResult } | null>(null);
	const [schools, setSchools] = useState<AdminSchool[] | "error" | null>(null);

	useEffect(() => {
		// A newer search cancels this request: its answer never replaces the newer one
		const controller = new AbortController();
		getAdminUsers(search, controller.signal).then((result) => {
			if (!controller.signal.aborted) setLoaded({ search, attempt, result });
		});
		return () => controller.abort();
	}, [search, attempt]);

	useEffect(() => {
		const controller = new AbortController();
		getAdminUserFilters(controller.signal).then((result) => {
			if (!controller.signal.aborted) setSchools(result.ok ? result.schools : "error");
		});
		return () => controller.abort();
	}, []);

	// Each change is a step of the browser history, except the typing of the search
	const update = useCallback(
		(changes: Partial<AdminUsersQuery>, replace = false) => setParams((previous) => searchFromQuery(withChanges(queryFromParams(previous), changes)), { replace }),
		[setParams],
	);
	const onSearch = useCallback((q: string) => update({ q }, true), [update]);
	const onReset = () => update({ q: "", status: "", school: "" });

	const current = loaded && loaded.search === search && loaded.attempt === attempt ? loaded.result : null;
	// While the next answer loads, the previous table stays on screen
	const shown = current ?? (loaded?.result.ok ? loaded.result : null);

	return (
		<div className="min-h-dvh bg-[#f0f0f0] px-4 py-6 text-ink md:px-10 md:py-16">
			<header className="mx-auto max-w-[1472px]"><AdminNavbar /></header>
			<main className="mx-auto mt-10 max-w-[1236px] rounded-[28px] bg-surface px-4 pt-6 pb-7 shadow-[0_4px_12px_rgba(0,0,0,0.1)] md:mt-16 md:px-10" aria-busy={current === null}>
				<h1 className="mb-10 text-center text-3xl font-semibold text-[#111827] md:text-4xl">Liste d’utilisateurs</h1>
				<AdminUsersToolbar query={query} schools={schools} onSearch={onSearch} onChange={update} onReset={onReset} />
				<AdminUsersResults result={shown} loading={current === null} query={query} onChange={update} onRetry={() => setAttempt(attempt + 1)} onReset={onReset} />
			</main>
		</div>
	);
}
