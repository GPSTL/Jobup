import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import SessionProvider from "../front/components/SessionProvider";
import PublicNavbar from "../front/components/PublicNavbar";
import HomePage from "../front/pages/HomePage";
import OffersPage from "../front/pages/OffersPage";
import CompaniesPage from "../front/pages/CompaniesPage";
import PricingPage from "../front/pages/PricingPage";
import ComingSoonPage from "../front/pages/ComingSoonPage";
import StudentNavbar from "../front/components/StudentNavbar";
import { startDemoSession } from "../front/services/demoAuth";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
afterEach(() => {
	if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
	else Reflect.deleteProperty(globalThis, "window");
});

test("signed-in navigation is used on home, offers, companies and pricing without login reminders", () => {
	const storage = new Map<string, string>();
	Object.defineProperty(globalThis, "window", { configurable: true, value: { sessionStorage: {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => storage.set(key, value),
	} } });
	assert.equal(startDemoSession(), true);
	for (const Page of [HomePage, OffersPage, CompaniesPage, PricingPage, ComingSoonPage]) {
		const html = renderToStaticMarkup(<MemoryRouter><SessionProvider><Page /></SessionProvider></MemoryRouter>);
		const navbar = html.match(/<nav\b[\s\S]*?<\/nav>/)?.[0] ?? "";
		assert.match(navbar, /Mon espace/);
		assert.match(navbar, /Déconnexion/);
		assert.doesNotMatch(navbar, /Inscription|Connexion/);
		assert.doesNotMatch(html, /Connecte-toi|Crée ton compte pour suivre/);
		assert.match(navbar, /href="\/student\/offers"/);
		if (Page === CompaniesPage) assert.doesNotMatch(html, /href="\/login"/);
		if (Page === ComingSoonPage) {
			assert.match(html, /Bientôt disponible/);
			assert.match(html, /Retour à mon espace/);
		}
	}
});

test("visitor navigation retains signup and login", () => {
	const html = renderToStaticMarkup(<MemoryRouter><PublicNavbar /></MemoryRouter>);
	assert.match(html, /Inscription/);
	assert.match(html, /Connexion/);
	assert.doesNotMatch(html, /Déconnexion/);
});

test("student navigation highlights only the current section in desktop and mobile menus", () => {
	for (const path of ["/student", "/student/offers"]) {
		const html = renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><StudentNavbar /></MemoryRouter>);
		const activeLinks = html.match(/<a\b[^>]*aria-current="page"[^>]*>/g) ?? [];
		assert.equal(activeLinks.length, 2);
		for (const link of activeLinks) assert.ok(link.includes(`href="${path}"`), link);
	}
});
