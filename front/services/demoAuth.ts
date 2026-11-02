import type { User } from "./auth";

export const DEMO_EMAIL = "test@gmail.com";
export const DEMO_PASSWORD = "Demo123!";
const SESSION_KEY = "jobup.demo-session";
const DEMO_USER: User = { id: 0, name: "Test", first_name: "Étudiant", role: 1 };

// This flag only opens simulated frontend screens. It never creates a Django
// session or grants access to authenticated backend endpoints.
export function getDemoUser(): User | null {
	try {
		return window.sessionStorage.getItem(SESSION_KEY) === "active" ? { ...DEMO_USER } : null;
	} catch {
		return null;
	}
}

export function startDemoSession(): boolean {
	try {
		window.sessionStorage.setItem(SESSION_KEY, "active");
		return true;
	} catch {
		return false;
	}
}

export function endDemoSession() {
	try {
		window.sessionStorage.removeItem(SESSION_KEY);
	} catch {
		// Storage may be disabled by the browser.
	}
}
