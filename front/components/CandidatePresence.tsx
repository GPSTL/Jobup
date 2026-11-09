import { useEffect, useState } from "react";

// Proposed rule, to validate with backend: observed activity expires after 2 min.
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
	const state = presenceState(lastSeen, now);
	return <p role="status" className="flex items-center gap-1.5 text-xs font-normal text-gray-500">
		<span aria-hidden="true" className={`size-2 rounded-full ${state === "online" ? "bg-green-600" : "bg-gray-400"}`} />
		{state === "online" ? "En ligne" : state === "offline" ? "Hors ligne" : "Présence indisponible"}
	</p>;
}
