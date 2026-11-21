import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import AdminNavbar from "./AdminNavbar";
import ChevronDownIcon from "./ChevronDownIcon";
import Pagination from "./Pagination";
import { SearchField, SortArrows } from "../pages/AdminUsersPage";
import { getAdminOrganizations, setOrganizationStatus, type OrganizationRows, type OrganizationsResult } from "../services/adminOrganizations";
import {
	hasCriteria,
	nextSort,
	queryFromParams,
	rangeLabel,
	searchFromQuery,
	sortDirection,
	STATUS_LABELS,
	withChanges,
	type OrganizationKind,
	type OrganizationQuery,
	type ReviewStatus,
} from "../utils/adminOrganizations";
import { adminLoginLink, PAGE_SIZES } from "../utils/adminUsers";
import { focus, select } from "../utils/searchPageStyles";

export type OrganizationColumn<T> = {
	/** Name of the sort of the API; no sort when absent */
	column?: string;
	label: string;
	cell: (row: T) => ReactNode;
};

const cell = "px-4 py-3.5";
const chevron = "pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-gray-500";

const BADGES: Record<ReviewStatus, string> = {
	pending: "bg-[#fef3c7] text-[#92400e]",
	validated: "bg-[#dcfce7] text-[#166534]",
	refused: "bg-[#fee2e2] text-[#b91c1c]",
};

export function StatusBadge({ status }: { status: ReviewStatus }) {
	return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${BADGES[status]}`}>{STATUS_LABELS[status]}</span>;
}

// Every status can be replaced by another one, so that a choice can be reversed later
const ACTIONS: Record<ReviewStatus, { status: ReviewStatus; label: string; tone: string }[]> = {
	pending: [{ status: "validated", label: "Valider", tone: "primary" }, { status: "refused", label: "Refuser", tone: "danger" }],
	validated: [{ status: "refused", label: "Refuser", tone: "danger" }, { status: "pending", label: "Remettre en attente", tone: "neutral" }],
	refused: [{ status: "validated", label: "Valider", tone: "primary" }, { status: "pending", label: "Remettre en attente", tone: "neutral" }],
};
const TONES = {
	primary: "bg-primary text-on-primary hover:bg-primary/90",
	danger: "text-[#e00000] inset-ring inset-ring-[#e00000] hover:bg-[#fee2e2]",
	neutral: "text-ink inset-ring inset-ring-[#d1d5db] hover:bg-[#f3f4f6]",
};

type ReviewActionsProps = {
	name: string;
	status: ReviewStatus;
	/** The change is being sent: the buttons wait */
	disabled: boolean;
	onChange: (status: ReviewStatus) => void;
};

export function ReviewActions({ name, status, disabled, onChange }: ReviewActionsProps) {
	return (
		<div className="flex flex-wrap justify-end gap-2">
			{ACTIONS[status].map(({ status: next, label, tone }) => (
				<button
					key={next}
					type="button"
					disabled={disabled}
					onClick={() => onChange(next)}
					aria-label={`${label} : ${name}`}
					className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap disabled:cursor-wait disabled:opacity-60 ${TONES[tone as keyof typeof TONES]} ${focus}`}
				>
					{label}
				</button>
			))}
		</div>
	);
}

type AdminOrganizationsTableProps<T extends { id: number; name: string; status: ReviewStatus }> = {
	label: string;
	rows: T[];
	columns: OrganizationColumn<T>[];
	sort: string;
	onSort: (sort: string) => void;
	/** Id of the row whose change is being sent */
	busyId: number | null;
	onReview: (row: T, status: ReviewStatus) => void;
};

