import { useState, type FormEvent } from "react";

import type { CandidateFilters, FilterOptions } from "../services/candidates";
import { activeFilters, matchCount, NO_FILTERS, type ActiveFilter } from "../utils/candidateFilters";
import { focus } from "../utils/searchPageStyles";

const label = "text-[14px] font-semibold text-[#111827]";
const control = [
	"w-full rounded-[12px] border border-[#d1d5db] bg-white py-[11px] pr-10 pl-[14px] text-[15px] outline-none",
	"focus:border-primary focus:ring-2 focus:ring-primary/25",
].join(" ");
// Icône à droite du champ, comme la maquette ; elle laisse passer les clics vers le champ
const fieldIcon = "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2";

type FilterSelectProps = {
	id: string;
	label: string;
	/** Choix « tous » en tête de liste, valeur "" */
	allLabel: string;
	value: string;
	choices: { value: string; label: string }[];
	onChange: (value: string) => void;
	disabled: boolean;
};

function FilterSelect({ id, label: text, allLabel, value, choices, onChange, disabled }: FilterSelectProps) {
	// Une valeur venue de l'URL mais absente des listes reste affichée : le formulaire montre toujours la recherche en cours
	const shown = value && !choices.some((choice) => choice.value === value) ? [...choices, { value, label: value }] : choices;
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className={label}>
				{text}
			</label>
			<div className="relative">
				<select
					id={id}
					value={value}
					disabled={disabled}
					onChange={(event) => onChange(event.target.value)}
					className={`${control} cursor-pointer appearance-none disabled:cursor-wait ${value ? "text-[#111827]" : "text-[#9ca3af]"}`}
				>
					<option value="" className="text-[#111827]">
						{allLabel}
					</option>
					{shown.map((choice) => (
						<option key={choice.value} value={choice.value} className="text-[#111827]">
							{choice.label}
						</option>
					))}
				</select>
				<img src="/static/img/candidates/chevron-down.svg" width={18} height={18} alt="" className={fieldIcon} />
			</div>
		</div>
	);
}

type CandidateFilterPanelProps = {
	/** Critères de la recherche affichée, ceux de l'URL */
	applied: CandidateFilters;
	/** Valeurs des listes ; null pendant leur chargement */
	options: FilterOptions | null;
	optionsError: string;
	onRetryOptions: () => void;
	onSearch: (filters: CandidateFilters) => void;
	/** Nombre de cartes trouvées ; null pendant la recherche ou après une erreur */
	count: number | null;
	className?: string;
};

