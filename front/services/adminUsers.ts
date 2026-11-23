// Calls to the administration API (JOB-063, ADM-01): the table of the accounts of every role, the
// profile of one of them (JOB-064) and its suspension (ADM-03, ADM-04). Contract: docs/api/admin-users.md

import { getCsrfToken } from "./auth";

export type AdminUser = {
	id: number;
	first_name: string;
	last_name: string;
	email: string;
	role: number;
	date_joined: string;
	is_active: boolean;
	suspended_at: string | null;
	detail_url: string | null;
};
export type AdminUsersResult =
	| { ok: true; count: number; page: number; page_size: number; total_pages: number; results: AdminUser[] }
	| { ok: false; reason: "forbidden" | "notFound" | "server" | "network" };

export type AdminUserDetail = Omit<AdminUser, "detail_url"> & {
	/** School of a student or of a manager, null when none is given */
	school: string | null;
	/** Company of a recruiter, null when none is given */
	company: string | null;
	/** Photo of the profile, null when none was imported */
	photo_url: string | null;
	phone: string | null;
	/** Null for the accounts that cannot apply: only students send applications */
	applications_sent: number | null;
	cv_url: string | null;
	/** False for an administrator account */
	can_suspend: boolean;
};
export type AdminUserDetailResult = { ok: true; user: AdminUserDetail } | Extract<AdminUsersResult, { ok: false }>;

export async function getAdminUser(id: string): Promise<AdminUserDetailResult> {
	let response: Response;
	try { response = await fetch(`/api/administration/users/${encodeURIComponent(id)}`, { credentials: "same-origin" }); }
	catch { return { ok: false, reason: "network" }; }
	if (response.status === 401 || response.status === 403) return { ok: false, reason: "forbidden" };
	if (response.status === 404) return { ok: false, reason: "notFound" };
	if (!response.ok) return { ok: false, reason: "server" };
	try { return { ok: true, user: await response.json() }; }
	catch { return { ok: false, reason: "server" }; }
}

// Suspends (ADM-03) or gives back (ADM-04) an account; answers the updated profile
export async function setSuspension(id: number, suspended: boolean): Promise<AdminUserDetailResult> {
	let response: Response;
	try {
		const csrfToken = await getCsrfToken();
		if (!csrfToken) return { ok: false, reason: "server" };
		response = await fetch(`/api/administration/users/${id}/suspension`, {
			method: suspended ? "POST" : "DELETE",
			credentials: "same-origin",
			headers: { "X-CSRFToken": csrfToken },
		});
	} catch { return { ok: false, reason: "network" }; }
	if (response.status === 401 || response.status === 403) return { ok: false, reason: "forbidden" };
	if (response.status === 404) return { ok: false, reason: "notFound" };
	if (!response.ok) return { ok: false, reason: "server" };
	try { return { ok: true, user: await response.json() }; }
	catch { return { ok: false, reason: "server" }; }
}

/** `search`: query string of the table, built by searchFromQuery() (utils/adminUsers.ts) */
export async function getAdminUsers(search: string, signal?: AbortSignal): Promise<AdminUsersResult> {
	let response: Response;
	try {
		response = await fetch(search ? `/api/administration/users?${search}` : "/api/administration/users", { credentials: "same-origin", signal });
	} catch { return { ok: false, reason: "network" }; }
	if (response.status === 401 || response.status === 403) return { ok: false, reason: "forbidden" };
	if (response.status === 404) return { ok: false, reason: "notFound" };
	if (!response.ok) return { ok: false, reason: "server" };
	try { return { ...await response.json(), ok: true }; }
	catch { return { ok: false, reason: "server" }; }
}
