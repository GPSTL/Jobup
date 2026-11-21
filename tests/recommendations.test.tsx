import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import RecommendationSwitch from "../front/components/RecommendationSwitch";
import { filterRecommendations } from "../front/utils/recommendations";

test("recommendation switch restricts either deck and restores all cards when disabled", () => {
	const cards = [{ id: 3 }, { id: 1 }, { id: 2 }];
	const recommendations = [{ id: 2 }, { id: 3 }, { id: 3 }, { id: 99 }];
	assert.deepEqual(filterRecommendations(cards, recommendations, true), [cards[2], cards[0]]);
	assert.equal(filterRecommendations(cards, recommendations, false), cards);
	assert.deepEqual(filterRecommendations(cards, [], true), []);
	assert.equal(filterRecommendations(cards, null, true), cards);
	assert.equal(filterRecommendations(cards, null, false), cards);
});

test("recommendation control exposes an accessible switch with its current state", () => {
	const render = (checked: boolean) => renderToStaticMarkup(<RecommendationSwitch checked={checked} onChange={() => {}} />);
	assert.match(render(true), /role="switch"[^>]*checked/);
	assert.doesNotMatch(render(false), /checked=""/);
	assert.match(render(false), /Afficher uniquement les recommandations/);
});
