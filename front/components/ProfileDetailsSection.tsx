import { useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";

import Button from "./Button";
import SectionCard from "./SectionCard";
import type { Profile, ProfileChanges, ProfileResult } from "../services/profile";
import {
	addSkill,
	CATEGORY_OPTIONS,
	categoryLabel,
	dayLabel,
	experienceLabel,
	PROFILE_LIMITS,
	REGION_SUGGESTIONS,
	STUDY_DEGREE_OPTIONS,
} from "../utils/profileDetails";
import { degreeLabel } from "../utils/candidates";
import { MESSAGES, REQUEST_ERRORS } from "../utils/validation";

type Field = keyof ProfileChanges;
type Errors = Partial<Record<keyof Profile, string>>;

const box = "w-full rounded-[10px] border-[1.5px] bg-surface px-3 py-2 text-ink outline-none transition-colors duration-150";
const label = "text-sm font-semibold text-ink";
const hint = "text-sm text-[#6c7386]";

// Résumé du profil, ce que voient les recruteurs (JOB-071)
export function ProfileDetailsSummary({ profile }: { profile: Profile }) {
	const empty = <span className="text-[#6c7386]">Non renseigné</span>;
	const rows: [string, ReactNode][] = [
		["Formation", profile.education || empty],
		["Niveau d’études", profile.studyDegree === null ? empty : degreeLabel(profile.studyDegree)],
		["Domaine", categoryLabel(profile.category) || empty],
		["Expérience", experienceLabel(profile.experienceLevel)],
		["Région", profile.region || empty],
		["Disponibilité", profile.availableFrom ? `À partir du ${dayLabel(profile.availableFrom)}` : empty],
	];
	return (
		<div className="flex flex-col gap-4">
			<dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
				{rows.map(([term, value]) => (
					<div key={term} className="flex min-w-0 flex-col gap-0.5">
						<dt className={hint}>{term}</dt>
						<dd className="break-words">{value}</dd>
					</div>
				))}
			</dl>
			<div className="flex flex-col gap-1.5">
				<p className={hint}>Compétences</p>
				{profile.skills.length > 0 ? (
					<ul className="flex flex-wrap gap-2">
						{profile.skills.map((skill) => (
							<li key={skill} className="rounded-full bg-[#dbeafe] px-3 py-1 text-sm font-medium text-[#1d4ed8]">
								{skill}
							</li>
						))}
					</ul>
				) : (
					<p className="text-[#6c7386]">Aucune compétence indiquée.</p>
				)}
			</div>
			<p className={hint}>Visibles sur votre profil : les recruteurs filtrent les candidats sur ces informations.</p>
		</div>
	);
}

type FormProps = {
	profile: Profile;
	/** Enregistre les champs modifiés */
	onSave: (changes: ProfileChanges) => Promise<ProfileResult>;
	onDone: (profile?: Profile) => void;
};

// Les champs qui ont changé, seuls envoyés à l'API
function changedFields(profile: Profile, draft: Required<ProfileChanges>): ProfileChanges {
	const changes: ProfileChanges = {};
	for (const field of Object.keys(draft) as Field[]) {
		const before = profile[field];
		const after = draft[field];
		if (JSON.stringify(before) !== JSON.stringify(after)) Object.assign(changes, { [field]: after });
	}
	return changes;
}

// Formulaire de « Informations du profil » : toutes les valeurs, enregistrées ensemble
export function ProfileDetailsForm({ profile, onSave, onDone }: FormProps) {
	const id = useId();
	const [draft, setDraft] = useState<Required<ProfileChanges>>({
		description: profile.description,
		desiredPosition: profile.desiredPosition,
		education: profile.education,
		studyDegree: profile.studyDegree,
		category: profile.category,
		experienceLevel: profile.experienceLevel,
		skills: profile.skills,
		region: profile.region,
		availableFrom: profile.availableFrom,
	});
	const [skill, setSkill] = useState("");
	const [skillError, setSkillError] = useState("");
	const [errors, setErrors] = useState<Errors>({});
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const savingRef = useRef(false);

	const set = <K extends Field>(field: K, value: Required<ProfileChanges>[K]) => {
		setDraft((current) => ({ ...current, [field]: value }));
		setErrors((current) => ({ ...current, [field]: undefined }));
	};

	const add = () => {
		const result = addSkill(draft.skills, skill);
		setSkillError(result.error);
		if (!result.error) {
			set("skills", result.skills);
			setSkill("");
		}
	};

	// Entrée dans le champ ajoute la compétence, sans envoyer le formulaire
	const onSkillKey = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.preventDefault();
			add();
		}
	};

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (savingRef.current) return;
		const experience = draft.experienceLevel;
		if (!Number.isInteger(experience) || experience < 0 || experience > PROFILE_LIMITS.experience) {
			setErrors({ experienceLevel: `L’expérience est un nombre de mois, de 0 à ${PROFILE_LIMITS.experience}.` });
			document.getElementById(`${id}-experienceLevel`)?.focus();
			return;
		}
		const changes = changedFields(profile, { ...draft, education: draft.education.trim(), region: draft.region.trim() });
		if (Object.keys(changes).length === 0) return onDone();
		savingRef.current = true;
		setSaving(true);
		setError("");
		const result = await onSave(changes);
		savingRef.current = false;
		setSaving(false);
		if (result.ok) return onDone(result.profile);
		// La saisie est gardée, pour corriger ou réessayer
		if (result.reason === "invalid") {
			setErrors(result.fields);
			const first = Object.keys(result.fields)[0];
			if (first) document.getElementById(`${id}-${first}`)?.focus();
			if (Object.keys(result.fields).length === 0) setError(MESSAGES.serverError);
		} else setError(REQUEST_ERRORS[result.reason]);
	};

	const errorOf = (field: keyof Profile) =>
		errors[field] && (
			<p id={`${id}-${field}-error`} role="alert" className="text-sm font-medium text-[#DC2626]">
				{errors[field]}
			</p>
		);
	const fieldProps = (field: keyof Profile) => ({
		id: `${id}-${field}`,
		"aria-invalid": Boolean(errors[field]),
		"aria-describedby": errors[field] ? `${id}-${field}-error` : undefined,
		className: `${box} ${errors[field] ? "border-[#DC2626]" : "border-[#D1D5DB] focus:border-primary"}`,
		readOnly: saving,
	});

	return (
		<form
			noValidate
			onSubmit={submit}
			onKeyDown={(event) => {
				if (event.key === "Escape" && !savingRef.current) onDone();
			}}
			className="flex flex-col gap-4"
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="flex flex-col gap-1.5 sm:col-span-2">
					<label htmlFor={`${id}-education`} className={label}>
						Formation
					</label>
					<input type="text" value={draft.education} onChange={(e) => set("education", e.target.value)} maxLength={PROFILE_LIMITS.education} placeholder="Ex. : Master MIAGE" autoFocus {...fieldProps("education")} />
					{errorOf("education")}
				</div>
				<div className="flex flex-col gap-1.5">
					<label htmlFor={`${id}-studyDegree`} className={label}>
						Niveau d’études
					</label>
					<select value={draft.studyDegree ?? ""} onChange={(e) => set("studyDegree", e.target.value === "" ? null : Number(e.target.value))} disabled={saving} {...fieldProps("studyDegree")}>
						<option value="">Non renseigné</option>
						{STUDY_DEGREE_OPTIONS.map(({ value, label: text }) => (
							<option key={value} value={value}>
								{text}
							</option>
						))}
					</select>
					{errorOf("studyDegree")}
				</div>
				<div className="flex flex-col gap-1.5">
					<label htmlFor={`${id}-category`} className={label}>
						Domaine
					</label>
					<select value={draft.category ?? ""} onChange={(e) => set("category", e.target.value === "" ? null : Number(e.target.value))} disabled={saving} {...fieldProps("category")}>
						<option value="">Non renseigné</option>
						{CATEGORY_OPTIONS.map(({ value, label: text }) => (
							<option key={value} value={value}>
								{text}
							</option>
						))}
					</select>
					{errorOf("category")}
				</div>
				<div className="flex flex-col gap-1.5">
					<label htmlFor={`${id}-experienceLevel`} className={label}>
						Expérience professionnelle (en mois)
					</label>
					<input
						type="number"
						inputMode="numeric"
						min={0}
						max={PROFILE_LIMITS.experience}
						value={Number.isNaN(draft.experienceLevel) ? "" : draft.experienceLevel}
						onChange={(e) => set("experienceLevel", e.target.value === "" ? 0 : e.target.valueAsNumber)}
						{...fieldProps("experienceLevel")}
					/>
					<p className={hint}>Stages et alternances compris : {experienceLabel(Number.isNaN(draft.experienceLevel) ? 0 : draft.experienceLevel).toLowerCase()}</p>
					{errorOf("experienceLevel")}
				</div>
				<div className="flex flex-col gap-1.5">
					<label htmlFor={`${id}-availableFrom`} className={label}>
						Disponible à partir du
					</label>
					<input type="date" value={draft.availableFrom ?? ""} onChange={(e) => set("availableFrom", e.target.value || null)} {...fieldProps("availableFrom")} />
					{errorOf("availableFrom")}
				</div>
				<div className="flex flex-col gap-1.5 sm:col-span-2">
					<label htmlFor={`${id}-region`} className={label}>
						Région recherchée
					</label>
					<input type="text" list={`${id}-regions`} value={draft.region} onChange={(e) => set("region", e.target.value)} maxLength={PROFILE_LIMITS.region} placeholder="Ex. : Île-de-France, Lyon, Télétravail" {...fieldProps("region")} />
					<datalist id={`${id}-regions`}>
						{REGION_SUGGESTIONS.map((region) => (
							<option key={region} value={region} />
						))}
					</datalist>
					{errorOf("region")}
				</div>
			</div>

			<fieldset className="flex flex-col gap-2">
				<legend className={label}>Compétences</legend>
				{draft.skills.length > 0 && (
					<ul className="flex flex-wrap gap-2">
						{draft.skills.map((known) => (
							<li key={known} className="flex items-center gap-1 rounded-full bg-[#dbeafe] py-1 pr-1 pl-3 text-sm font-medium text-[#1d4ed8]">
								{known}
								<button
									type="button"
									disabled={saving}
									onClick={() => set("skills", draft.skills.filter((item) => item !== known))}
									aria-label={`Retirer ${known}`}
									className="flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-[#bfdbfe] focus-visible:outline-2 focus-visible:outline-primary"
								>
									<span aria-hidden="true">×</span>
								</button>
							</li>
						))}
					</ul>
				)}
				<div className="flex gap-2">
					<input
						type="text"
						value={skill}
						onChange={(e) => {
							setSkill(e.target.value);
							setSkillError("");
						}}
						onKeyDown={onSkillKey}
						maxLength={PROFILE_LIMITS.skill}
						placeholder="Ex. : Python"
						aria-label="Nouvelle compétence"
						{...fieldProps("skills")}
						aria-describedby={errors.skills ? `${id}-skills-hint ${id}-skills-error` : `${id}-skills-hint`}
					/>
					<Button variant="outline" onClick={add} disabled={saving}>
						Ajouter
					</Button>
				</div>
				<p id={`${id}-skills-hint`} className={hint}>
					{draft.skills.length}/{PROFILE_LIMITS.skills} compétences : logiciels, langages, outils.
				</p>
				{skillError && (
					<p role="alert" className="text-sm font-medium text-[#DC2626]">
						{skillError}
					</p>
				)}
				{errorOf("skills")}
			</fieldset>

			{error && (
				<p role="alert" className="text-sm font-medium text-[#DC2626]">
					{error}
				</p>
			)}
			<div className="flex justify-end gap-2">
				<Button variant="outline" onClick={() => !savingRef.current && onDone()}>
					Annuler
				</Button>
				<Button type="submit" className={saving ? "cursor-wait opacity-70" : ""}>
					{saving ? "Enregistrement…" : "Enregistrer"}
				</Button>
			</div>
		</form>
	);
}

