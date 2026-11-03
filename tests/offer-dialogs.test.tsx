import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
	IS_REACT_ACT_ENVIRONMENT: true });
// jsdom has no top layer; native focus trapping still requires a browser check.
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };

const offer = { id: 7, title: "Développeur", description: "Description", image_url: "", requirements: "Python",
	category: "IT", company: "Atelier", contract_type: "alternance", duration: "12 mois", start_date: "2027-01-01", location: "Paris", created_at: "2026-11-03" };

async function setup() {
	const { act } = await import("react");
	const { createRoot } = await import("react-dom/client");
	const { EditOfferDialog, DeleteOfferDialog } = await import("../front/components/OfferDialogs");
	const root = createRoot(document.getElementById("root")!);
	const render = async (component: React.ReactNode) => { await act(async () => root.render(component)); };
	const cleanup = async () => { await act(async () => root.unmount()); };
	const click = async (label: string) => {
		const button = [...document.querySelectorAll("button")].find(node => node.textContent === label);
		assert.ok(button, `Missing button ${label}`);
		await act(async () => button.click());
	};
	return { act, render, cleanup, click, EditOfferDialog, DeleteOfferDialog };
}

test("cancel identifies the selected offer and performs no API write", async () => {
	const { render, cleanup, click, DeleteOfferDialog } = await setup();
	let calls = 0, closed = 0;
	globalThis.fetch = async () => { calls++; throw new Error("Unexpected API call"); };
	await render(<DeleteOfferDialog offer={offer} onClose={() => closed++} onDeleted={() => assert.fail("Deleted on cancel")} />);
	assert.match(document.body.textContent!, /Développeur.*Atelier/);
	await click("Annuler");
	assert.equal(closed, 1); assert.equal(calls, 0);
	await cleanup();
});

test("edit prefills every field, keeps changed values after failure and retries", async () => {
	const { act, render, cleanup, EditOfferDialog } = await setup();
	let saves = 0, writes = 0;
	globalThis.fetch = async (url, options) => {
		if (url === "/api/csrf") return Response.json({ csrfToken: "test-token" });
		writes++;
		assert.equal(options?.method, "PATCH");
		assert.equal((options?.headers as Record<string, string>)["X-CSRFToken"], "test-token");
		assert.equal(JSON.parse(options?.body as string).title, "Titre modifié");
		return writes === 1 ? Response.json({ title: ["Titre invalide"] }, { status: 400 }) : Response.json({ ...offer, title: "Titre modifié" });
	};
	await render(<EditOfferDialog offer={offer} onClose={() => assert.fail("Closed after error")} onSaved={() => saves++} />);
	for (const key of ["title", "description", "image_url", "requirements", "contract_type", "duration", "start_date", "company", "location"] as const) {
		assert.equal((document.querySelector(`[name='${key}']`) as HTMLInputElement).value, offer[key]);
	}
	const title = document.querySelector("[name=title]") as HTMLInputElement;
	await act(async () => {
		Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(title, "Titre modifié");
		title.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
	});
	const submit = () => document.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
	await act(async () => { submit(); });
	assert.equal(title.value, "Titre modifié");
	assert.match(document.querySelector("[role=alert]")!.textContent!, /Vérifiez/);
	assert.match(document.getElementById("error-title")!.textContent!, /Titre invalide/);
	assert.equal(saves, 0);
	await act(async () => { submit(); });
	assert.equal(saves, 1); assert.equal(writes, 2);
	await cleanup();
});

test("delete blocks duplicate operations while pending and permits retry after network failure", async () => {
	const { act, render, cleanup, click, DeleteOfferDialog } = await setup();
	let writes = 0, deleted = 0;
	let reject!: (error: Error) => void;
	globalThis.fetch = async (url, options) => {
		if (url === "/api/csrf") return Response.json({ csrfToken: "token" });
		assert.equal(options?.method, "DELETE"); writes++;
		if (writes === 1) return await new Promise<Response>((_, rejectRequest) => { reject = rejectRequest; });
		return new Response(null, { status: 204 });
	};
	await render(<DeleteOfferDialog offer={offer} onClose={() => assert.fail("Closed while pending")} onDeleted={() => deleted++} />);
	await click("Supprimer");
	assert.equal(writes, 1);
	for (const button of document.querySelectorAll("button")) assert.equal(button.disabled, true);
	await act(async () => { for (const button of document.querySelectorAll("button")) button.click(); });
	assert.equal(writes, 1);
	await act(async () => reject(new TypeError("Offline")));
	assert.match(document.querySelector("[role=alert]")!.textContent!, /Réessayez/);
	assert.equal(deleted, 0);
	await click("Supprimer");
	assert.equal(writes, 2); assert.equal(deleted, 1);
	await cleanup();
});

test("edit prevents duplicate submits and retains input when access is refused", async () => {
	const { act, render, cleanup, EditOfferDialog } = await setup();
	let writes = 0;
	let finish!: (response: Response) => void;
	globalThis.fetch = async url => {
		if (url === "/api/csrf") return Response.json({ csrfToken: "token" });
		writes++;
		return await new Promise<Response>(resolve => { finish = resolve; });
	};
	await render(<EditOfferDialog offer={offer} onClose={() => assert.fail("Unexpected close")} onSaved={() => assert.fail("Saved without permission")} />);
	await act(async () => {
		for (let i = 0; i < 2; i++) document.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
	});
	assert.equal(writes, 1);
	assert.equal(document.querySelector("fieldset")!.disabled, true);
	await act(async () => finish(Response.json({ detail: "Forbidden" }, { status: 403 })));
	assert.match(document.querySelector("[role=alert]")!.textContent!, /Accès refusé/);
	assert.equal((document.querySelector("[name=title]") as HTMLInputElement).value, offer.title);
	assert.equal(document.querySelector("fieldset")!.disabled, false);
	await cleanup();
});
