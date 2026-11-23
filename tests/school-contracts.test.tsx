// Page « Contrats » de l'école (JOB-048, ECO-06) : tableau, période de l'alternance, tri et PDF
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import { SchoolContractsTable } from "../front/pages/SchoolContractsPage";
import type { SchoolContract } from "../front/services/school";
import { CONTRACT_PERIOD, CONTRACT_STAGE, nextContractSort, sortContracts } from "../front/utils/school";

const contract = (id: number, last_name: string, fields: Partial<SchoolContract> = {}): SchoolContract => ({
	id,
	stage: CONTRACT_STAGE.DEPOSITED,
	deposited_at: "2026-11-01T09:00:00Z",
	validated_at: null,
	signed_at: null,
	start_date: "2027-01-04",
	end_date: "2028-01-03",
	file_name: "Contrat.pdf",
	file_url: `/api/contracts/${id}/file`,
	period: "upcoming",
	student: { id: id + 100, first_name: "Alex", last_name, photo_url: null },
	company: "Thales",
	offer_title: "Développeur Java",
	application_id: id + 10,
	...fields,
});

const contracts = [
	contract(1, "Martin", { start_date: "2026-09-01", end_date: "2027-08-31", period: "ongoing", stage: CONTRACT_STAGE.SIGNED }),
	contract(2, "Benali", { start_date: null, end_date: null, period: null, file_name: null, file_url: null }),
	contract(3, "Durand"),
];
const order = (sort: Parameters<typeof sortContracts>[1]) => sortContracts(contracts, sort).map(({ student }) => student.last_name);

test("tri : étudiant et dates, contrats sans dates toujours en dernier", () => {
	assert.deepEqual(order("student"), ["Benali", "Durand", "Martin"]);
	assert.deepEqual(order("-student"), ["Martin", "Durand", "Benali"]);
	assert.deepEqual(order("start_date"), ["Martin", "Durand", "Benali"]);
	assert.deepEqual(order("-end_date"), ["Durand", "Martin", "Benali"]);
	assert.equal(nextContractSort("student", "student"), "-student");
	assert.equal(nextContractSort("-student", "start_date"), "start_date");
});

test("statuts de la période : en cours, terminé, à venir", () => {
	assert.deepEqual(
		Object.values(CONTRACT_PERIOD).map(({ label }) => label),
		["À venir", "En cours", "Terminé"],
	);
});

test("tableau : dates, statut, étape, PDF et action de l'école", () => {
	const html = renderToStaticMarkup(
		<MemoryRouter>
			<SchoolContractsTable contracts={contracts} sort="student" onSort={() => {}} onAdvance={() => {}} saving={null} error={{ id: 3, message: "Échec" }} />
		</MemoryRouter>,
	);
	assert.match(html, /<div role="region" aria-label="Contrats des étudiants" tabindex="0"/);
	for (const label of ["Étudiant", "Début", "Fin"]) assert.match(html, new RegExp(`<button[^>]*>${label}`));
	assert.match(html, /<th scope="col" aria-sort="ascending"[^>]*><button[^>]*>Étudiant/);
	assert.match(html, /04 janv\. 2027/);
	assert.match(html, />En cours</);
	assert.match(html, />À venir</);
	assert.match(html, /Dates non renseignées/);
	assert.match(html, /<a href="\/api\/contracts\/3\/file" download=""/);
	assert.match(html, /Pas de PDF/);
	assert.match(html, /href="\/school\/students\/103"/);
	// L'école valide un contrat déposé ; rien à faire sur un contrat signé
	assert.equal([...html.matchAll(/>Valider le contrat</g)].length, 2);
	assert.doesNotMatch(html, /Marquer comme signé/);
	assert.match(html, /role="alert"[^>]*>Échec/);
});

test("tableau : contrats cochés un à un pour l'export", () => {
	const html = renderToStaticMarkup(
		<MemoryRouter>
			<SchoolContractsTable contracts={contracts} sort="student" onSort={() => {}} onAdvance={() => {}} saving={null} error={null} selection={{ ids: [1, 2, 3], onChange: () => {} }} />
		</MemoryRouter>,
	);
	assert.equal(html.match(/type="checkbox"/g)?.length, 4);
	assert.equal(html.match(/checked=""/g)?.length, 4);
	assert.match(html, /aria-label="Sélectionner tous les contrats affichés pour l’export"/);
});
