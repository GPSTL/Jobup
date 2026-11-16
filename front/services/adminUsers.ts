// Calls to the administration API (JOB-063, ADM-01): the table of the student accounts and the
// profile of one of them. Contract: docs/api/admin-users.md

export type AdminUser = {
	id: number;
	first_name: string;
	last_name: string;
	email: string;
	role: number;
	/** School of the profile, null when none is given */
	school: string | null;
	date_joined: string;
	is_active: boolean;
	suspended_at: string | null;
	detail_url: string | null;
};
export type AdminUsersResult =
	| { ok: true; count: number; page: number; page_size: number; total_pages: number; results: AdminUser[] }
	| { ok: false; reason: "forbidden" | "notFound" | "server" | "network" };

/** A value of the "École" filter */
export type AdminSchool = { id: number; name: string };
export type AdminUserFiltersResult = { ok: true; schools: AdminSchool[] } | { ok: false };

export type AdminUserDetail = Omit<AdminUser, "detail_url"> & {
	phone: string | null;
	applications_sent: number;
	cv_url: string | null;
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

export async function getAdminUserFilters(signal?: AbortSignal): Promise<AdminUserFiltersResult> {
	try {
		const response = await fetch("/api/administration/users/filters", { credentials: "same-origin", signal });
		if (!response.ok) return { ok: false };
		const { schools } = await response.json();
		return Array.isArray(schools) ? { ok: true, schools } : { ok: false };
	} catch {
		return { ok: false };
	}
}
