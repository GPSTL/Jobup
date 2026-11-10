// Presence of the student (JOB-039, REC-05): the server writes down the time of each request of a
// logged-in user (jobup/presence.py), and recruiters see a candidate « En ligne » for 2 minutes after it.
// While a page of the student space is visible, one request per minute keeps them « En ligne »;
// a closed or hidden tab shows them « Hors ligne » within 2 minutes.
export const HEARTBEAT_DELAY = 60_000;

/** Starts the requests; returns the function that stops them */
export function startHeartbeat(): () => void {
	const timer = setInterval(() => {
		// The answer does not matter: the request itself is the sign of presence
		if (document.visibilityState === "visible") fetch("/api/me", { credentials: "same-origin" }).catch(() => {});
	}, HEARTBEAT_DELAY);
	return () => clearInterval(timer);
}
