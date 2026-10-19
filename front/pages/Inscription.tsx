import React, { useState } from "react";
import { Link } from "react-router-dom";

import Logo from "../components/Logo";
import Field from "../components/Field";
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

const VALIDATORS: Record<Key, (value: string) => string> = {
	prenom: validatePrenom,
	nom: validateNom,
	email: validateEmail,
	telephone: validateTelephone,
	password: validateNewPassword,
	etablissement: validateEtablissement,
	domaine: validateDomaine,
};

export default () => {
	const [form, setForm] = useState(EMPTY_FORM);
	const [errors, setErrors] = useState(EMPTY_FORM);

	// Once a field shows an error, it is re-checked on each change so the message disappears when fixed
	const update = (key: Key) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		const value = e.target.value;
		setForm({ ...form, [key]: value });
		if (errors[key]) setErrors({ ...errors, [key]: VALIDATORS[key](value) });
	};

	// Not connected to the backend yet
	const onSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const next = { ...EMPTY_FORM };
		(Object.keys(VALIDATORS) as Key[]).forEach((key) => (next[key] = VALIDATORS[key](form[key])));
		setErrors(next);

		const firstInvalid = (Object.keys(next) as Key[]).find((key) => next[key]);
		if (firstInvalid) {
			document.getElementById(firstInvalid)?.focus();
			return;
		}
	};

	return (
		<div className="ju-page ju-auth">
			<Link to="/">
				<Logo />
			</Link>
			<div className="ju-card ju-card--signup">
				<h1>Inscription</h1>
				<form className="ju-form" onSubmit={onSubmit} noValidate>
					<Field id="prenom" label="Prénom" error={errors.prenom}>
						<input autoComplete="given-name" value={form.prenom} onChange={update("prenom")} />
					</Field>
					<Field id="nom" label="Nom" error={errors.nom}>
						<input autoComplete="family-name" value={form.nom} onChange={update("nom")} />
					</Field>
					<Field id="email" label="Adresse mail" error={errors.email}>
						<input type="email" autoComplete="email" value={form.email} onChange={update("email")} />
					</Field>
					<Field id="telephone" label="Numéro de téléphone" error={errors.telephone}>
						<input type="tel" autoComplete="tel" value={form.telephone} onChange={update("telephone")} />
					</Field>
					<Field id="password" label="Mot de passe" error={errors.password}>
						<input type="password" autoComplete="new-password" value={form.password} onChange={update("password")} />
					</Field>
					<Field id="etablissement" label="Etablissement d’études" error={errors.etablissement}>
						<select value={form.etablissement} onChange={update("etablissement")}>
							<option value="" disabled></option>
							{ETABLISSEMENTS.map((e) => (
								<option key={e}>{e}</option>
							))}
						</select>
					</Field>
					<Field id="domaine" label="Domaine recherché" error={errors.domaine}>
						<select value={form.domaine} onChange={update("domaine")}>
							<option value="" disabled></option>
							{DOMAINES.map((d) => (
								<option key={d}>{d}</option>
							))}
						</select>
					</Field>
					<button type="submit" className="ju-btn">
						S’inscrire
					</button>
				</form>
				<p className="ju-card-sub ju-card-sub--bottom">
					Déjà membre? <Link to="/login">Connectez-vous</Link>
				</p>
			</div>
		</div>
	);
};
