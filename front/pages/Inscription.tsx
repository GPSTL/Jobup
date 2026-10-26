import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import Logo from "../components/Logo";
import Field from "../components/Field";
import Button from "../components/Button";
import {
	validateEmail,
	validateNewPassword,
	validateNom,
	validatePrenom,
	validateTelephone,
} from "../utils/validation";

const EMPTY_FORM = {
	prenom: "",
	nom: "",
	email: "",
	telephone: "",
	password: "",
};

type Key = keyof typeof EMPTY_FORM;

const ROLES = [
	{ label: "Étudiant", value: "student" },
	{ label: "Entreprise", value: "recruiter" },
	{ label: "École", value: "school" },
] as const;

type Role = (typeof ROLES)[number]["value"];

const getRole = (value: string | null): Role =>
	ROLES.find((role) => role.value === value)?.value ?? "student";

// Données à envoyer à l'API d'inscription (JOB-003)
export const toSignupPayload = (form: typeof EMPTY_FORM, role: Role = "student") => ({
	prenom: form.prenom.trim(),
	nom: form.nom.trim(),
	email: form.email.trim(),
	telephone: form.telephone.replace(/[\s.-]/g, ""),
	password: form.password,
	role,
});

const VALIDATORS: Record<Key, (value: string) => string> = {
	prenom: validatePrenom,
	nom: validateNom,
	email: validateEmail,
	telephone: validateTelephone,
	password: validateNewPassword,
};

export default function Inscription() {
	const [searchParams, setSearchParams] = useSearchParams();
	const role = getRole(searchParams.get("role"));
	const selectRole = (value: Role) => {
		setSearchParams((previous) => {
			const next = new URLSearchParams(previous);
			next.set("role", value);
			return next;
		}, { replace: true });
	};
	const [form, setForm] = useState(EMPTY_FORM);
	const [errors, setErrors] = useState(EMPTY_FORM);

	// Once a field shows an error, it is re-checked on each change so the message disappears when fixed
	const update = (key: Key) => (e: ChangeEvent<HTMLInputElement>) => {
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

		const payload = toSignupPayload(form, role);
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
					{ROLES.map(({ label, value }) => (
						<label key={value} className="relative flex cursor-pointer items-center justify-center">
							<input
								type="radio"
								name="account-role"
								value={value}
								checked={role === value}
								onChange={() => selectRole(value)}
								className="peer sr-only"
							/>
							<span className="flex h-full w-full items-center justify-center rounded-[9px] text-[15px] font-medium text-[#6B7280] peer-checked:bg-primary peer-checked:font-semibold peer-checked:text-on-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
								{label}
							</span>
						</label>
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
