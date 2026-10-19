import React, { useState } from "react";
import { Link } from "react-router-dom";

import Logo from "../components/Logo";
import Field from "../components/Field";
import { validateEmail, validatePassword } from "../utils/validation";

export default () => {
	const [email, setEmail] = useState<string>("");
	const [password, setPassword] = useState<string>("");
	const [errors, setErrors] = useState({ email: "", password: "" });

	// Not connected to the backend yet
	const onSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const next = { email: validateEmail(email), password: validatePassword(password) };
		setErrors(next);

		const firstInvalid = (Object.keys(next) as (keyof typeof next)[]).find((key) => next[key]);
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
			<div className="ju-card ju-card--login">
				<h1>Connexion</h1>
				<p className="ju-card-sub">
					Pas encore membre? <Link to="/signup">Créez un compte</Link>
				</p>
				<form className="ju-form" onSubmit={onSubmit} noValidate>
					<Field id="email" label="Adresse mail" error={errors.email}>
						<input
							type="email"
							autoComplete="email"
							value={email}
							onChange={(e) => {
								setEmail(e.target.value);
								if (errors.email) setErrors({ ...errors, email: validateEmail(e.target.value) });
							}}
						/>
					</Field>
					<Field id="password" label="Mot de passe" error={errors.password}>
						<input
							type="password"
							autoComplete="current-password"
							value={password}
							onChange={(e) => {
								setPassword(e.target.value);
								if (errors.password) setErrors({ ...errors, password: validatePassword(e.target.value) });
							}}
						/>
					</Field>
					<a href="#" className="ju-forgot">
						Mot de passe oublié ?
					</a>
					<button type="submit" className="ju-btn">
						Connexion
					</button>
				</form>
			</div>
		</div>
	);
};
