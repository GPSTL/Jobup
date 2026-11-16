import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { getStudentConversations, type ConversationSummary } from "../front/services/conversations";
import { conversationDate, formatConversationDate, interlocutorInitials, interlocutorName, lastMessagePreview } from "../front/utils/conversations";

const realFetch = globalThis.fetch;
const conversation: ConversationSummary = {
	id: 3,
	interlocutor: { kind: "recruiter", first_name: "Léa", last_name: "Martin", organization: "Acme" },
	last_message: { body: "Disponible jeudi ?", created_at: "2026-11-03T10:32:00", from_me: false, attachment: null },
	created_at: "2026-10-01T09:00:00",
};

// Remplace fetch par une réponse simulée et garde la trace des URL appelées
function mockFetch(respond: () => Response | Promise<Response>) {
	const urls: string[] = [];
	globalThis.fetch = (async (url: string) => {
		urls.push(url);
		return respond();
	}) as typeof fetch;
	return urls;
}

afterEach(() => {
	globalThis.fetch = realFetch;
});

test("liste : sans recherche puis avec recherche encodée", async () => {
	const urls = mockFetch(() => Response.json([conversation]));
	assert.deepEqual(await getStudentConversations("  "), { ok: true, conversations: [conversation] });
	await getStudentConversations(" léa acme ");
	assert.deepEqual(urls, ["/api/student/conversations", "/api/student/conversations?q=l%C3%A9a%20acme"]);
});

test("liste : sans session, erreur serveur, erreur réseau", async () => {
	mockFetch(() => Response.json({ detail: "Not authenticated" }, { status: 403 }));
	assert.deepEqual(await getStudentConversations(), { ok: false, reason: "noSession" });
	mockFetch(() => new Response("oops", { status: 500 }));
	assert.deepEqual(await getStudentConversations(), { ok: false, reason: "server" });
	mockFetch(() => new Response("<!doctype html>", { status: 200 }));
	assert.deepEqual(await getStudentConversations(), { ok: false, reason: "server" });
	mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
	assert.deepEqual(await getStudentConversations(), { ok: false, reason: "network" });
});

test("affichage : interlocuteur, initiales et aperçu", () => {
	assert.equal(interlocutorName(conversation), "Léa Martin – Acme");
	assert.equal(interlocutorInitials(conversation), "LM");
	assert.equal(lastMessagePreview(conversation), "Disponible jeudi ?");
	assert.equal(lastMessagePreview({ ...conversation, last_message: { ...conversation.last_message!, from_me: true } }), "Vous : Disponible jeudi ?");
	assert.equal(lastMessagePreview({ ...conversation, last_message: null }), "Aucun message pour l’instant");
	// Un message qui ne contient qu'un fichier montre son nom ; avec du texte, le texte reste affiché
	const file = { ...conversation.last_message!, body: "", attachment: "Convocation_entretien.pdf" };
	assert.equal(lastMessagePreview({ ...conversation, last_message: file }), "Pièce jointe : Convocation_entretien.pdf");
	assert.equal(lastMessagePreview({ ...conversation, last_message: { ...file, from_me: true } }), "Vous : Pièce jointe : Convocation_entretien.pdf");
	assert.equal(lastMessagePreview({ ...conversation, last_message: { ...file, body: "Voici" } }), "Voici");
	const school = { ...conversation, interlocutor: { kind: "school" as const, first_name: "Inès", last_name: "Roux", organization: "Université Paris" } };
	assert.equal(interlocutorName(school), "Inès Roux – Université Paris");
});

test("dates : heure, hier, jour de la semaine, puis date complète", () => {
	// Mardi 3 novembre 2026, 15 h
	const now = new Date(2026, 10, 3, 15, 0);
	assert.equal(formatConversationDate(new Date(2026, 10, 3, 10, 32).toISOString(), now), "10:32");
	assert.equal(formatConversationDate(new Date(2026, 10, 2, 23, 59).toISOString(), now), "Hier");
	assert.equal(formatConversationDate(new Date(2026, 9, 29, 8, 0).toISOString(), now), "Jeu.");
	assert.equal(formatConversationDate(new Date(2026, 9, 20, 8, 0).toISOString(), now), "20/10/2026");
	// Sans message : date de création de la conversation
	assert.equal(conversationDate({ ...conversation, last_message: null }, now), "01/10/2026");
});
