import { useEffect, useMemo, useRef, useState } from "react";

import Button from "./Button";
import { getCvSuggestions, type SuggestionsResult } from "../services/cv";
import type { Profile, ProfileChanges, ProfileResult } from "../services/profile";
import { chosenChanges, suggestionChoices, type SuggestionChoice } from "../utils/profileDetails";
import { MESSAGES, REQUEST_ERRORS } from "../utils/validation";

type ViewProps = {
	/** null pendant la lecture du CV */
	result: SuggestionsResult | null;
	choices: SuggestionChoice[];
	checked: Set<SuggestionChoice["key"]>;
	onToggle: (key: SuggestionChoice["key"]) => void;
	onApply: () => void;
	onClose: () => void;
	onRetry: () => void;
	applying: boolean;
	error: string;
	/** Message une fois les suggestions appliquées */
	applied: string;
};

// Contenu du panneau : lecture, CV illisible, rien de nouveau, ou les valeurs à cocher
export function CvSuggestionsView({ result, choices, checked, onToggle, onApply, onClose, onRetry, applying, error, applied }: ViewProps) {
	if (applied) {
		return (
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p role="status" className="font-medium text-[#15803d]">
					{applied}
				</p>
				<Button variant="outline" onClick={onClose}>
					Fermer
				</Button>
			</div>
		);
	}
	if (result === null) {
		return (
			<p role="status" className="text-[#6c7386]">
				Lecture de votre CV…
			</p>
		);
	}
	if (!result.ok) {
		return (
			<div role="alert" className="flex flex-wrap items-center gap-3">
				<p>{result.reason === "noCv" ? "Importez d’abord un CV pour pré-remplir votre profil." : REQUEST_ERRORS[result.reason]}</p>
				{result.reason !== "noCv" && (
					<Button variant="outline" onClick={onRetry}>
						Réessayer
					</Button>
				)}
			</div>
		);
	}
	if (!result.readable || choices.length === 0) {
		return (
			<div className="flex flex-col items-start gap-3">
				<p>
					{!result.readable
						? "Le texte de ce CV ne peut pas être lu (ancien format .doc, ou PDF scanné) : remplissez votre profil vous-même ci-dessous."
						: "Votre profil contient déjà ce que nous avons trouvé dans votre CV."}
				</p>
				<Button variant="outline" onClick={onClose}>
					Fermer
				</Button>
			</div>
		);
	}
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				onApply();
			}}
			className="flex flex-col gap-4"
		>
			<p className="text-sm text-[#6c7386]">Cochez ce que vous gardez : rien n’est modifié sans votre accord.</p>
			<ul className="flex flex-col gap-3">
				{choices.map((choice) => (
					<li key={choice.key}>
						<label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-3">
							<input type="checkbox" checked={checked.has(choice.key)} onChange={() => onToggle(choice.key)} disabled={applying} className="mt-1 size-4 shrink-0 cursor-pointer accent-primary" />
							<span className="flex min-w-0 flex-col gap-0.5">
								<span className="text-sm font-semibold">{choice.label}</span>
								<span className="break-words">{choice.value}</span>
								{choice.key !== "skills" && <span className="text-sm text-[#6c7386]">{choice.current ? `Actuellement : ${choice.current}` : "Non renseigné pour l’instant"}</span>}
							</span>
						</label>
					</li>
				))}
			</ul>
			{error && (
				<p role="alert" className="text-sm font-medium text-[#DC2626]">
					{error}
				</p>
			)}
			<div className="flex flex-wrap justify-end gap-2">
				<Button variant="outline" onClick={onClose}>
					Ignorer
				</Button>
				<Button type="submit" disabled={applying || checked.size === 0}>
					{applying ? "Enregistrement…" : "Appliquer à mon profil"}
				</Button>
			</div>
		</form>
	);
}

type PanelProps = {
	userId: number;
	profile: Profile;
	onSave: (changes: ProfileChanges) => Promise<ProfileResult>;
	onSaved: (profile: Profile) => void;
	onClose: () => void;
};

// « Pré-remplir mon profil » (JOB-071) : les valeurs trouvées dans le CV, proposées à l'étudiant
export default function CvSuggestionsPanel({ userId, profile, onSave, onSaved, onClose }: PanelProps) {
	const [result, setResult] = useState<SuggestionsResult | null>(null);
	const [attempt, setAttempt] = useState(0);
	// Cases changées par l'étudiant ; null tant qu'il n'y a pas touché : celles cochées d'avance
	const [picked, setPicked] = useState<Set<SuggestionChoice["key"]> | null>(null);
	const [applying, setApplying] = useState(false);
	const [error, setError] = useState("");
	const [applied, setApplied] = useState("");
	const heading = useRef<HTMLHeadingElement>(null);

	const choices = useMemo(() => (result?.ok ? suggestionChoices(result.suggestions, profile) : []), [result, profile]);
	const checked = picked ?? new Set(choices.filter((choice) => choice.checked).map((choice) => choice.key));

	useEffect(() => {
		let ignore = false;
		getCvSuggestions(userId).then((found) => {
			if (!ignore) setResult(found);
		});
		return () => {
			ignore = true;
		};
	}, [userId, attempt]);

	// Ouvert après un import, souvent plus bas dans la page : il est mis en vue et annoncé
	useEffect(() => {
		heading.current?.scrollIntoView?.({ block: "nearest" });
		heading.current?.focus();
	}, []);

	const toggle = (key: SuggestionChoice["key"]) => {
		const next = new Set(checked);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		setPicked(next);
	};

	const apply = async () => {
		if (applying || checked.size === 0) return;
		setApplying(true);
		setError("");
		const saved = await onSave(chosenChanges(choices, checked));
		setApplying(false);
		if (saved.ok) {
			onSaved(saved.profile);
			setApplied("Votre profil est complété avec les informations de votre CV.");
		} else if (saved.reason === "invalid") setError(Object.values(saved.fields)[0] ?? MESSAGES.serverError);
		else setError(REQUEST_ERRORS[saved.reason]);
	};

	return (
		<section aria-labelledby="cv-suggestions-title" className="flex flex-col gap-3 rounded-2xl border-2 border-primary/40 bg-surface p-5 shadow-xs sm:p-6">
			<h2 id="cv-suggestions-title" ref={heading} tabIndex={-1} className="text-lg font-bold text-ink outline-none">
				Pré-remplir mon profil depuis le CV
			</h2>
			<CvSuggestionsView
				result={result}
				choices={choices}
				checked={checked}
				onToggle={toggle}
				onApply={apply}
				onClose={onClose}
				onRetry={() => {
					setResult(null);
					setPicked(null);
					setAttempt(attempt + 1);
				}}
				applying={applying}
				error={error}
				applied={applied}
			/>
		</section>
	);
}
