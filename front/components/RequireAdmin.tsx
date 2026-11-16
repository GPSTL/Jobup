import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ADMIN_ROLE, getSession, type SessionResult } from "../services/auth";
import { adminLoginLink } from "../utils/adminUsers";

export default function RequireAdmin({ children }: { children: ReactNode }) {
	const location = useLocation();
	const [session, setSession] = useState<SessionResult | null>(null);
	const [attempt, setAttempt] = useState(0);
	useEffect(() => {
		let ignore = false;
		const check = () => { getSession().then((result) => { if (!ignore) setSession(result); }); };
		check();
		const onVisible = () => { if (document.visibilityState === "visible") check(); };
		document.addEventListener("visibilitychange", onVisible);
		return () => { ignore = true; document.removeEventListener("visibilitychange", onVisible); };
	}, [attempt]);
	if (!session) return <main className="p-12 text-center" aria-busy="true">Chargement…</main>;
	if (!session.ok) {
		// The admin login, then back to this page
		if (session.reason === "noSession") return <Navigate to={adminLoginLink(location.pathname + location.search)} replace />;
		return <main className="p-12 text-center"><p role="alert">Impossible de vérifier votre session.</p><button className="mt-4 cursor-pointer text-primary underline" onClick={() => setAttempt(attempt + 1)}>Réessayer</button></main>;
	}
	// ADM-13: an account of another role goes back to the home page, as with the server
	if (session.user.role !== ADMIN_ROLE) return <Navigate to="/" replace />;
	return children;
}
