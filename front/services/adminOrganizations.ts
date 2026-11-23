// Calls to the administration API for the companies and the schools: the lists and their
// validation. Contract: docs/api/admin-organizations.md

import type { OrganizationKind, ReviewStatus } from "../utils/adminOrganizations";
import { getCsrfToken } from "./auth";

export type AdminCompany = { id: number; name: string; siret: string; city: string; website: string; status: ReviewStatus; recruiters: number };
export type AdminSchool = { id: number; name: string; status: ReviewStatus; students: number; managers: number };
export type OrganizationRows = { companies: AdminCompany; schools: AdminSchool };

type Failure = { ok: false; reason: "forbidden" | "notFound" | "server" | "network" };
export type OrganizationsResult<T> =
	| { ok: true; count: number; page: number; page_size: number; total_pages: number; results: T[] }
	| Failure;
export type ReviewResult<T> = { ok: true; row: T } | Failure;

function failure(response: Response): Failure | null {
	if (response.status === 401 || response.status === 403) return { ok: false, reason: "forbidden" };
	if (response.status === 404) return { ok: false, reason: "notFound" };
	return response.ok ? null : { ok: false, reason: "server" };
}

/** `search`: query string of the list, built by searchFromQuery() (utils/adminOrganizations.ts) */
export async function getAdminOrganizations<K extends OrganizationKind>(kind: K, search: string, signal?: AbortSignal): Promise<OrganizationsResult<OrganizationRows[K]>> {
	let response: Response;
	try {
		response = await fetch(search ? `/api/administration/${kind}?${search}` : `/api/administration/${kind}`, { credentials: "same-origin", signal });
	} catch { return { ok: false, reason: "network" }; }
	const failed = failure(response);
	if (failed) return failed;
	try { return { ...await response.json(), ok: true }; }
	catch { return { ok: false, reason: "server" }; }
}

// Validates, refuses or puts back "en attente" a company or a school; answers the updated row
export async function setOrganizationStatus<K extends OrganizationKind>(kind: K, id: number, status: ReviewStatus): Promise<ReviewResult<OrganizationRows[K]>> {
	let response: Response;
	try {
		const csrfToken = await getCsrfToken();
		if (!csrfToken) return { ok: false, reason: "server" };
		response = await fetch(`/api/administration/${kind}/${id}/status`, {
			method: "PATCH",
			credentials: "same-origin",
			headers: { "X-CSRFToken": csrfToken, "Content-Type": "application/json" },
			body: JSON.stringify({ status }),
		});
	} catch { return { ok: false, reason: "network" }; }
	const failed = failure(response);
	if (failed) return failed;
	try { return { ok: true, row: await response.json() }; }
	catch { return { ok: false, reason: "server" }; }
}
