import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { CvSuggestionsView } from "../front/components/CvSuggestionsPanel";
import ProfileCompletion from "../front/components/ProfileCompletion";
import { ProfileDetailsForm, ProfileDetailsSummary } from "../front/components/ProfileDetailsSection";
import { getCvSuggestions } from "../front/services/cv";
import { updateProfile, type Profile } from "../front/services/profile";
import { addSkill, chosenChanges, completion, experienceLabel, suggestionChoices, withSkills } from "../front/utils/profileDetails";

const realFetch = globalThis.fetch;

function mockFetch(respond: () => Response | Promise<Response>) {
	const calls: { url: string; init?: RequestInit }[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		return respond();
	}) as typeof fetch;
	return calls;
}

beforeEach(() => {
	Object.defineProperty(globalThis, "document", { value: { cookie: "csrftoken=jeton123" }, configurable: true });
});
afterEach(() => {
	globalThis.fetch = realFetch;
});

const empty: Profile = {
	photoUrl: null,
	description: "",
	desiredPosition: "",
	education: "",
	studyDegree: null,
	category: null,
	experienceLevel: 0,
	skills: [],
	region: "",
	availableFrom: null,
};
const full: Profile = {
	photoUrl: "/media/photos/a.png",
	description: "Étudiant en M2.",
	desiredPosition: "Développeur web",
	education: "Master MIAGE",
	studyDegree: 5,
	category: 1,
	experienceLevel: 14,
	skills: ["Java", "SQL"],
	region: "Île-de-France",
	availableFrom: "2026-09-01",
};

test("affichage : expérience en années et mois", () => {
	assert.equal(experienceLabel(0), "Aucune");
	assert.equal(experienceLabel(8), "8 mois");
	assert.equal(experienceLabel(12), "1 an");
	assert.equal(experienceLabel(27), "2 ans et 3 mois");
});

test("compétences : nettoyées, une seule fois, dans les limites de l'API", () => {
	assert.deepEqual(addSkill(["Java"], "  Spring   Boot "), { skills: ["Java", "Spring Boot"], error: "" });
	assert.deepEqual(addSkill(["Java"], "java"), { skills: ["Java"], error: "" });
	assert.deepEqual(addSkill(["Java"], ""), { skills: ["Java"], error: "" });
	assert.equal(addSkill([], "Java, SQL").error, "Une compétence à la fois, sans virgule.");
	assert.equal(addSkill([], "x".repeat(41)).error, "Une compétence fait 40 caractères au plus.");
	const twenty = Array.from({ length: 20 }, (_, n) => `S${n}`);
	assert.equal(addSkill(twenty, "Python").error, "20 compétences au plus.");
	const long = Array.from({ length: 8 }, (_, n) => `${"x".repeat(30)}${n}`);
	assert.equal(addSkill(long, "y".repeat(10)).error, "La liste des compétences est trop longue.");
	assert.deepEqual(withSkills(["Java"], ["SQL", "java", "Docker"]), ["Java", "SQL", "Docker"]);
});

test("complétude : la part remplie et ce qu'il manque, CV compris, sans le domaine", () => {
	assert.deepEqual(completion(full, true), { percent: 100, missing: [] });
	assert.deepEqual(completion(full, false), { percent: 89, missing: ["CV"] });
	// Le domaine n'est lu nulle part côté recruteur : il ne compte pas
	assert.deepEqual(completion({ ...full, category: null }, true), { percent: 100, missing: [] });
	assert.equal(completion(empty, false).percent, 0);
	assert.equal(completion(empty, false).missing[0], "photo");
	const html = renderToStaticMarkup(<ProfileCompletion profile={{ ...full, skills: [] }} hasCv={null} />);
	assert.match(html, /Profil complété à 78 %/);
	assert.match(html, /role="progressbar"[^>]*aria-valuenow="78"/);
	assert.match(html, /À compléter : compétences, CV\./);
});

