// Calls to the recruiter candidates API (JOB-035, REC-01).
// TODO JOB-035: the API does not exist yet, so these functions return simulated responses.
// Once it is ready, replace each function body with a fetch (see applications.ts) without changing the signatures.

// TODO JOB-035: align the fields with the API contract. The Student model does not store
// `education` (only study_degree) nor `experiences` (only experience_level, in months) yet.

/** Card of the "Candidats" tab */
export type CandidateSummary = {
	id: number;
	first_name: string;
	last_name: string;
	/** null when the student has no photo */
	photo_url: string | null;
	/** Program followed, e.g. "Master MIAGE"; null when not filled in */
	education: string | null;
	/** Name of the school; null when not filled in */
	school: string | null;
	/** Personal presentation; "" when not written yet */
	description: string;
	/** Download route that checks the recruiter's rights, never a public file URL; null when there is no CV */
	cv_url: string | null;
};

/** Line of the exchange history: an application received or a message of the conversation (id of the JobApplication or of the Message) */
export type Exchange =
	| { kind: "application"; id: number; date: string; offer_title: string }
	| { kind: "message"; id: number; date: string; from_me: boolean; body: string };

/** Full profile ("Profil du candidat" screen) */
export type Candidate = CandidateSummary & {
	/** e.g. "Paris" */
	region: string;
	/** Value of StudyDegree in jobup/models.py (1 to 5 for BAC+1 to BAC+5); null when not filled in */
	study_degree: number | null;
	/** Start of availability, date without time ("2026-11-02"); null when not filled in */
	available_from: string | null;
	skills: string[];
	experiences: { title: string; details: string }[];
	/** Exchanges with the logged-in recruiter only, never those with other recruiters; oldest first */
	exchanges: Exchange[];
};

export type CandidatesError = "unauthenticated" | "server" | "network";

export type CandidatesResult = { ok: true; candidates: CandidateSummary[] } | { ok: false; reason: CandidatesError };

export type CandidateResult =
	| { ok: true; candidate: Candidate }
	// "notFound" also for a profile the recruiter is not allowed to see
	| { ok: false; reason: CandidatesError | "notFound" };

// TODO JOB-035: remove the simulated data. The first two candidates are those of the mockups;
// the third one has neither photo, school, CV nor exchange, to show the empty states.
const fakeCandidates: Candidate[] = [
	{
		id: 1,
		first_name: "Lucas",
		last_name: "Martin",
		photo_url: null,
		education: "Master MIAGE",
		school: "Université Paris Nanterre",
		description:
			"Étudiant en Master MIAGE, je recherche une alternance de 12 mois en développement back-end (Java / Spring Boot). Disponible dès novembre 2026, à Paris.",
		cv_url: "/api/recruiter/candidates/1/cv",
		region: "Paris",
		study_degree: 4,
		available_from: "2026-11-02",
		skills: ["Java", "Spring Boot", "Angular", "SQL", "Docker", "Git"],
		experiences: [
			{ title: "Développeur Java — Banque Horizon", details: "Alternance • 2025 – 2026" },
			{ title: "Projet universitaire — Plateforme de stages", details: "Angular, Spring Boot • 2025" },
		],
		exchanges: [
			{ kind: "application", id: 4, date: "2026-10-15T09:12:00Z", offer_title: "Développeur Java en alternance" },
			{ kind: "message", id: 11, date: "2026-10-16T14:03:00Z", from_me: true, body: "Bonjour Lucas, merci pour votre candidature. Votre profil nous intéresse." },
			{ kind: "message", id: 12, date: "2026-10-17T10:30:00Z", from_me: true, body: "Je vous propose un entretien le mardi 21 octobre à 10 h." },
		],
	},
	{
		id: 2,
		first_name: "Sarah",
		last_name: "Benali",
		photo_url: null,
		education: "Licence Pro Dev Web",
		school: "IUT Montreuil",
		description:
			"Passionnée de front-end (Angular, accessibilité), je cherche une alternance de 12 mois en développement web. Disponible dès octobre 2026.",
		cv_url: "/api/recruiter/candidates/2/cv",
		region: "Montreuil",
		study_degree: 3,
		available_from: "2026-10-01",
		skills: ["Angular", "TypeScript", "Accessibilité", "Figma"],
		experiences: [{ title: "Développeuse front-end — Agence Pixel", details: "Stage • 2025" }],
		exchanges: [
			{ kind: "message", id: 15, date: "2026-10-20T08:45:00Z", from_me: false, body: "Bonjour, je suis disponible pour échanger sur votre offre de développeur web." },
		],
	},
	{
		id: 3,
		first_name: "Inès",
		last_name: "Diallo",
		photo_url: null,
		education: "Master Informatique",
		school: null,
		description:
			"Intéressée par le développement back-end, je souhaite approfondir mes compétences en API et en bases de données pendant une alternance.",
		cv_url: null,
		region: "Lyon",
		study_degree: null,
		available_from: null,
		skills: ["Python", "Django", "SQL"],
		experiences: [],
		exchanges: [],
	},
];

// Simulates the network delay so the loading state can be built
const delay = () => new Promise((resolve) => setTimeout(resolve, 500));

// Candidates the logged-in recruiter may see, in the order of the cards
export async function getCandidates(): Promise<CandidatesResult> {
	// TODO JOB-035: GET /api/recruiter/candidates with credentials: "same-origin"; 401 or 403 -> "unauthenticated"
	await delay();
	return { ok: true, candidates: fakeCandidates };
}

export async function getCandidate(id: number): Promise<CandidateResult> {
	// TODO JOB-035: GET /api/recruiter/candidates/<id>; 404 -> "notFound"
	await delay();
	const candidate = fakeCandidates.find((item) => item.id === id);
	return candidate ? { ok: true, candidate } : { ok: false, reason: "notFound" };
}
