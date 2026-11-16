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
	| { ok: true; count: number; page: number; total_pages: number; results: AdminUser[] }
	| { ok: false; reason: "forbidden" | "notFound" | "server" | "network" };

export type AdminUserDetail = Omit<AdminUser, "detail_url"> & {
	school: string | null;
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

export async function getAdminUsers(page: number): Promise<AdminUsersResult> {
	let response: Response;
	try {
		response = await fetch(`/api/administration/users?page=${page}`, { credentials: "same-origin" });
	} catch { return { ok: false, reason: "network" }; }
	if (response.status === 401 || response.status === 403) return { ok: false, reason: "forbidden" };
	if (response.status === 404) return { ok: false, reason: "notFound" };
	if (!response.ok) return { ok: false, reason: "server" };
	try { return { ...await response.json(), ok: true }; }
	catch { return { ok: false, reason: "server" }; }
}