test("suggestions : seules celles qui changent le profil, cochées d'avance quand le champ est vide", () => {
	const suggestions = { desiredPosition: "Développeur web", education: "Master 2 MIAGE", studyDegree: 4, skills: ["java", "Docker", "Git"], region: "Lyon" };
	const choices = suggestionChoices(suggestions, { ...full, education: "", studyDegree: 5 });
	assert.deepEqual(
		choices.map(({ key, value, current, checked }) => [key, value, current, checked]),
		[
			// « Développeur web » est déjà le poste : pas proposé
			["education", "Master 2 MIAGE", "", true],
			["studyDegree", "Bac + 4", "Bac + 5", false],
			// Les compétences s'ajoutent, aucune n'est retirée ; « java » est déjà là
			["skills", "Docker, Git", "Java, SQL", true],
			["region", "Lyon", "Île-de-France", false],
		],
	);
	assert.deepEqual(chosenChanges(choices, new Set(["education", "skills"])), { education: "Master 2 MIAGE", skills: ["Java", "SQL", "Docker", "Git"] });
	assert.deepEqual(suggestionChoices({ skills: ["Java"], desiredPosition: "développeur WEB" }, full), []);
});

test("API : PATCH avec les noms de l'API, null pour vider un champ", async () => {
	const calls = mockFetch(() => Response.json({ photo_url: null, description: "", desired_position: "" }));
	const result = await updateProfile(7, { education: "Master MIAGE", studyDegree: 5, skills: ["Java"], availableFrom: null, experienceLevel: 14 });
	assert.equal(result.ok, true);
	assert.deepEqual(JSON.parse(calls[0].init?.body as string), { education: "Master MIAGE", study_degree: 5, skills: ["Java"], available_from: null, experience_level: 14 });
	// Un serveur plus ancien que JOB-071 : valeurs par défaut
	assert.deepEqual(result.ok && result.profile, empty);
});

test("API : suggestions du CV, CV absent, session expirée et réseau", async () => {
	const calls = mockFetch(() =>
		Response.json({ readable: true, suggestions: { desired_position: "Data analyst", study_degree: 3, skills: ["Python"], region: "Bordeaux" } }),
	);
	assert.deepEqual(await getCvSuggestions(7), {
		ok: true,
		readable: true,
		suggestions: { desiredPosition: "Data analyst", studyDegree: 3, skills: ["Python"], region: "Bordeaux" },
	});
	assert.equal(calls[0].url, "/api/student/7/resume/suggestions");
	assert.equal(calls[0].init?.credentials, "same-origin");
	mockFetch(() => Response.json({ readable: false, suggestions: {} }));
	assert.deepEqual(await getCvSuggestions(7), { ok: true, readable: false, suggestions: {} });
	mockFetch(() => Response.json({ error: "Resume not found" }, { status: 404 }));
	assert.deepEqual(await getCvSuggestions(7), { ok: false, reason: "noCv" });
	mockFetch(() => Response.json({}, { status: 403 }));
	assert.deepEqual(await getCvSuggestions(7), { ok: false, reason: "unauthenticated" });
	mockFetch(() => new Response("<html>", { status: 500 }));
	assert.deepEqual(await getCvSuggestions(7), { ok: false, reason: "server" });
	mockFetch(() => Promise.reject(new TypeError("offline")));
	assert.deepEqual(await getCvSuggestions(7), { ok: false, reason: "network" });
});