type SectionProps = {
	profile: Profile;
	onSave: (changes: ProfileChanges) => Promise<ProfileResult>;
	/** Profil enregistré, à garder dans la page */
	onSaved: (profile: Profile) => void;
};

// Carte « Informations du profil » de « Mon espace » (JOB-071)
export default function ProfileDetailsSection({ profile, onSave, onSaved }: SectionProps) {
	const [editing, setEditing] = useState(false);
	const [saved, setSaved] = useState(false);
	const editButton = useRef<HTMLButtonElement>(null);

	// Le focus revient sur « Modifier » : les utilisateurs du clavier restent sur ce bloc
	const done = (updated?: Profile) => {
		if (updated) onSaved(updated);
		setSaved(Boolean(updated));
		flushSync(() => setEditing(false));
		editButton.current?.focus();
	};

	return (
		<SectionCard
			title="Informations du profil"
			action={
				!editing && (
					<Button
						ref={editButton}
						variant="secondary"
						onClick={() => {
							setSaved(false);
							setEditing(true);
						}}
					>
						Modifier<span className="sr-only"> les informations du profil</span>
					</Button>
				)
			}
		>
			{editing ? <ProfileDetailsForm profile={profile} onSave={onSave} onDone={done} /> : <ProfileDetailsSummary profile={profile} />}
			<p role="status" className="text-sm font-medium text-[#15803d] [&:not(:empty)]:mt-2">
				{saved ? "Modifications enregistrées." : ""}
			</p>
		</SectionCard>
	);
}
