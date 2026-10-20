import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";

import Logo from "../components/Logo";
import Field from "../components/Field";
import Button from "../components/Button";
import {
	validateDomaine,
	validateEmail,
	validateEtablissement,
	validateNewPassword,
	validateNom,
	validatePrenom,
	validateTelephone,
} from "../utils/validation";

// Placeholder options until they come from the backend
const ETABLISSEMENTS = ["Sorbonne Université", "Université Paris Cité", "Université Paris-Saclay", "Autre"];
const DOMAINES = ["Informatique", "Commerce / Marketing", "Finance / Comptabilité", "Ressources humaines", "Communication", "Ingénierie", "Autre"];

const EMPTY_FORM = {
	prenom: "",
	nom: "",
	email: "",
	telephone: "",
	password: "",
	etablissement: "",
	domaine: "",
};

type Key = keyof typeof EMPTY_FORM;

// Formulaire réservé aux étudiants : le rôle est toujours envoyé avec les données (même valeur que Role.STUDENT côté backend)
const ROLE = "student";

// Données à envoyer à l'API d'inscription (JOB-003)
export const toSignupPayload = (form: typeof EMPTY_FORM) => ({
	prenom: form.prenom.trim(),
	nom: form.nom.trim(),
	email: form.email.trim(),
	telephone: form.telephone.replace(/[\s.-]/g, ""),
	password: form.password,
	etablissement: form.etablissement,
	domaine: form.domaine,
	role: ROLE,
});

const VALIDATORS: Record<Key, (value: string) => string> = {
	prenom: validatePrenom,
	nom: validateNom,
	email: validateEmail,
	telephone: validateTelephone,
	password: validateNewPassword,
	etablissement: validateEtablissement,
	domaine: validateDomaine,
};

// Flèche native masquée, remplacée par le chevron de la maquette
const SELECT_CLASSES =
	"cursor-pointer appearance-none pr-9 bg-[url(/static/img/chevron.svg)] bg-no-repeat bg-[length:24px_24px] bg-[position:right_5px_center]";

// Types de compte de la maquette : seule l'inscription étudiant fait partie de JOB-005
const ROLES = [
	{ label: "Étudiant", active: true },
	{ label: "Entreprise", active: false },
	{ label: "École", active: false },
];

export default function Inscription() {
	const [form, setForm] = useState(EMPTY_FORM);
	const [errors, setErrors] = useState(EMPTY_FORM);

	// Once a field shows an error, it is re-checked on each change so the message disappears when fixed
	const update = (key: Key) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		const value = e.target.value;
		setForm({ ...form, [key]: value });
		if (errors[key]) setErrors({ ...errors, [key]: VALIDATORS[key](value) });
	};

	// Not connected to the backend yet
	const onSubmit = (e: FormEvent) => {
		e.preventDefault();

		const next = { ...EMPTY_FORM };
		(Object.keys(VALIDATORS) as Key[]).forEach((key) => (next[key] = VALIDATORS[key](form[key])));
		setErrors(next);

		const firstInvalid = (Object.keys(next) as Key[]).find((key) => next[key]);
		if (firstInvalid) {
			document.getElementById(firstInvalid)?.focus();
			return;
		}

		const payload = toSignupPayload(form);
		// TODO : envoyer payload à l'API d'inscription quand JOB-003 existera
		void payload;
	};

	return (
		<main className="flex min-h-screen flex-col items-center bg-[#F0F0F0] px-4 pt-10 pb-16 sm:pt-19">
			<Logo className="h-12 sm:h-16" />
			<div className="mt-8.5 flex w-full max-w-[545px] flex-col items-center rounded-[25px] bg-surface px-4 pt-8 pb-10 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
				<h1 className="text-4xl leading-[33px] font-semibold">Inscription</h1>
				<div
					role="radiogroup"
					aria-label="Type de compte"
					className="mt-[17px] grid h-[42px] w-full max-w-[317px] grid-cols-3 gap-1 rounded-[11.5px] border border-[#E5E7EB] bg-[#F9FAFB] p-[3px]"
				>
					{ROLES.map(({ label, active }) => (
						<button
							key={label}
							type="button"
							role="radio"
							aria-checked={active}
							// Entreprise et École : visibles comme sur la maquette, mais pas encore disponibles
							aria-disabled={!active}
							title={active ? undefined : "Bientôt disponible"}
							className={
								active
									? "rounded-[9px] bg-primary text-[15px] font-semibold text-on-primary"
									: "cursor-not-allowed rounded-[9px] text-[15px] font-medium text-[#6B7280]"
							}
						>
							{label}
						</button>
					))}
				</div>
				<form className="flex w-full max-w-73 flex-col [&_label]:text-sm [&_label]:leading-4.5" onSubmit={onSubmit} noValidate>
					<Field id="prenom" label="Prénom" error={errors.prenom} className="mt-[45px]">
						<input autoComplete="given-name" value={form.prenom} onChange={update("prenom")} />
					</Field>
					<Field id="nom" label="Nom" error={errors.nom} className="mt-[29px]">
						<input autoComplete="family-name" value={form.nom} onChange={update("nom")} />
					</Field>
					<Field id="email" label="Adresse mail" error={errors.email} className="mt-[29px]">
						<input type="email" autoComplete="email" value={form.email} onChange={update("email")} />
					</Field>
					<Field id="telephone" label="Numéro de téléphone" error={errors.telephone} className="mt-[29px]">
						<input type="tel" autoComplete="tel" value={form.telephone} onChange={update("telephone")} />
					</Field>
					<Field id="password" label="Mot de passe" error={errors.password} className="mt-[29px]">
						<input type="password" autoComplete="new-password" value={form.password} onChange={update("password")} />
					</Field>
					<Field id="etablissement" label="Établissement d’études" error={errors.etablissement} className="mt-[29px]">
						<select className={SELECT_CLASSES} value={form.etablissement} onChange={update("etablissement")}>
							<option value="" disabled></option>
							{ETABLISSEMENTS.map((e) => (
								<option key={e}>{e}</option>
							))}
						</select>
					</Field>
					<Field id="domaine" label="Domaine recherché" error={errors.domaine} className="mt-[29px]">
						<select className={SELECT_CLASSES} value={form.domaine} onChange={update("domaine")}>
							<option value="" disabled></option>
							{DOMAINES.map((d) => (
								<option key={d}>{d}</option>
							))}
						</select>
					</Field>
					<Button type="submit" className="mt-11.5 w-[205px] self-center py-2.5! leading-3.75">
						S’inscrire
					</Button>
				</form>
				<Link to="/login" className="mt-4 text-sm leading-4.5 font-medium text-primary hover:underline">
					Déjà inscrit&nbsp;? Se connecter
				</Link>
			</div>
		</main>
	);
}
