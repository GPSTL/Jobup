import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";

import Button from "./Button";
import SchoolNavbar from "./SchoolNavbar";
import type { SchoolResult } from "../services/school";
import { focus } from "../utils/searchPageStyles";
import { REQUEST_ERRORS } from "../utils/validation";

export const schoolPanel = "flex flex-col gap-5 rounded-2xl border border-[#e5e7eb] bg-surface px-5 py-7 shadow-xs md:px-10 md:py-8";

export function SchoolLayout({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-dvh bg-[#f8fafc] px-4 pt-4 pb-16 text-ink md:px-6 md:pt-6">
			<header><SchoolNavbar /></header>
			<main className="mx-auto mt-8 flex max-w-[1236px] flex-col gap-6">{children}</main>
		</div>
	);
}

// Charge les données d'une page de l'école : `load` doit être stable (fonction du module ou useCallback).
// `setData` met à jour la page après une action, sans recharger.
export function useSchoolData<T>(load: () => Promise<SchoolResult<T>>) {
	const [result, setResult] = useState<SchoolResult<T> | null>(null);
	// Incrémenté par « Réessayer » pour relancer la requête
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		// Ignore une réponse arrivée après un changement de page
		let ignore = false;
		load().then((response) => {
			if (!ignore) setResult(response);
		});
		return () => {
			ignore = true;
		};
	}, [load, attempt]);

	const retry = () => {
		setResult(null);
		setAttempt(attempt + 1);
	};
	const setData = (data: T) => setResult({ ok: true, data });
	return { result, retry, setData };
}

// Chargement et erreurs communes aux pages de l'école ; rien tant que les données sont là
export function SchoolRequestState({ result, retry }: { result: SchoolResult<unknown> | null; retry: () => void }) {
	if (result === null) return <p role="status" className="text-sm text-[#6b7280]">Chargement…</p>;
	if (result.ok) return null;
	if (result.reason === "unauthenticated") return <Navigate to="/login" replace />;
	if (result.reason === "notFound") return <div role="alert"><h1 className="text-2xl font-bold">Page introuvable</h1><p className="mt-1 text-sm text-[#6b7280]">Cet élément n’existe pas ou vous n’y avez pas accès.</p></div>;
	// Compte école pas encore rattaché à un établissement
	if (result.reason === "conflict") return <p role="alert" className="text-sm">Indiquez d’abord votre établissement depuis le <Link to="/school" className={`font-semibold text-primary hover:underline ${focus}`}>tableau de bord</Link>.</p>;
	return <div role="alert" className="flex flex-col items-start gap-4"><p className="text-sm">{REQUEST_ERRORS[result.reason === "invalid" ? "server" : result.reason]}</p><Button onClick={retry}>Réessayer</Button></div>;
}

type FilterChipsProps<K extends string> = {
	label: string;
	filters: { key: K; label: string; count: number }[];
	selected: K;
	onSelect: (key: K) => void;
};

// Filtres en pastilles des listes de l'école, avec le nombre d'éléments de chacun
export function FilterChips<K extends string>({ label, filters, selected, onSelect }: FilterChipsProps<K>) {
	return (
		<div role="group" aria-label={label} className="flex flex-wrap gap-2">
			{filters.map((filter) => (
				<button key={filter.key} type="button" aria-pressed={filter.key === selected} onClick={() => onSelect(filter.key)} className={`cursor-pointer rounded-full border px-4 py-2 text-xs sm:text-sm ${filter.key === selected ? "border-primary bg-[#dbeafe] font-semibold text-primary" : "border-[#d1d5db] bg-surface hover:bg-[#f9fafb]"} ${focus}`}>
					{filter.label} ({filter.count})
				</button>
			))}
		</div>
	);
}
