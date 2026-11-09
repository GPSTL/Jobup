import { test } from "node:test";
import assert from "node:assert/strict";
import { presenceState, PRESENCE_TTL } from "../front/components/CandidatePresence";
import { createRecruiterDemo } from "../front/demo/recruiterMessages";

test("presence expires and never treats missing, invalid or future timestamps as online", () => {
	const now = Date.parse("2026-11-09T12:00:00Z");
	assert.equal(presenceState(new Date(now - PRESENCE_TTL + 1).toISOString(), now), "online");
	assert.equal(presenceState(new Date(now - PRESENCE_TTL).toISOString(), now), "offline");
	assert.equal(presenceState(null, now), "unknown");
	assert.equal(presenceState("invalid", now), "unknown");
	assert.equal(presenceState(new Date(now + 1000).toISOString(), now), "unknown");
});

test("explicit preview rejects blanks and isolates messages between conversations", async () => {
	const { transport } = createRecruiterDemo();
	assert.deepEqual(await transport.sendMessage(1, "  "), { ok: false, reason: "invalid" });
	const result = await transport.sendMessage(1, "Bonjour Sarah");
	assert.equal(result.ok, true);
	const own = await transport.getMessages(1);
	assert.ok(own.ok && own.messages.some((item) => item.body === "Bonjour Sarah"));
	const other = await transport.getMessages(2);
	assert.ok(other.ok && other.messages.length === 0);
	const reset = await createRecruiterDemo().transport.getMessages(1);
	assert.ok(reset.ok && !reset.messages.some((item) => item.body === "Bonjour Sarah"));
});
