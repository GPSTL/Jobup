// Appels à l'API de l'espace école et du rattachement de l'étudiant à son école. Contrat : docs/api/school.md

export type SchoolInfo = { id: number; name: string };

/** Étape la plus avancée d'un étudiant pour l'école, de la recherche à la signature */
export type StudentStatus = "searching" | "applying" | "accepted" | "contract" | "signed";

export type Person = { id: number; first_name: string; last_name: string; photo_url: string | null };

export type SchoolDashboard = {
	school: SchoolInfo | null;
	stats?: { students: number; searching: number; signed: number; pending_requests: number; contracts_to_validate: number };
};

export type SchoolStudent = Person & { status: StudentStatus; application_count: number };

/** Étapes d'un contrat : 1 déposé, 2 validé par l'école, 3 signé (ContractStage dans jobup/models.py) */
export type ContractProgress = {
	id: number;
	stage: number;
	deposited_at: string;
	validated_at: string | null;
	signed_at: string | null;
};

export type SchoolContract = ContractProgress & {
	student: Person;
	company: string;
	offer_title: string;
	application_id: number | null;
};

export type SchoolStudentDetail = SchoolStudent & {
	applications: { id: number; offer_title: string; company: string; status: number; submitted_at: string }[];
	contracts: SchoolContract[];
	conversation_id: number | null;
};

export type SchoolRequest = { id: number; student: Person; created_at: string };

export type StudentSchool = {
	school: SchoolInfo | null;
	/** Demande de rattachement : en attente, ou refusée (une nouvelle demande est alors possible) */
	request: { school: SchoolInfo; status: "pending" | "refused" } | null;
	/** Écoles proposées : celles qui ont un compte, tant que l'étudiant n'a ni école ni demande en attente */
	schools: SchoolInfo[];
};

export type SchoolFailure = {
	ok: false;
	reason: "unauthenticated" | "notFound" | "conflict" | "invalid" | "server" | "network";
	/** Message de l'API sur le nom de l'établissement, quand il y en a un */
	message?: string;
};

export type SchoolResult<T> = { ok: true; data: T } | SchoolFailure;

// Appel commun : les écritures envoient le jeton CSRF de /api/csrf
async function call<T>(url: string, method: "GET" | "POST" | "PATCH" | "DELETE" = "GET", body?: object): Promise<SchoolResult<T>> {
	try {
		const headers: Record<string, string> = {};
		if (method !== "GET") {
			const csrf = await fetch("/api/csrf", { credentials: "same-origin" });
			if (!csrf.ok) return { ok: false, reason: "server" };
			headers["X-CSRFToken"] = (await csrf.json()).csrfToken;
		}
		if (body) headers["Content-Type"] = "application/json";
		const response = await fetch(url, { method, credentials: "same-origin", headers, body: body && JSON.stringify(body) });
		// 204 : rien à lire (retrait d'un étudiant, JOB-049)
		if (response.status === 204) return { ok: true, data: undefined as T };
		if (response.ok) return { ok: true, data: (await response.json()) as T };
		if (response.status === 401 || response.status === 403) return { ok: false, reason: "unauthenticated" };
		if (response.status === 404) return { ok: false, reason: "notFound" };
		if (response.status === 400 || response.status === 409) {
			const data = await response.json().catch(() => ({}));
			return { ok: false, reason: response.status === 400 ? "invalid" : "conflict", message: data?.errors?.name };
		}
		return { ok: false, reason: "server" };
	} catch (error) {
		return { ok: false, reason: error instanceof TypeError ? "network" : "server" };
	}
}

// ----- École -----

export const getSchool = () => call<SchoolDashboard>("/api/school");
export const createSchool = (name: string) => call<{ school: SchoolInfo }>("/api/school", "POST", { name });
export const getSchoolStudents = () => call<SchoolStudent[]>("/api/school/students");
export const getSchoolStudent = (id: string) => call<SchoolStudentDetail>(`/api/school/students/${encodeURIComponent(id)}`);
export const removeSchoolStudent = (id: number) => call<void>(`/api/school/students/${id}`, "DELETE");
export const getSchoolRequests = () => call<SchoolRequest[]>("/api/school/requests");
export const decideSchoolRequest = (id: number, status: "accepted" | "refused") => call<{ id: number; status: string }>(`/api/school/requests/${id}`, "PATCH", { status });
export const getSchoolContracts = () => call<SchoolContract[]>("/api/school/contracts");
export const advanceContract = (id: number, stage: number) => call<SchoolContract>(`/api/school/contracts/${id}`, "PATCH", { stage });
export const startSchoolConversation = (studentId: number) => call<{ id: number }>("/api/school/conversations", "POST", { student_id: studentId });

// ----- Étudiant -----

export const getStudentSchool = () => call<StudentSchool>("/api/student/school");
export const requestSchool = (schoolId: number) => call<StudentSchool>("/api/student/school-request", "POST", { school_id: schoolId });
export const cancelSchoolRequest = () => call<StudentSchool>("/api/student/school-request", "DELETE");

// ----- Recruteur : dépôt du contrat d'une candidature acceptée -----

export const depositContract = <T>(applicationId: number) => call<T>(`/api/recruiter/applications/${applicationId}/contract`, "POST");
