import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import PricingPage from "../front/pages/PricingPage";

const render = () =>
	renderToStaticMarkup(
		<MemoryRouter>
			<PricingPage />
		</MemoryRouter>,
	);

test("tarifs : les prix de la maquette « Forfaits », TTC", () => {
	const html = render();
	// Une carte par profil : son nom, puis son prix
	assert.match(html, /<h2[^>]*>Étudiants<\/h2>.*?>Gratuit</);
	assert.match(html, /<h2[^>]*>Recruteurs<\/h2>.*?>49 €\/mois<\/p><p[^>]*>TTC, sans engagement, résiliable à tout moment</);
	assert.match(html, /<h2[^>]*>Écoles &amp; CFA<\/h2>.*?>8,33 €\/mois<\/p><p[^>]*>Facturé 100 € TTC par an/);
	// Plus de tarif ni de fonctionnalité « à venir »
	assert.doesNotMatch(html, /à venir|Prochainement|prévue?\b|en préparation/i);
});

test("tarifs : aucun paiement en ligne promis, et la question des prix a sa réponse", () => {
	const html = render();
	assert.match(html, /Le paiement en ligne n’est pas encore ouvert : créer un compte ne déclenche aucun prélèvement\./);
	assert.match(html, /<summary[^>]*>Combien coûtent les offres recruteur et école \?<\/summary><p[^>]*>49 € TTC par mois pour un recruteur/);
	assert.match(html, /<summary[^>]*>L’espace école est-il déjà disponible \?<\/summary><p[^>]*>Oui\./);
});
