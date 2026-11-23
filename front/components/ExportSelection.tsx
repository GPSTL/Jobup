import { useEffect, useRef } from "react";

import { countLabel, MAX_SELECTION, toggleIds } from "../utils/selection";
import { focus } from "../utils/searchPageStyles";

/** Éléments cochés pour l'export CSV, et la mise à jour de la page */
export type Selection = { ids: number[]; onChange: (ids: number[]) => void };

const checkbox = "size-4 shrink-0 cursor-pointer accent-primary";

type SelectCheckboxProps = {
	id: number;
	selection: Selection;
	/** Nom accessible, ex. « Sélectionner Alice Martin pour l’export » */
	label: string;
	className?: string;
};

// Case d'un élément de la liste
export function SelectCheckbox({ id, selection, label, className = "" }: SelectCheckboxProps) {
	return (
		<input
			type="checkbox"
			checked={selection.ids.includes(id)}
			onChange={(event) => selection.onChange(toggleIds(selection.ids, [id], event.target.checked))}
			aria-label={label}
			className={`${checkbox} ${className}`}
		/>
	);
}

type SelectAllCheckboxProps = {
	/** Éléments affichés, ceux que la case coche ou décoche */
	ids: number[];
	selection: Selection;
	label: string;
};

// Coche ou décoche tous les éléments affichés ; à moitié cochée quand seuls certains le sont
export function SelectAllCheckbox({ ids, selection, label }: SelectAllCheckboxProps) {
	const ticked = ids.filter((id) => selection.ids.includes(id)).length;
	const ref = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (ref.current) ref.current.indeterminate = ticked > 0 && ticked < ids.length;
	}, [ticked, ids.length]);
	return (
		<input
			ref={ref}
			type="checkbox"
			checked={ids.length > 0 && ticked === ids.length}
			disabled={ids.length === 0}
			onChange={(event) => selection.onChange(toggleIds(selection.ids, ids, event.target.checked))}
			aria-label={label}
			className={checkbox}
		/>
	);
}

// « Sélection pour l’export : 3 candidatures · Tout désélectionner », rien sans sélection
export function SelectionSummary({ selection, noun }: { selection: Selection; noun: [string, string] }) {
	const count = selection.ids.length;
	if (count === 0) return null;
	return (
		<p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#6b7280]">
			<span>
				Sélection pour l’export : <strong className="text-ink">{countLabel(count, noun)}</strong>
				{count === MAX_SELECTION && ` (${MAX_SELECTION} au maximum)`}
			</span>
			<button type="button" onClick={() => selection.onChange([])} className={`cursor-pointer rounded-sm font-semibold text-primary hover:underline ${focus}`}>
				Tout désélectionner
			</button>
		</p>
	);
}
