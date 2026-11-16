import { test } from "node:test";
import assert from "node:assert/strict";
import { accountHome } from "../front/utils/accountHome";

// Valeurs de Role dans jobup/models.py
const STUDENT = 1;
const MANAGER = 2;
const RECRUITER = 3;
const ADMIN = 127;

test("étudiant : son espace", () => {
	assert.equal(accountHome(STUDENT), "/student");
	// Une page recruteur demandée avant la connexion ne le concerne pas
	assert.equal(accountHome(STUDENT, "/recruiter/candidates/12"), "/student");
});

test("recruteur : ses candidats, ou la page recruteur demandée avant la connexion", () => {
	assert.equal(accountHome(RECRUITER), "/recruiter/candidates");
	assert.equal(accountHome(RECRUITER, "/recruiter/candidates/12"), "/recruiter/candidates/12");
	assert.equal(accountHome(RECRUITER, "/recruiter/candidates?candidate=4"), "/recruiter/candidates?candidate=4");
});

test("recruteur : une destination hors de l'espace recruteur est ignorée", () => {
	for (const returnTo of ["/student", "//exemple.com", "https://exemple.com/recruiter/", "/recruiter", 42, null]) {
		assert.equal(accountHome(RECRUITER, returnTo), "/recruiter/candidates", String(returnTo));
	}
});

test("école et administrateur : l'accueil, faute d'espace dédié", () => {
	assert.equal(accountHome(MANAGER), "/");
	assert.equal(accountHome(ADMIN), "/");
});
