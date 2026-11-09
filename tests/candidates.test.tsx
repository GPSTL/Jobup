import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import CandidateCard from "../front/components/CandidateCard";
import RecruiterNavbar from "../front/components/RecruiterNavbar";
import { CandidateProfile } from "../front/pages/CandidateProfilePage";
import { CandidateDeck } from "../front/pages/CandidatesPage";
import type { Candidate } from "../front/services/candidates";
import { availability, cardIndex, degreeLabel, exchangeText, initials } from "../front/utils/candidates";

const candidate: Candidate = {
	id: 7,
	first_name: "Lucas",
	last_name: "Martin",
	photo_url: "/media/photos/lucas.png",
	education: "Master MIAGE",
	school: "Université Paris Nanterre",
	description: "Étudiant en Master MIAGE, je recherche une alternance de 12 mois.",
	cv_url: "/api/recruiter/candidates/7/cv",
	region: "Paris",
	study_degree: 4,
	available_from: "2026-11-02",
	skills: ["Java", "Spring Boot"],
	experiences: [{ title: "Développeur Java — Banque Horizon", details: "Alternance • 2025 – 2026" }],
	exchanges: [
		{ kind: "application", id: 3, date: "2026-10-15T09:00:00Z", offer_title: "Développeur Java en alternance" },
		{ kind: "message", id: 9, date: "2026-10-16T09:00:00Z", from_me: true, body: "Bonjour Lucas" },
	],
};

// Étudiant qui n'a renseigné que son nom
const incomplete: Candidate = {
	...candidate,
	id: 8,
	photo_url: null,
	education: null,
	school: null,
	description: "",
	cv_url: null,
	study_degree: null,
	available_from: null,
	skills: [],
	experiences: [],
	exchanges: [],
};

const render = (element: React.ReactNode, path = "/") =>
	renderToStaticMarkup(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);

// Balise <a> complète dont le texte se termine par `text`, icône comprise
const link = (html: string, text: string) => html.match(new RegExp(`<a [^>]*>(?:(?!</a>).)*${text}</a>`))?.[0] ?? "";

test("initiales, niveau d'études et carte affichée selon l'URL", () => {
	assert.equal(initials({ first_name: "inès", last_name: "Diallo" }), "ID");
	assert.equal(degreeLabel(4), "Bac + 4");
	const candidates = [{ id: 7 }, { id: 8 }];
	assert.equal(cardIndex(candidates, "8"), 1);
	// Candidat absent de la liste, ou aucun candidat dans l'URL : première carte
	assert.equal(cardIndex(candidates, "42"), 0);
	assert.equal(cardIndex(candidates, null), 0);
});

test("disponibilité : le mois à venir, puis « immédiatement » une fois ce mois arrivé", () => {
	const now = new Date(2026, 9, 20); // 20 octobre 2026
	assert.equal(availability("2026-11-01", now), "Disponible en novembre 2026");
	assert.equal(availability("2026-10-31", now), "Disponible immédiatement");
	assert.equal(availability("2025-01-15", now), "Disponible immédiatement");
});

test("historique : candidature reçue et messages, « Vous » pour ceux du recruteur", () => {
	const [application, message] = candidate.exchanges;
	assert.equal(exchangeText(application, candidate), "Candidature reçue — Développeur Java en alternance");
	assert.equal(exchangeText(message, candidate), "Vous : « Bonjour Lucas »");
	const answer = { kind: "message", id: 10, date: "2026-10-17T09:00:00Z", from_me: false, body: "Merci" } as const;
	assert.equal(exchangeText(answer, candidate), "Lucas : « Merci »");
});

test("carte : nom, formation et école, photo, lien vers le profil et téléchargement du CV", () => {
	const html = render(<CandidateCard candidate={candidate} />);
	assert.match(html, /<h2[^>]*>Lucas Martin<\/h2>/);
	assert.match(html, /Master MIAGE — Université Paris Nanterre/);
	assert.match(html, /<img src="\/media\/photos\/lucas\.png"/);
	assert.match(link(html, "Consulter le profil"), /href="\/recruiter\/candidates\/7"/);
	const cv = link(html, "Télécharger le CV");
	assert.match(cv, /href="\/api\/recruiter\/candidates\/7\/cv"/);
	assert.match(cv, / download=""/);
});

