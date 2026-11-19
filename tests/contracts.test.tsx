// Contrat d'alternance (JOB-045, REC-26) : formulaire de dépôt, PDF affiché aux trois rôles et envoi
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import ContractDocument from "../front/components/ContractDocument";
import ContractUploadForm from "../front/components/ContractUploadForm";
import { RecruiterApplicationContent } from "../front/pages/RecruiterApplicationPage";
import type { RecruiterApplication } from "../front/services/recruiterOffers";
import { depositContract, getStudentContracts, type ContractProgress } from "../front/services/school";
import { STATUS } from "../front/utils/applications";
import { canReplaceContract, contractErrors, contractPeriod, today } from "../front/utils/contracts";
import { CONTRACT_STAGE } from "../front/utils/school";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

const contract: ContractProgress = {
	id: 5,
	stage: CONTRACT_STAGE.DEPOSITED,
	deposited_at: "2026-11-19T09:00:00Z",
	validated_at: null,
	signed_at: null,
	start_date: "2027-01-04",
	end_date: "2028-01-03",
	file_name: "Contrat_Lucas.pdf",
	file_url: "/api/contracts/5/file",
};

const pdf = (size = 10, name = "contrat.pdf", type = "application/pdf") => new File([new Uint8Array(size)], name, { type });
const render = (element: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);

test("vérifications avant l'envoi : PDF de 10 Mo au plus, dates obligatoires et dans l'ordre", () => {
	assert.deepEqual(contractErrors(pdf(), "2027-01-04", "2028-01-03"), {});
	assert.deepEqual(contractErrors(null, "", ""), {
		file: "Ajoutez le contrat en PDF.",
		start_date: "Indiquez la date de début.",
		end_date: "Indiquez la date de fin.",
	});
	assert.equal(contractErrors(pdf(0), "2027-01-04", "2028-01-03").file, "Le fichier est vide.");
	assert.equal(contractErrors(pdf(10 * 1024 * 1024 + 1), "2027-01-04", "2028-01-03").file, "Le fichier ne doit pas dépasser 10 Mo.");
	assert.equal(contractErrors(pdf(10, "contrat.docx", "application/msword"), "2027-01-04", "2028-01-03").file, "Le contrat doit être un fichier PDF.");
	assert.equal(contractErrors(pdf(), "2027-01-04", "2027-01-04").end_date, "La date de fin doit être après la date de début.");
});

test("remplacement : jusqu'à la veille du début, jamais une fois signé", () => {
	assert.equal(today(new Date(2027, 0, 3)), "2027-01-03");
	assert.equal(canReplaceContract(contract, new Date(2027, 0, 3)), true);
	assert.equal(canReplaceContract(contract, new Date(2027, 0, 4)), false);
	assert.equal(canReplaceContract({ ...contract, stage: CONTRACT_STAGE.SIGNED }, new Date(2026, 10, 19)), false);
	// Contrat déposé avant JOB-045, sans dates
	assert.equal(canReplaceContract({ ...contract, start_date: null }, new Date(2030, 0, 1)), true);
});

test("PDF et dates de l'alternance, avec le lien de téléchargement", () => {
	assert.equal(contractPeriod(contract), "Du 04 janv. 2027 au 03 janv. 2028");
	const html = render(<ContractDocument contract={contract} />);
	assert.match(html, /Contrat_Lucas\.pdf/);
	assert.match(html, /<a href="\/api\/contracts\/5\/file" download=""/);
	assert.match(html, /Télécharger le contrat/);
	// Contrat déposé avant JOB-045 : ni fichier, ni dates
	assert.equal(render(<ContractDocument contract={{ ...contract, start_date: null, end_date: null, file_name: null, file_url: null }} />), "");
});

test("formulaire : PDF et dates obligatoires, dates actuelles proposées au remplacement", () => {
	const html = render(<ContractUploadForm applicationId={20} onDeposited={() => {}} />);
	assert.match(html, /<form[^>]*aria-label="Déposer le contrat"/);
	assert.match(html, /<input type="file" accept="application\/pdf,.pdf"[^>]*id="contract-file-20"/);
	assert.match(html, /Date de début \*/);
	assert.match(html, />Déposer le contrat<\/button>/);
	const replace = render(<ContractUploadForm applicationId={20} current={contract} onDeposited={() => {}} onCancel={() => {}} />);
	assert.match(replace, /value="2027-01-04"/);
	assert.match(replace, /l’école devra le valider de nouveau/);
	assert.match(replace, />Remplacer le contrat<\/button>/);
	assert.match(replace, />Annuler<\/button>/);
});

