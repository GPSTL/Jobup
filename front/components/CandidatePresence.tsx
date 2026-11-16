import { useEffect, useState } from "react";

// « En ligne » when the last request of the candidate is less than 2 minutes old (JOB-039):
// docs/api/recruiter-conversations.md
export const PRESENCE_TTL = 120_000;
export function presenceState(lastSeen: string | null, now: number) {
	if (!lastSeen) return "unknown";
	const elapsed = now - Date.parse(lastSeen);
	if (!Number.isFinite(elapsed) || elapsed < 0) return "unknown";
	return elapsed < PRESENCE_TTL ? "online" : "offline";
}

export default function CandidatePresence({ lastSeen }: { lastSeen: string | null }) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 5_000);
		return () => clearInterval(timer);
	}, []);
	// A list received since the last tick can be newer than `now`: the candidate was seen just now
	const seenAt = lastSeen === null ? NaN : Date.parse(lastSeen);
	const state = presenceState(lastSeen, Number.isNaN(seenAt) ? now : Math.max(now, seenAt));
	return <p role="status" className="flex items-center gap-1.5 text-xs font-normal text-gray-500">
		<span aria-hidden="true" className={`size-2 rounded-full ${state === "online" ? "bg-green-600" : "bg-gray-400"}`} />
		{state === "online" ? "En ligne" : state === "offline" ? "Hors ligne" : "Présence indisponible"}
	</p>;
}
