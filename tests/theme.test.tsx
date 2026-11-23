import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ThemeToggle from "../front/components/ThemeToggle";

test("light is the default even with a dark system theme, and saved dark mode is respected", (t) => {
	let savedTheme: string | null = null;
	const browserGlobals = {
		document: {},
		window: { matchMedia: () => ({ matches: true }) },
		localStorage: { getItem: () => savedTheme },
	};

	for (const [key, value] of Object.entries(browserGlobals)) {
		const original = Object.getOwnPropertyDescriptor(globalThis, key);
		Object.defineProperty(globalThis, key, { value, configurable: true });
		t.after(() => {
			if (original) Object.defineProperty(globalThis, key, original);
			else Reflect.deleteProperty(globalThis, key);
		});
	}

	assert.match(renderToStaticMarkup(<ThemeToggle />), /Activer le mode sombre/);
	savedTheme = "dark";
	assert.match(renderToStaticMarkup(<ThemeToggle />), /Activer le mode clair/);
});
