import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { newOfferSchema } from "../front/utils/offer";

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
Object.assign(globalThis, { window: dom.window, document: dom.window.document,
  HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });

const valid = { title: "Développeur", description: "Construire une application", category: "1", requirements: "Python",
  image_url: "", contract_type: "alternance", duration: "12 mois", start_date: "", company: "", location: "Paris" };

test("creation validation rejects blank required fields, unsafe images and impossible dates", () => {
  assert.equal(newOfferSchema.safeParse(valid).success, true);
  for (const [key, value] of [["title", " "], ["description", "\n"], ["category", ""], ["title", "x".repeat(129)],
    ["image_url", "javascript:alert(1)"], ["image_url", "ftp://example.com/a.png"], ["start_date", "2027-02-30"]]) {
    assert.equal(newOfferSchema.safeParse({ ...valid, [key]: value }).success, false, `${key}: ${value}`);
  }
});

async function setup(handler?: typeof fetch) {
  const writes: RequestInit[] = [];
  globalThis.fetch = async (url, options) => {
    if (url === "/api/recruiter/offers/categories") return Response.json([{ value: 1, label: "Informatique" }]);
    if (url === "/api/csrf") return Response.json({ csrfToken: "test-token" });
    writes.push(options!);
    return handler ? handler(url, options) : Response.json({ id: 42 }, { status: 201 });
  };
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { MemoryRouter, Routes, Route, useLocation } = await import("react-router-dom");
  const { default: CreateOfferPage } = await import("../front/pages/CreateOfferPage");
  function Destination() { const location = useLocation(); return <p data-destination={location.pathname}>{location.state?.offerCreated ? "Offre publiée" : "Vos offres"}</p>; }
  const root = createRoot(document.getElementById("root")!);
  await act(async () => root.render(<MemoryRouter initialEntries={["/recruiter/offers/new"]}>
    <Routes><Route path="/recruiter/offers/new" element={<CreateOfferPage />} />
      <Route path="/recruiter/offers" element={<Destination />} />
      <Route path="/recruiter/offers/:id" element={<Destination />} /></Routes>
  </MemoryRouter>));
  const change = async (name: string, value: string) => {
    const input = document.querySelector(`[name='${name}']`) as HTMLInputElement;
    assert.ok(input, name);
    await act(async () => {
      const prototype = input.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype
        : input.tagName === "TEXTAREA" ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new dom.window.Event(input.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
    });
  };
  const fill = async () => { for (const [key, value] of Object.entries(valid)) await change(key, value); };
  const submit = () => document.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  const cleanup = async () => { await act(async () => root.unmount()); };
  return { act, writes, fill, change, submit, cleanup };
}

test("cancel returns to the list without creating an offer", async () => {
  const { act, writes, cleanup } = await setup();
  await act(async () => [...document.querySelectorAll("button")].find(button => button.textContent === "Annuler")!.click());
  assert.equal(writes.length, 0);
  assert.ok(document.querySelector('[data-destination="/recruiter/offers"]'));
  await cleanup();
});

test("invalid form performs no write and associates errors with required fields", async () => {
  const { act, writes, submit, cleanup } = await setup();
  await act(async () => { submit(); });
  assert.equal(writes.length, 0);
  for (const key of ["title", "description", "category"]) {
    const field = document.querySelector(`[name='${key}']`)!;
    assert.equal(field.getAttribute("aria-invalid"), "true");
    assert.ok(document.getElementById(field.getAttribute("aria-describedby")!));
  }
  await cleanup();
});

test("server field error retains values and retry publishes with CSRF then opens the new offer", async () => {
  let attempt = 0;
  const { act, writes, fill, submit, cleanup } = await setup(async (_url, options) => {
    assert.equal(options!.method, "POST");
    assert.equal((options!.headers as Record<string, string>)["X-CSRFToken"], "test-token");
    assert.equal(options!.credentials, "same-origin");
    assert.equal(JSON.parse(options!.body as string).category, 1);
    assert.equal(JSON.parse(options!.body as string).start_date, null);
    return ++attempt === 1 ? Response.json({ title: ["Titre invalide"] }, { status: 400 })
      : Response.json({ id: 42 }, { status: 201 });
  });
  await fill();
  await act(async () => { submit(); });
  assert.equal((document.querySelector('[name="description"]') as HTMLTextAreaElement).value, valid.description);
  assert.match(document.getElementById("offer-title-error")!.textContent!, /Titre invalide/);
  assert.equal(writes.length, 1);
  await act(async () => { submit(); });
  assert.equal(writes.length, 2);
  assert.ok(document.querySelector('[data-destination="/recruiter/offers/42"]'));
  assert.match(document.body.textContent!, /Offre publiée/);
  await cleanup();
});

test("pending submissions are locked and expired access preserves the form for retry", async () => {
  let finish!: (response: Response) => void;
  const { act, writes, fill, submit, cleanup } = await setup(async () => new Promise(resolve => { finish = resolve; }));
  await fill();
  await act(async () => { submit(); submit(); });
  assert.equal(writes.length, 1);
  assert.equal(document.querySelector("fieldset")!.disabled, true);
  for (const button of document.querySelectorAll('form button')) assert.equal((button as HTMLButtonElement).disabled, true);
  await act(async () => finish(Response.json({ detail: "Forbidden" }, { status: 403 })));
  assert.match(document.querySelector('[role="alert"]')!.textContent!, /accès a expiré/);
  assert.equal((document.querySelector('[name="title"]') as HTMLInputElement).value, valid.title);
  assert.equal(document.querySelector("fieldset")!.disabled, false);
  assert.ok(document.querySelector('a[href="/login"][target="_blank"]'));
  await cleanup();
});

test("network failure preserves input and allows retry", async () => {
  let attempts = 0;
  const { act, fill, submit, cleanup } = await setup(async () => {
    if (++attempts === 1) throw new TypeError("Offline");
    return Response.json({ id: 99 }, { status: 201 });
  });
  await fill();
  await act(async () => { submit(); });
  assert.match(document.querySelector('[role="alert"]')!.textContent!, /Vérifiez votre connexion/);
  assert.equal((document.querySelector('[name="title"]') as HTMLInputElement).value, valid.title);
  await act(async () => { submit(); });
  assert.ok(document.querySelector('[data-destination="/recruiter/offers/99"]'));
  await cleanup();
});
