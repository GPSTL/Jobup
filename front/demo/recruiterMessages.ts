// Explicit preview only. Memory is reset on reload; no localStorage or backend writes.
import type { MessageTransport } from "../components/MessageThread";
import type { Message } from "../services/messages";
import type { RecruiterConversation } from "../services/recruiterConversations";

export function createRecruiterDemo() {
	const now = Date.now();
	const conversations: RecruiterConversation[] = [
		{ id: 1, candidate: { id: 1, first_name: "Lucas", last_name: "Martin" }, last_seen_at: new Date(now).toISOString(), last_message: { body: "Bonjour, merci pour votre retour ! Je suis disponible mardi ou jeudi pour un entretien.", created_at: new Date(now - 60_000).toISOString(), from_me: false } },
		{ id: 2, candidate: { id: 2, first_name: "Sophie", last_name: "Bernard" }, last_seen_at: new Date(now - 600_000).toISOString(), last_message: null },
		{ id: 3, candidate: { id: 3, first_name: "Emma", last_name: "Garcia" }, last_seen_at: null, last_message: null },
	];
	const data: Record<number, Message[]> = {
		1: [
			{ id: 1, body: "Bonjour Lucas, votre profil nous intéresse.", created_at: new Date(now - 86_400_000).toISOString(), from_me: true },
			{ id: 2, body: conversations[0].last_message!.body, created_at: new Date(now - 60_000).toISOString(), from_me: false },
		],
		2: [],
		3: [],
	};
	let nextId = 3;
	const transport: MessageTransport = {
		async getMessages(id, cursor) {
			if (!data[id]) return { ok: false, reason: "notFound" };
			const messages = data[id].filter((item) => !cursor || ("after" in cursor ? item.id > cursor.after : item.id < cursor.before));
			return { ok: true, messages: [...messages], hasMore: false };
		},
		async sendMessage(id, body) {
			if (!data[id]) return { ok: false, reason: "notFound" };
			if (!body.trim() || body.trim().length > 2000) return { ok: false, reason: "invalid" };
			const message = { id: nextId++, body: body.trim(), created_at: new Date().toISOString(), from_me: true };
			data[id].push(message);
			const conversation = conversations.find((item) => item.id === id)!;
			conversation.last_message = message;
			return { ok: true, message };
		},
	};
	return { conversations, transport };
}
