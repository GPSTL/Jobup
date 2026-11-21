// Lists of the companies and of the schools for the administrators. As for the accounts
// (utils/adminUsers.ts), the search, filter, sort and page live in the URL of the page, with the
// names of the API (docs/api/admin-organizations.md).

import { PAGE_SIZES } from "./adminUsers";

export type ReviewStatus = "pending" | "validated" | "refused";
export type OrganizationKind = "companies" | "schools";

export type OrganizationQuery = {
	q: string;
	/** "" for every status */
	status: "" | ReviewStatus;
	/** A column, preceded by "-" for the descending order */
	sort: string;
	page: number;
	page_size: number;
};

export const DEFAULT_SORT = "name";

export const STATUS_LABELS: Record<ReviewStatus, string> = { pending: "En attente", validated: "Validée", refused: "Refusée" };
const STATUSES = Object.keys(STATUS_LABELS) as ReviewStatus[];

const positive = (value: string | null) => (value && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : null);

// A missing or invalid value of the URL takes its default value: the API never gets a request it refuses
export function queryFromParams(params: URLSearchParams, columns: string[]): OrganizationQuery {
	const status = params.get("status") ?? "";
	const sort = params.get("sort") ?? "";
	const pageSize = positive(params.get("page_size"));
	return {
		q: (params.get("q") ?? "").trim().slice(0, 100),
		status: STATUSES.find((value) => value === status) ?? "",
		sort: columns.some((column) => sort === column || sort === `-${column}`) ? sort : DEFAULT_SORT,
		page: positive(params.get("page")) ?? 1,
		page_size: pageSize !== null && PAGE_SIZES.includes(pageSize) ? pageSize : PAGE_SIZES[0],
	};
}

// Query string of the page and of the API, without the default values
export function searchFromQuery(query: OrganizationQuery): string {
	const params = new URLSearchParams();
	if (query.q) params.set("q", query.q);
	if (query.status) params.set("status", query.status);
	if (query.sort !== DEFAULT_SORT) params.set("sort", query.sort);
	if (query.page_size !== PAGE_SIZES[0]) params.set("page_size", String(query.page_size));
	if (query.page > 1) params.set("page", String(query.page));
	return params.toString();
}

// A new search, filter, sort or page size starts again from the first page
export const withChanges = (query: OrganizationQuery, changes: Partial<OrganizationQuery>): OrganizationQuery => ({ ...query, page: 1, ...changes });

export const hasCriteria = (query: OrganizationQuery) => query.q !== "" || query.status !== "";

// A click on a header sorts by its column, ascending first, then the other way round
export function nextSort(sort: string, column: string): string {
	return sort === column ? `-${column}` : column;
}

export function sortDirection(sort: string, column: string): "ascending" | "descending" | undefined {
	if (sort === column) return "ascending";
	return sort === `-${column}` ? "descending" : undefined;
}

// « 11–20 sur 42 entreprises »
export function rangeLabel(count: number, page: number, pageSize: number, shown: number, noun: [string, string]) {
	const first = (page - 1) * pageSize + 1;
	return `${first}–${first + shown - 1} sur ${count} ${count > 1 ? noun[1] : noun[0]}`;
}
