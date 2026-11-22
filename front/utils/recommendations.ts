/** Show available matches in the order returned by the recommendation service. */
export function filterRecommendations<T extends { id: number }>(items: T[], recommended: { id: number }[] | null, onlyRecommended: boolean): T[] {
	if (!onlyRecommended || recommended === null) return items;
	const available = new Map(items.map((item) => [item.id, item]));
	const seen = new Set<number>();
	return (recommended ?? []).flatMap(({ id }) => {
		const item = available.get(id);
		if (!item || seen.has(id)) return [];
		seen.add(id);
		return [item];
	});
}
