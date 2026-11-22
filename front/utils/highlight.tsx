import type { ReactNode } from "react";

function normalizeChar(char: string): string {
	return char.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
}

function normalizeText(text: string): { normalized: string; map: number[] } {
	let normalized = "";
	const map: number[] = [];
	for (let index = 0; index < text.length; index++) {
		const cleaned = normalizeChar(text[index]);
		for (let c = 0; c < cleaned.length; c++) {
			normalized += cleaned[c];
			map.push(index);
		}
	}
	return { normalized, map };
}

/**
 * Highlights occurrences of one or more search terms in `text` (case- and accent-insensitive).
 * When no term matches or `query` is empty, returns `text` as a plain string.
 */
export function highlightText(text: string, query: string | string[] | undefined | null): ReactNode {
	if (!text || !query) return text;
	const rawTerms = (Array.isArray(query) ? query : [query])
		.flatMap((item) => [item.trim(), ...item.trim().split(/\s+/)])
		.map((item) => normalizeText(item).normalized)
		.filter((item) => item.length > 0);
	const terms = Array.from(new Set(rawTerms)).sort((a, b) => b.length - a.length);
	if (terms.length === 0) return text;

	const { normalized, map } = normalizeText(text);
	if (!normalized) return text;

	const intervals: [number, number][] = [];
	for (const term of terms) {
		let start = 0;
		while (start < normalized.length) {
			const found = normalized.indexOf(term, start);
			if (found === -1) break;
			const origStart = map[found];
			const origEnd = map[found + term.length - 1] + 1;
			intervals.push([origStart, origEnd]);
			start = found + term.length;
		}
	}
	if (intervals.length === 0) return text;

	intervals.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
	const merged: [number, number][] = [intervals[0]];
	for (let i = 1; i < intervals.length; i++) {
		const prev = merged[merged.length - 1];
		const curr = intervals[i];
		if (curr[0] <= prev[1]) {
			prev[1] = Math.max(prev[1], curr[1]);
		} else {
			merged.push(curr);
		}
	}

	const nodes: ReactNode[] = [];
	let cursor = 0;
	for (const [start, end] of merged) {
		if (start > cursor) nodes.push(text.slice(cursor, start));
		nodes.push(
			<mark key={start} className="search-highlight rounded-xs bg-[#fef08a] px-0.5 text-[#0f172a]">
				{text.slice(start, end)}
			</mark>,
		);
		cursor = end;
	}
	if (cursor < text.length) nodes.push(text.slice(cursor));
	return nodes;
}