test("résumé du profil : les mots du profil vu par les recruteurs, ou « Non renseigné »", () => {
	const html = renderToStaticMarkup(<ProfileDetailsSummary profile={full} />);
	assert.match(html, /<dt[^>]*>Formation<\/dt><dd[^>]*>Master MIAGE<\/dd>/);
	assert.match(html, /Bac \+ 5/);
	assert.match(html, /1 an et 2 mois/);
	// Le mois seulement, comme les recruteurs ; une date passée : disponible tout de suite
	assert.match(html, /<dd[^>]*>Disponible immédiatement<\/dd>/);
	assert.match(renderToStaticMarkup(<ProfileDetailsSummary profile={{ ...full, availableFrom: "2099-09-01" }} />), /<dd[^>]*>Disponible en septembre 2099<\/dd>/);
	// Les pastilles grises du profil vu par les recruteurs
	assert.match(html, /<li class="[^"]*bg-\[#f3f4f6\][^"]*text-\[#4b5563\][^"]*">Java<\/li><li[^>]*>SQL<\/li>/);
	// Le domaine n'est pas montré, l'expérience est dite absente du profil vu par les recruteurs
	assert.doesNotMatch(html, /Domaine|Informatique/);
	assert.match(html, /sauf l’expérience : elle sert seulement à leurs filtres/);
	const blank = renderToStaticMarkup(<ProfileDetailsSummary profile={empty} />);
	assert.equal((blank.match(/Non renseigné/g) ?? []).length, 4);
	assert.match(blank, /Aucune compétence indiquée\./);
});

test("formulaire du profil : chaque champ étiqueté, valeurs actuelles, compétences retirables", () => {
	const html = renderToStaticMarkup(<ProfileDetailsForm profile={full} onSave={async () => ({ ok: true, profile: full })} onDone={() => {}} />);
	for (const label of ["Formation", "Niveau d’études", "Expérience professionnelle (en mois)", "Disponible à partir du", "Région recherchée"]) {
		assert.match(html, new RegExp(`<label for="[^"]+"[^>]*>${label.replace(/[()]/g, "\\$&")}</label>`), label);
	}
	assert.match(html, /value="Master MIAGE"/);
	assert.match(html, /<option value="5" selected="">Bac \+ 5<\/option>/);
	assert.doesNotMatch(html, /Domaine|Informatique/);
	assert.match(html, /type="date"[^>]*value="2026-09-01"/);
	// Ce que les recruteurs verront de la date, relié au champ
	assert.match(html, /aria-describedby="([^"]+-availableFrom-hint)"[^>]*\/>.*<p id="\1"[^>]*>Les recruteurs voient : « Disponible immédiatement »\.<\/p>/);
	assert.match(renderToStaticMarkup(<ProfileDetailsForm profile={empty} onSave={async () => ({ ok: true, profile: empty })} onDone={() => {}} />), /Les recruteurs voient le mois, pas le jour\./);
	assert.match(html, /aria-label="Retirer Java"/);
	assert.match(html, /2\/20 compétences/);
	assert.match(html, /<datalist[^>]*><option value="Île-de-France">/);
});

test("panneau du CV : lecture, CV illisible, rien de nouveau, puis les valeurs à cocher", () => {
	const base = { choices: [], checked: new Set<never>(), onToggle: () => {}, onApply: () => {}, onClose: () => {}, onRetry: () => {}, applying: false, error: "", applied: "" };
	assert.match(renderToStaticMarkup(<CvSuggestionsView {...base} result={null} />), /role="status"[^>]*>Lecture de votre CV…/);
	assert.match(renderToStaticMarkup(<CvSuggestionsView {...base} result={{ ok: true, readable: false, suggestions: {} }} />), /ne peut pas être lu \(ancien format \.doc, ou PDF scanné\)/);
	assert.match(renderToStaticMarkup(<CvSuggestionsView {...base} result={{ ok: true, readable: true, suggestions: {} }} />), /Votre profil contient déjà/);
	assert.match(renderToStaticMarkup(<CvSuggestionsView {...base} result={{ ok: false, reason: "noCv" }} />), /Importez d’abord un CV/);
	const failed = renderToStaticMarkup(<CvSuggestionsView {...base} result={{ ok: false, reason: "network" }} />);
	assert.match(failed, /role="alert"/);
	assert.match(failed, />Réessayer</);

	const suggestions = { education: "Master 2 MIAGE", skills: ["Docker"] };
	const choices = suggestionChoices(suggestions, full);
	const html = renderToStaticMarkup(<CvSuggestionsView {...base} result={{ ok: true, readable: true, suggestions }} choices={choices} checked={new Set(["skills"])} />);
	assert.match(html, /rien n’est modifié sans votre accord/);
	// Formation non cochée, compétences cochées
	assert.match(html, /<input type="checkbox" class="[^"]*"\/><span[^>]*><span[^>]*>Formation<\/span><span[^>]*>Master 2 MIAGE<\/span><span[^>]*>Actuellement : Master MIAGE/);
	assert.match(html, /<input type="checkbox" class="[^"]*" checked=""\/><span[^>]*><span[^>]*>Compétences à ajouter<\/span><span[^>]*>Docker/);
	assert.match(html, />Appliquer à mon profil</);
	// Rien de coché : rien à appliquer
	assert.match(renderToStaticMarkup(<CvSuggestionsView {...base} result={{ ok: true, readable: true, suggestions }} choices={choices} />), /<button type="submit"[^>]*disabled=""/);
	assert.match(renderToStaticMarkup(<CvSuggestionsView {...base} result={null} applied="Votre profil est complété." />), /role="status"[^>]*>Votre profil est complété\./);
});
