import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true });
const offer = { id: 16, title: "Développeur Python", description: "Description complète\nDeuxième paragraphe", requirements: "Python et Django",
  company: "Atelier", category: "Computer Science & IT", image_url: "", contract_type: "alternance", duration: "12 mois",
  location: "Paris", start_date: "2027-01-01", created_at: "2026-11-03T12:00:00Z" };

async function setup(path = "/offers", handler?: typeof fetch) {
  const calls: string[] = [];
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    if (handler) return handler(url, options);
    return String(url).startsWith("/api/offers?") ? Response.json({ count: 1, results: [offer], next: null, previous: null }) : Response.json(offer);
  };
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { MemoryRouter, Routes, Route } = await import("react-router-dom");
  const { default: OffersPage } = await import("../front/pages/OffersPage");
  const { default: OfferDetailsPage } = await import("../front/pages/OfferDetailsPage");
  const root = createRoot(document.getElementById("root")!);
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/offers" element={<OffersPage />} /><Route path="/offers/:id" element={<OfferDetailsPage />} />
    <Route path="/login" element={<p data-login>Connexion</p>} />
  </Routes></MemoryRouter>));
  const click = async (text: string) => {
    const node = [...document.querySelectorAll("a, button")].find(node => node.textContent!.includes(text)) as HTMLElement;
    assert.ok(node, text); await act(async () => node.click());
  };
  const cleanup = async () => { await act(async () => root.unmount()); };
  return { act, calls, click, cleanup };
}

test("Voir l’offre opens the full public detail without redirecting to login", async () => {
  const { calls, click, cleanup } = await setup();
  const link = [...document.querySelectorAll("a")].find(node => node.textContent!.includes("Voir l’offre"))!;
  assert.equal(link.getAttribute("href"), "/offers/16");
  await click("Voir l’offre");
  assert.equal(document.querySelector("h1")!.textContent, offer.title);
  for (const value of [offer.description, offer.requirements, offer.company, offer.category, offer.location, offer.duration]) {
    assert.ok(document.querySelector("article")!.textContent!.includes(value), value);
  }
  assert.equal(document.querySelector("[data-login]"), null);
  assert.ok(calls.includes("/api/offers/16"));
  assert.ok(calls.every(url => url.startsWith("/api/offers")));
  await click("Retour aux offres");
  assert.equal(document.querySelector("h1")!.textContent, "Trouver une alternance");
  await cleanup();
});

test("minimal offer renders its description without empty badges or company separators", async () => {
  const minimal = { ...offer, duration: "", contract_type: "", location: "", requirements: "", start_date: null };
  const { click, cleanup } = await setup("/offers", async url => String(url).startsWith("/api/offers?")
    ? Response.json({ count: 1, results: [minimal] }) : Response.json(minimal));
  const card = document.querySelector("li")!;
  assert.ok(card.textContent!.includes(minimal.description));
  assert.ok(!card.textContent!.includes("•"));
  assert.equal(card.querySelectorAll("span.rounded-full").length, 0);
  await click("Voir l’offre");
  assert.ok(document.querySelector("article")!.textContent!.includes(minimal.description));
  assert.ok(!document.body.textContent!.includes("Profil recherché et compétences"));
  assert.ok(!document.body.textContent!.includes("Invalid Date"));
  await cleanup();
});

test("withdrawn or unknown offers show an unavailable message and a return link", async () => {
  const { cleanup } = await setup("/offers/999", async () => Response.json({ detail: "Not found" }, { status: 404 }));
  assert.match(document.querySelector('[role="alert"]')!.textContent!, /introuvable ou n’est plus disponible/);
  assert.equal(document.querySelector("article"), null);
  assert.ok(document.querySelector('a[href="/offers"]'));
  await cleanup();
});

test("detail network failure can be retried", async () => {
  let attempts = 0;
  const { click, cleanup } = await setup("/offers/16", async () => {
    if (++attempts === 1) throw new TypeError("offline");
    return Response.json(offer);
  });
  assert.match(document.querySelector('[role="alert"]')!.textContent!, /Vérifiez votre connexion/);
  await click("Réessayer");
  assert.equal(attempts, 2);
  assert.equal(document.querySelector("h1")!.textContent, offer.title);
  await cleanup();
});
