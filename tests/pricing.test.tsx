import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import PricingPage from "../front/pages/PricingPage";

test("page tarifs : affiche les offres étudiants (gratuit et premium 4,99 €/mois), entreprises (149 €/mois) et écoles (seuil 50 étudiants et 1 200 €/an)", () => {
	const html = renderToStaticMarkup(
		<MemoryRouter initialEntries={["/pricing"]}>
			<PricingPage />
		</MemoryRouter>,
	);

	assert.match(html, /Étudiants/);
	assert.match(html, /4,99 € \/ mois/);
	assert.match(html, /5 matchs par jour/);
	assert.match(html, /Matchs de CV illimités/);
	assert.match(html, /Mise en avant du profil auprès des recruteurs/);
	assert.match(html, /Liste des entreprises ayant consulté votre profil/);

	assert.match(html, /Entreprises/);
	assert.match(html, /149 € \/ mois/);
	assert.match(html, /Sans offre gratuite/);

	assert.match(html, /Écoles &amp; CFA/);
	assert.match(html, /1 200 € \/ an/);
	assert.match(html, /Gratuit jusqu’à 50 étudiants suivis/);
});