// Panneau « Filtres » de la page Candidats (maquette « Filtres candidats », REC-02). À monter avec
// key={critères appliqués} : après une recherche, une pastille retirée ou un retour arrière, le formulaire repart de l'URL.
export default function CandidateFilterPanel({ applied, options, optionsError, onRetryOptions, onSearch, count, className = "" }: CandidateFilterPanelProps) {
	const [draft, setDraft] = useState(applied);
	const loading = options === null && !optionsError;
	const set = (key: keyof CandidateFilters) => (value: string) => setDraft({ ...draft, [key]: value });

	const submit = (event: FormEvent) => {
		event.preventDefault();
		onSearch(draft);
	};

	const reset = () => {
		setDraft(NO_FILTERS);
		onSearch(NO_FILTERS);
	};

	return (
		<form
			role="search"
			aria-labelledby="filters-title"
			onSubmit={submit}
			className={`flex flex-col gap-4 rounded-[22px] bg-white p-6 leading-[normal] text-[#111827] shadow-[0_4px_6px_rgba(0,0,0,0.1)] ${className}`}
		>
			<div className="flex items-center gap-2">
				<img src="/static/img/candidates/filter.svg" width={18} height={18} alt="" />
				<h2 id="filters-title" className="text-[20px] font-semibold">
					Filtres
				</h2>
				<button type="button" onClick={reset} className={`ml-auto cursor-pointer rounded-sm text-[14px] font-semibold text-primary hover:underline ${focus}`}>
					Réinitialiser
				</button>
			</div>

			{optionsError && (
				<div role="alert" className="flex flex-col items-start gap-2 rounded-[12px] bg-[#fef2f2] px-3 py-2.5 text-[13px] text-[#b91c1c]">
					<p>{optionsError}</p>
					<button type="button" onClick={onRetryOptions} className={`cursor-pointer rounded-sm font-semibold underline ${focus}`}>
						Réessayer
					</button>
				</div>
			)}

			<FilterSelect
				id="filter-position"
				label="Profil recherché"
				allLabel="Tous les profils"
				value={draft.position}
				choices={(options?.positions ?? []).map((position) => ({ value: position, label: position }))}
				onChange={set("position")}
				disabled={loading}
			/>
			<FilterSelect
				id="filter-experience"
				label="Expérience"
				allLabel="Toutes les expériences"
				value={draft.experience}
				choices={options?.experiences ?? []}
				onChange={set("experience")}
				disabled={loading}
			/>
			<FilterSelect
				id="filter-skill"
				label="Logiciels maîtrisés"
				allLabel="Tous les logiciels"
				value={draft.skill}
				choices={(options?.skills ?? []).map((skill) => ({ value: skill, label: skill }))}
				onChange={set("skill")}
				disabled={loading}
			/>
			<div className="flex flex-col gap-1.5">
				<label htmlFor="filter-region" className={label}>
					Région
				</label>
				<div className="relative">
					<input
						id="filter-region"
						type="text"
						value={draft.region}
						maxLength={64}
						autoComplete="off"
						placeholder="Ville ou « remote »"
						onChange={(event) => set("region")(event.target.value)}
						className={`${control} placeholder:text-[#9ca3af]`}
					/>
					<img src="/static/img/candidates/pin.svg" width={18} height={18} alt="" className={fieldIcon} />
				</div>
			</div>

			<button type="submit" className={`cursor-pointer rounded-[12px] bg-primary py-[13px] text-[15px] font-semibold text-on-primary hover:bg-primary/90 ${focus}`}>
				Rechercher les candidats
			</button>
			<p role="status" className={`min-h-4 text-[13px] font-medium ${count === 0 ? "text-[#dc2626]" : "text-[#6b7280]"}`}>
				{count === null ? "" : matchCount(count)}
			</p>
		</form>
	);
}

type NoMatchingCandidatesProps = {
	filters: CandidateFilters;
	options: FilterOptions | null;
	/** × d'une pastille : la recherche est relancée sans ce critère */
	onRemove: (key: ActiveFilter["key"]) => void;
	onReset: () => void;
};

// État « aucun résultat » (maquette « Candidats – aucun résultat »)
export function NoMatchingCandidates({ filters, options, onRemove, onReset }: NoMatchingCandidatesProps) {
	return (
		<div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-5 rounded-[25px] bg-white px-6 py-11 text-center leading-[normal] text-[#111827] shadow-[0_4px_12px_rgba(0,0,0,0.1)] sm:px-10">
			<span className="flex size-20 items-center justify-center rounded-full bg-[#dbeafe]">
				<img src="/static/img/candidates/users.svg" width={36} height={36} alt="" />
			</span>
			<h2 className="text-[24px] font-semibold">Aucun candidat ne correspond à vos critères</h2>
			<p className="text-[16px] text-[#6b7280]">Essayez d’élargir la région ou de retirer un logiciel.</p>
			<ul aria-label="Filtres actifs" className="flex flex-wrap justify-center gap-2">
				{activeFilters(filters, options).map((filter) => (
					<li key={filter.key}>
						<button
							type="button"
							onClick={() => onRemove(filter.key)}
							aria-label={`Retirer le filtre ${filter.label}`}
							className={`flex cursor-pointer items-center gap-1.5 rounded-full border border-[#d1d5db] bg-[#f9fafb] py-1.5 pr-2.5 pl-3 text-[14px] font-medium hover:bg-white ${focus}`}
						>
							{filter.label}
							<img src="/static/img/candidates/x.svg" width={14} height={14} alt="" />
						</button>
					</li>
				))}
			</ul>
			<button
				type="button"
				onClick={onReset}
				className={`cursor-pointer rounded-[14px] border border-[#d1d5db] bg-white px-[22px] py-3.5 text-[16px] font-semibold hover:bg-[#f9fafb] ${focus}`}
			>
				Réinitialiser les filtres
			</button>
		</div>
	);
}
