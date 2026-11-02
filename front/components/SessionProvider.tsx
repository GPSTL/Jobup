import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getSession, logout, type User } from "../services/auth";
import { getDemoUser } from "../services/demoAuth";

type Session = {
	user: User | null;
	loading: boolean;
	refresh: () => Promise<void>;
	signOut: () => Promise<boolean>;
};

const SessionContext = createContext<Session>({ user: null, loading: false, refresh: async () => {}, signOut: async () => false });
export const useSession = () => useContext(SessionContext);

export default function SessionProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(() => getDemoUser());
	const [loading, setLoading] = useState(!user);
	const request = useRef(0);
	const refresh = useCallback(async () => {
		const current = ++request.current;
		const result = await getSession();
		if (current !== request.current) return;
		setUser(result.ok ? result.user : null);
		setLoading(false);
	}, []);

	useEffect(() => {
		void refresh();
		const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			++request.current;
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, [refresh]);

	const signOut = async () => {
		if (!await logout()) return false;
		++request.current;
		setUser(null);
		setLoading(false);
		return true;
	};

	return <SessionContext.Provider value={{ user, loading, refresh, signOut }}>{children}</SessionContext.Provider>;
}