// Wider than a phone: the table scrolls sideways inside its frame, never the page
export function AdminOrganizationsTable<T extends { id: number; name: string; status: ReviewStatus }>({ label, rows, columns, sort, onSort, busyId, onReview }: AdminOrganizationsTableProps<T>) {
	return (
		<div role="region" aria-label={label} tabIndex={0} className={`relative overflow-x-auto rounded-2xl border border-[#e1e3e8] ${focus}`}>
			<table className="w-full min-w-[820px] border-collapse text-left text-sm text-ink">
				<thead className="bg-[#f9fafb] text-xs text-[#6b7280]">
					<tr>
						{columns.map(({ column, label }) => {
							const direction = column ? sortDirection(sort, column) : undefined;
							return (
								<th key={label} scope="col" aria-sort={direction} className={`${cell} font-semibold`}>
									{column ? (
										<button type="button" onClick={() => onSort(nextSort(sort, column))} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-sm whitespace-nowrap hover:text-ink ${direction ? "text-ink" : ""} ${focus}`}>
											{label}
											<SortArrows direction={direction} />
										</button>
									) : label}
								</th>
							);
						})}
						<th scope="col" className={`${cell} font-semibold`}>Statut</th>
						<th scope="col" className={`${cell} text-right font-semibold`}>Décision</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row.id} className="border-t border-[#e1e3e8] hover:bg-[#f9fafb]">
							{columns.map(({ label, cell: content }, index) => <td key={label} className={`${cell} ${index === 0 ? "font-medium" : ""}`}>{content(row)}</td>)}
							<td className={cell}><StatusBadge status={row.status} /></td>
							<td className={cell}><ReviewActions name={row.name} status={row.status} disabled={busyId !== null} onChange={(status) => onReview(row, status)} /></td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

type AdminOrganizationsToolbarProps = {
	query: OrganizationQuery;
	/** « entreprise » or « école », for the labels */
	search: { label: string; placeholder: string; name: string };
	onSearch: (q: string) => void;
	onChange: (changes: Partial<OrganizationQuery>) => void;
	onReset: () => void;
};

export function AdminOrganizationsToolbar({ query, search, onSearch, onChange, onReset }: AdminOrganizationsToolbarProps) {
	return (
		<form role="search" aria-label={`Rechercher et filtrer les ${search.name}`} onSubmit={(e) => e.preventDefault()} className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
			<SearchField value={query.q} onSearch={onSearch} label={search.label} placeholder={search.placeholder} />
			<label className="relative lg:w-[240px]">
				<span className="sr-only">Statut de validation</span>
				<select value={query.status} onChange={(e) => onChange({ status: e.target.value as OrganizationQuery["status"] })} className={select}>
					<option value="">Tous les statuts</option>
					<option value="pending">En attente</option>
					<option value="validated">Validées</option>
					<option value="refused">Refusées</option>
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
	server: "Impossible de charger la liste.",
	network: "Connexion au serveur impossible.",
};
const REVIEW_ERRORS = {
	forbidden: "Accès interdit ou session expirée. Reconnectez-vous.",
	notFound: "Cet élément n’existe plus : la liste a été actualisée.",
	server: "Une erreur est survenue, veuillez réessayer.",
	network: "Connexion au serveur impossible. Vérifiez votre connexion et réessayez.",
};

export const DONE: Record<ReviewStatus, string> = { validated: "est validée", refused: "est refusée", pending: "est remise en attente" };

type Config<K extends OrganizationKind> = {
	kind: K;
	title: string;
	description: string;
	/** Columns of the sort of the API */
	columns: OrganizationColumn<OrganizationRows[K]>[];
	/** Nouns of the list: « entreprise » / « entreprises » */
	noun: [string, string];
	/** Féminin: « Aucune entreprise » */
	search: { label: string; placeholder: string; name: string };
	/** « Aucune entreprise inscrite pour le moment. » */
	empty: string;
	noMatch: string;
};

// Page of a list with its validation: search, status filter, sort by column and pagination (as for
// the accounts), then « Valider », « Refuser » and « Remettre en attente » on each row
export default function AdminOrganizationsList<K extends OrganizationKind>({ kind, title, description, columns, noun, search, empty, noMatch }: Config<K>) {
	type Row = OrganizationRows[K];
	const [params, setParams] = useSearchParams();
	const sorts = columns.flatMap(({ column }) => (column ? [column] : []));
	const query = queryFromParams(params, sorts);
	const searchString = searchFromQuery(query);
	const [attempt, setAttempt] = useState(0);
	const [loaded, setLoaded] = useState<{ search: string; attempt: number; result: OrganizationsResult<Row> } | null>(null);
	const [busyId, setBusyId] = useState<number | null>(null);
	const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

	useEffect(() => {
		// A newer search cancels this request: its answer never replaces the newer one
		const controller = new AbortController();
		getAdminOrganizations(kind, searchString, controller.signal).then((result) => {
			if (!controller.signal.aborted) setLoaded({ search: searchString, attempt, result });
		});
		return () => controller.abort();
	}, [kind, searchString, attempt]);

	// Each change is a step of the browser history, except the typing of the search
	const update = useCallback(
		(changes: Partial<OrganizationQuery>, replace = false) => setParams((previous) => searchFromQuery(withChanges(queryFromParams(previous, sorts), changes)), { replace }),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[setParams, sorts.join()],
	);
	const onSearch = useCallback((q: string) => update({ q }, true), [update]);
	const onReset = () => update({ q: "", status: "" });

	const review = async (row: Row, status: ReviewStatus) => {
		if (busyId !== null) return;
		setBusyId(row.id);
		setMessage(null);
		const result = await setOrganizationStatus(kind, row.id, status);
		setBusyId(null);
		if (!result.ok) {
			setMessage({ ok: false, text: REVIEW_ERRORS[result.reason] });
			if (result.reason === "notFound") setAttempt((value) => value + 1);
			return;
		}
		setMessage({ ok: true, text: `${row.name} ${DONE[status]}.` });
		// The row may leave the filtered list: the list is loaded again
		setAttempt((value) => value + 1);
	};

	const current = loaded && loaded.search === searchString && loaded.attempt === attempt ? loaded.result : null;
	// While the next answer loads, the previous table stays on screen
	const shown = current ?? (loaded?.result.ok ? loaded.result : null);

	return (
		<div className="min-h-dvh bg-[#f8fafc] px-4 pt-4 pb-16 text-ink md:px-6 md:pt-6">
			<header><AdminNavbar /></header>
			<main className="mx-auto mt-8 max-w-[1236px] rounded-2xl border border-[#e5e7eb] bg-surface px-5 py-7 shadow-xs md:px-10 md:py-8" aria-busy={current === null}>
				<div className="mb-6 flex flex-col gap-1">
					<h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
					<p className="text-sm text-[#6b7280]">{description}</p>
				</div>
				<AdminOrganizationsToolbar query={query} search={search} onSearch={onSearch} onChange={update} onReset={onReset} />
				<p role={message?.ok === false ? "alert" : "status"} className={`mb-4 text-sm empty:hidden ${message?.ok === false ? "font-medium text-[#DC2626]" : "text-[#6b7280]"}`}>{message?.text}</p>
				<AdminOrganizationsResults
					label={title}
					result={shown}
					loading={current === null}
					query={query}
					columns={columns}
					noun={noun}
					empty={empty}
					noMatch={noMatch}
					busyId={busyId}
					onChange={update}
					onRetry={() => setAttempt(attempt + 1)}
					onReset={onReset}
					onReview={review}
				/>
			</main>
		</div>
	);
}

type ResultsProps<T extends { id: number; name: string; status: ReviewStatus }> = {
	label: string;
	result: OrganizationsResult<T> | null;
	loading: boolean;
	query: OrganizationQuery;
	columns: OrganizationColumn<T>[];
	noun: [string, string];
	empty: string;
	noMatch: string;
	busyId: number | null;
	onChange: (changes: Partial<OrganizationQuery>) => void;
	onRetry: () => void;
	onReset: () => void;
	onReview: (row: T, status: ReviewStatus) => void;
};

export function AdminOrganizationsResults<T extends { id: number; name: string; status: ReviewStatus }>({ label, result, loading, query, columns, noun, empty, noMatch, busyId, onChange, onRetry, onReset, onReview }: ResultsProps<T>) {
	if (!result) return <p role="status" className="py-16 text-center text-sm text-[#6b7280]">Chargement…</p>;
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
		if (!hasCriteria(query)) return <p role="status" className="py-16 text-center text-sm text-[#6b7280]">{empty}</p>;
		return (
			<div className="py-16 text-center">
				<p role="status" className="text-sm text-[#6b7280]">{noMatch}</p>
				<button type="button" onClick={onReset} className="mt-4 cursor-pointer text-sm font-semibold text-primary underline">Réinitialiser les filtres</button>
			</div>
		);
	}
	return (
		<div className={loading ? "opacity-60" : ""}>
			<AdminOrganizationsTable label={label} rows={result.results} columns={columns} sort={query.sort} onSort={(sort) => onChange({ sort })} busyId={busyId} onReview={onReview} />
			<div className="mt-6 flex flex-col items-center gap-4 text-xs sm:text-sm text-[#6b7280] lg:flex-row lg:justify-between">
				<p role="status">{rangeLabel(result.count, result.page, result.page_size, result.results.length, noun)}</p>
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
