// Table of the student accounts (JOB-063, ADM-01). Its search, filters, sort and page live in the
// URL of the page, with the names of the API: a reload, the browser arrows and « Retour à la liste »
// of a profile give back the same view.

export type AdminUserStatus = "" | "active" | "suspended";
export type SortColumn = "first_name" | "last_name" | "email" | "school" | "date_joined";
/** A column, preceded by "-" for the descending order */
export type AdminUserSort = SortColumn | `-${SortColumn}`;

export type AdminUsersQuery = {
	q: string;
	status: AdminUserStatus;
	/** Id of a school, "" for every school */
	school: string;
	sort: AdminUserSort;
	page: number;
	page_size: number;
};

// Same values as PAGE_SIZES in jobup/administration.py; the first one is the default
export const PAGE_SIZES = [10, 25, 50];
const SORT_COLUMNS: SortColumn[] = ["first_name", "last_name", "email", "school", "date_joined"];

// Newest accounts first
export const DEFAULT_QUERY: AdminUsersQuery = { q: "", status: "", school: "", sort: "-date_joined", page: 1, page_size: PAGE_SIZES[0] };

const isSort = (value: string): value is AdminUserSort => SORT_COLUMNS.some((column) => value === column || value === `-${column}`);
const positive = (value: string | null) => (value && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : null);

// A missing or invalid value of the URL takes its default value: the API never gets a request it refuses
export function queryFromParams(params: URLSearchParams): AdminUsersQuery {
	const status = params.get("status");
	const sort = params.get("sort") ?? "";
	const pageSize = positive(params.get("page_size"));
	return {
		q: (params.get("q") ?? "").trim().slice(0, 100),
		status: status === "active" || status === "suspended" ? status : "",
		school: String(positive(params.get("school")) ?? ""),
		sort: isSort(sort) ? sort : DEFAULT_QUERY.sort,
		page: positive(params.get("page")) ?? 1,
		page_size: pageSize !== null && PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_QUERY.page_size,
	};
}

// Query string of the page and of the API, without the default values
export function searchFromQuery(query: AdminUsersQuery): string {
	const params = new URLSearchParams();
	if (query.q) params.set("q", query.q);
	if (query.status) params.set("status", query.status);
	if (query.school) params.set("school", query.school);
	if (query.sort !== DEFAULT_QUERY.sort) params.set("sort", query.sort);
	if (query.page_size !== DEFAULT_QUERY.page_size) params.set("page_size", String(query.page_size));
	if (query.page > 1) params.set("page", String(query.page));
	return params.toString();
}

// A new search, filter, sort or page size starts again from the first page
export const withChanges = (query: AdminUsersQuery, changes: Partial<AdminUsersQuery>): AdminUsersQuery => ({ ...query, page: 1, ...changes });

export const hasCriteria = (query: AdminUsersQuery) => query.q !== "" || query.status !== "" || query.school !== "";

// A click on a header sorts by its column, ascending first (newest first for the date), then the other way round
export function nextSort(sort: AdminUserSort, column: SortColumn): AdminUserSort {
	if (sort === column) return `-${column}`;
	if (sort === `-${column}`) return column;
	return column === "date_joined" ? "-date_joined" : column;
}

export function sortDirection(sort: AdminUserSort, column: SortColumn): "ascending" | "descending" | undefined {
	if (sort === column) return "ascending";
	return sort === `-${column}` ? "descending" : undefined;
}

// « 11–20 sur 42 étudiants »
export function rangeLabel(count: number, page: number, pageSize: number, shown: number) {
	const first = (page - 1) * pageSize + 1;
	return `${first}–${first + shown - 1} sur ${count} ${count > 1 ? "étudiants" : "étudiant"}`;
}

// « Retour à la liste » of a profile: the table as it was left, never another page
export function adminUsersLink(returnTo: unknown) {
	return typeof returnTo === "string" && /^\/administration\/users(\?[^#]*)?$/.test(returnTo) ? returnTo : "/administration/users";
}

// Page reached after the admin login: the administration page asked before it (?next= of the
// server or of RequireAdmin), never a page outside the administration
export function adminReturnTo(next: unknown) {
	return typeof next === "string" && /^\/administration\/[^/?#][^#]*$/.test(next) ? next : "/administration/users";
}

// Admin login, then back to `path` (expired session on an administration page)
export const adminLoginLink = (path: string) => `/administration?${new URLSearchParams({ next: path })}`;

// « 09/10/2026 », in the time zone of the platform
export const formatDate = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris" }).format(new Date(iso));