test("carte : sans photo, école ni CV, les initiales et des mentions adaptées, sans lien de téléchargement", () => {
	const html = render(<CandidateCard candidate={incomplete} />);
	assert.doesNotMatch(html, /<img/);
	assert.match(html, />LM<\/div>/);
	for (const text of ["École non renseignée", "Présentation non renseignée.", "CV non fourni"]) assert.ok(html.includes(text), text);
	assert.doesNotMatch(html, /download|Télécharger le CV/);
});

test("cartes : position annoncée, flèches inactives aux extrémités, carte suivante visible sous la carte", () => {
	const deck = (index: number) => render(<CandidateDeck candidates={[candidate, incomplete]} index={index} onSelect={() => {}} />);
	const nextCard = /<div aria-hidden="true" class="absolute/;

	const first = deck(0);
	assert.match(first, /Candidat 1 sur 2/);
	assert.match(first, /aria-label="Candidat précédent" aria-disabled="true"/);
	assert.match(first, /aria-label="Candidat suivant" aria-disabled="false"/);
	assert.match(first, nextCard);

	const last = deck(1);
	assert.match(last, /Candidat 2 sur 2/);
	assert.match(last, /aria-label="Candidat précédent" aria-disabled="false"/);
	assert.match(last, /aria-label="Candidat suivant" aria-disabled="true"/);
	assert.doesNotMatch(last, nextCard);
});

test("profil : informations, compétences, expérience, historique des échanges et CV", () => {
	const html = render(<CandidateProfile candidate={candidate} />);
	assert.match(html, /<h1[^>]*>Lucas Martin<\/h1>/);
	// Le retour ramène à la carte de ce candidat
	assert.match(link(html, "Retour aux candidats"), /href="\/recruiter\/candidates\?candidate=7"/);
	const texts = [
		"Master MIAGE — Université Paris Nanterre",
		"Paris",
		"Bac + 4",
		"Disponible",
		"Spring Boot",
		"Développeur Java — Banque Horizon",
		"Candidature reçue — Développeur Java en alternance",
		"Vous : « Bonjour Lucas »",
	];
	for (const text of texts) assert.ok(html.includes(text), text);
	assert.match(link(html, "Ouvrir la conversation"), /href="\/recruiter\/messages"/);
	const cv = link(html, "Télécharger le CV");
	assert.match(cv, /href="\/api\/recruiter\/candidates\/7\/cv"/);
	assert.match(cv, / download=""/);
});

test("profil incomplet : mentions adaptées, sans téléchargement ni conversation à ouvrir", () => {
	const html = render(<CandidateProfile candidate={incomplete} />);
	const texts = [
		"École non renseignée",
		"CV non fourni",
		"Présentation non renseignée.",
		"Aucune compétence renseignée.",
		"Aucune expérience renseignée.",
		"Aucun échange avec ce candidat pour le moment.",
	];
	for (const text of texts) assert.ok(html.includes(text), text);
	assert.doesNotMatch(html, /download|Ouvrir la conversation|Bac \+|Disponible/);
});

test("barre recruteur : liens de la maquette, « Candidats » actif sur le profil d'un candidat", () => {
	const html = render(<RecruiterNavbar />, "/recruiter/candidates/7");
	const labels = [...html.matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map((match) => match[1]);
	// Barre des grands écrans, puis menu des petits écrans
	const expected = ["Mon espace", "Filtrer", "Candidats", "Vos offres", "Messages"];
	assert.deepEqual(labels, [...expected, ...expected]);
	const active = [...html.matchAll(/<a [^>]*aria-current="page"[^>]*>([^<]+)<\/a>/g)].map((match) => match[1]);
	assert.deepEqual(active, ["Candidats", "Candidats"]);
});
