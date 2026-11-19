// Suivi des étudiants par l'école (JOB-047, ECO-05) : tableau trié, dernière candidature, indicateurs
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import { SchoolStudentsTable } from "../front/pages/SchoolStudentsPage";
import type { SchoolStudent } from "../front/services/school";
import { foundRate, nextStudentSort, sortStudents, STUDENT_STATUS } from "../front/utils/school";

const student = (id: number, last_name: string, fields: Partial<SchoolStudent> = {}): SchoolStudent => ({
	id,
	first_name: "Alex",
	last_name,
	photo_url: null,
	status: "applying",
	application_count: 1,
	last_application_at: "2026-11-10T09:00:00Z",
	...fields,
});

const students = [
	student(1, "Martin", { status: "signed", application_count: 4, last_application_at: "2026-10-01T09:00:00Z" }),
	student(2, "Benali", { status: "searching", application_count: 0, last_application_at: null }),
	student(3, "Durand", { status: "applying", application_count: 2, last_application_at: "2026-11-15T09:00:00Z" }),
];
const order = (sort: Parameters<typeof sortStudents>[1]) => sortStudents(students, sort).map(({ last_name }) => last_name);

test("tri : nom, avancement, nombre et date, sans candidature toujours en dernier", () => {
	assert.deepEqual(order("name"), ["Benali", "Durand", "Martin"]);
	assert.deepEqual(order("-name"), ["Martin", "Durand", "Benali"]);
	assert.deepEqual(order("status"), ["Benali", "Durand", "Martin"]);
	assert.deepEqual(order("-application_count"), ["Martin", "Durand", "Benali"]);
	assert.deepEqual(order("-last_application_at"), ["Durand", "Martin", "Benali"]);
	assert.deepEqual(order("last_application_at"), ["Martin", "Durand", "Benali"]);
	// La liste reçue n'est pas modifiée
	assert.equal(students[0].last_name, "Martin");
});

test("tri : un clic inverse l'ordre, la date commence par la plus récente", () => {
	assert.equal(nextStudentSort("name", "name"), "-name");
	assert.equal(nextStudentSort("-name", "name"), "name");
	assert.equal(nextStudentSort("name", "status"), "status");
	assert.equal(nextStudentSort("name", "last_application_at"), "-last_application_at");
});

test("statuts et pourcentage d'alternance trouvée, sans division par zéro", () => {
	assert.equal(STUDENT_STATUS.searching.label, "Sans candidature");
	assert.equal(foundRate({ students: 3, found: 1 }), 33);
	assert.equal(foundRate({ students: 0, found: 0 }), 0);
});

test("tableau : colonnes triables, dernière candidature et lien vers le suivi", () => {
	const html = renderToStaticMarkup(
		<MemoryRouter>
			<SchoolStudentsTable students={students} sort="-last_application_at" onSort={() => {}} />
		</MemoryRouter>,
	);
	assert.match(html, /<div role="region" aria-label="Étudiants de l’école" tabindex="0"/);
	for (const label of ["Étudiant", "Avancement", "Candidatures envoyées", "Dernière candidature"]) assert.match(html, new RegExp(`<button[^>]*>${label}`));
	assert.match(html, /<th scope="col" aria-sort="descending"[^>]*><button[^>]*>Dernière candidature/);
	assert.match(html, /<time dateTime="2026-11-15T09:00:00Z">/);
	assert.match(html, />Aucune</);
	assert.match(html, /href="\/school\/students\/3"/);
	// Lignes dans l'ordre du tri
	const names = [...html.matchAll(/<th scope="row"[^>]*>.*?<span class="break-words">([^<]+)<\/span>/g)].map((match) => match[1]);
	assert.deepEqual(names, ["Alex Durand", "Alex Martin", "Alex Benali"]);
});
