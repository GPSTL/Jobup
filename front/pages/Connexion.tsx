import React, { useState } from "react";
import { Link } from "react-router-dom";

import Logo from "../components/Logo";
import Field from "../components/Field";
import Button from "../components/Button";
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
		<main className="flex min-h-screen flex-col items-center bg-[#F0F0F0] px-4 pt-[76px] pb-16 max-[600px]:pt-10">
			<Link to="/">
				<Logo className="text-[64px] max-[600px]:text-5xl" />
			</Link>
			<div className="mt-[34px] flex w-full max-w-[545px] flex-col items-center rounded-[25px] bg-surface px-4 pt-8 pb-[37px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
				<h1 className="text-[36px] leading-[33px] font-semibold">Connexion</h1>
				<p className="mt-[27px] text-base leading-[18px]">
					Pas encore membre?{" "}
					<Link to="/signup" className="font-medium text-primary hover:underline">
						Créez un compte
					</Link>
				</p>
				<form className="flex w-full max-w-[292px] flex-col" onSubmit={onSubmit} noValidate>
					<Field id="email" label="Adresse mail" error={errors.email} className="mt-7">
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
					<Field id="password" label="Mot de passe" error={errors.password} className="mt-[29px]">
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
					<a href="#" className="mt-[23px] self-center text-base leading-[18px] text-primary hover:underline">
						Mot de passe oublié ?
					</a>
					<Button type="submit" className="mt-2 w-[205px] self-center py-[10px]! leading-[18px]">
						Connexion
					</Button>
				</form>
			</div>
		</main>
	);
};