const application: RecruiterApplication = {
	id: 20,
	offer: { id: 12, title: "Développeur Java", description: "Alternance", created_at: "2026-10-01T09:00:00Z", is_active: true },
	candidate: { id: 7, first_name: "Lucas", last_name: "Martin", school: null, education: null, description: "", photo_url: null, cv_url: null },
	status: STATUS.ACCEPTED,
	submitted_at: "2026-10-10T09:00:00Z",
	message: "",
	decision_message: "",
	conversation_id: null,
	contract: null,
};
const renderRecruiter = (value: RecruiterApplication) =>
	render(<RecruiterApplicationContent application={value} saving={false} error="" onDecision={() => {}} onContract={() => {}} />);

test("recruteur : formulaire sans contrat, puis le PDF et « Remplacer » tant que c'est possible", () => {
	assert.match(renderRecruiter(application), /<form[^>]*aria-label="Déposer le contrat"/);
	const deposited = renderRecruiter({ ...application, contract: { ...contract, start_date: "2099-01-04", end_date: "2100-01-03" } });
	assert.doesNotMatch(deposited, /<form/);
	assert.match(deposited, /href="\/api\/contracts\/5\/file"/);
	assert.match(deposited, />Remplacer le contrat<\/button>/);
	const started = renderRecruiter({ ...application, contract: { ...contract, start_date: "2020-01-06", end_date: "2021-01-05" } });
	assert.doesNotMatch(started, /Remplacer le contrat/);
	assert.doesNotMatch(renderRecruiter({ ...application, status: STATUS.REFUSED }), /Déposer le contrat/);
});

// Remplace fetch : /api/csrf renvoie un jeton, le dépôt la réponse donnée
function mockFetch(respond: () => Response) {
	const calls: { url: string; init?: RequestInit }[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		if (url === "/api/csrf") return Response.json({ csrfToken: "test-token" });
		return respond();
	}) as typeof fetch;
	return calls;
}

test("API : dépôt en multipart avec le jeton CSRF", async () => {
	const calls = mockFetch(() => Response.json({ ...application, contract }, { status: 201 }));
	const file = pdf();
	const result = await depositContract<RecruiterApplication>(20, { file, start_date: "2027-01-04", end_date: "2028-01-03" });
	assert.deepEqual(result, { ok: true, data: { ...application, contract } });
	assert.deepEqual(
		calls.map(({ url }) => url),
		["/api/csrf", "/api/recruiter/applications/20/contract"],
	);
	const init = calls[1].init;
	assert.equal(init?.method, "POST");
	assert.equal((init?.headers as Record<string, string>)["X-CSRFToken"], "test-token");
	const body = init?.body as FormData;
	assert.equal(body.get("file") instanceof File, true);
	assert.equal(body.get("start_date"), "2027-01-04");
	assert.equal(body.get("end_date"), "2028-01-03");
});

test("API : erreurs par champ, remplacement refusé, accès refusé et réseau", async () => {
	const values = { file: pdf(), start_date: "2027-01-04", end_date: "2028-01-03" };
	mockFetch(() => Response.json({ errors: { file: ["Le contrat doit être un fichier PDF."] } }, { status: 400 }));
	assert.deepEqual(await depositContract(20, values), { ok: false, reason: "invalid", errors: { file: "Le contrat doit être un fichier PDF." } });
	mockFetch(() => Response.json({ errors: { file: ["L’alternance a commencé : le contrat ne peut plus être remplacé."] } }, { status: 409 }));
	assert.deepEqual(await depositContract(20, values), {
		ok: false,
		reason: "conflict",
		errors: { file: "L’alternance a commencé : le contrat ne peut plus être remplacé." },
	});
	mockFetch(() => Response.json({ error: "Student has no school" }, { status: 409 }));
	assert.deepEqual(await depositContract(20, values), { ok: false, reason: "conflict", errors: {} });
	mockFetch(() => Response.json({ detail: "Forbidden" }, { status: 403 }));
	assert.deepEqual(await depositContract(20, values), { ok: false, reason: "unauthenticated", errors: {} });
	globalThis.fetch = (async () => {
		throw new TypeError("offline");
	}) as typeof fetch;
	assert.deepEqual(await depositContract(20, values), { ok: false, reason: "network", errors: {} });
});

test("API : contrats de l'étudiant pour « Mon espace »", async () => {
	const calls = mockFetch(() => Response.json([{ ...contract, company: "Thales", school: "Nanterre", offer_title: "Développeur Java", application_id: 20 }]));
	const result = await getStudentContracts();
	assert.equal(result.ok && result.data[0].company, "Thales");
	assert.deepEqual(
		calls.map(({ url }) => url),
		["/api/student/contracts"],
	);
});
