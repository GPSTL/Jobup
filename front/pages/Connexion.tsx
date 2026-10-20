import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import Logo from "../components/Logo";
import Field from "../components/Field";
import Button from "../components/Button";
import { login } from "../services/auth";
import { MESSAGES, validateEmail, validatePassword } from "../utils/validation";

const FORM_ERRORS = {
	invalidCredentials: MESSAGES.invalidCredentials,
	server: MESSAGES.serverError,
	network: MESSAGES.networkError,
};

export default function Connexion() {
	const [email, setEmail] = useState<string>("");
	const [password, setPassword] = useState<string>("");
	const [errors, setErrors] = useState({ email: "", password: "" });
	// Error returned by the API, shown under the fields
	const [formError, setFormError] = useState<string>("");
	const [submitting, setSubmitting] = useState<boolean>(false);
	// Updated immediately, unlike the state, so fast double clicks are blocked too
	const submittingRef = useRef<boolean>(false);

	const onSubmit = async (e: FormEvent) => {
		e.preventDefault();
		// Avoids sending the form twice while waiting for the answer
		if (submittingRef.current) return;

		const next = { email: validateEmail(email), password: validatePassword(password) };
		setErrors(next);
		setFormError("");

		const firstInvalid = (Object.keys(next) as (keyof typeof next)[]).find((key) => next[key]);
		if (firstInvalid) {
			document.getElementById(firstInvalid)?.focus();
			return;
		}

		submittingRef.current = true;
		setSubmitting(true);
		const result = await login(email.trim(), password);
		submittingRef.current = false;
		setSubmitting(false);

		if (!result.ok) {
			// The fields are kept so the user can fix them
			setFormError(FORM_ERRORS[result.reason]);
			return;
		}

		// TODO: redirect to the student space once its route is confirmed (JOB-006)
	};

	return (
		<main className="flex min-h-screen flex-col items-center bg-[#F0F0F0] px-4 pt-10 pb-16 sm:pt-19">
			<Logo className="h-12 sm:h-16" />
			<div className="mt-8.5 flex w-full max-w-[545px] flex-col items-center rounded-[25px] bg-surface px-4 pt-8 pb-[37px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
				<h1 className="text-4xl leading-[33px] font-semibold">Connexion</h1>
				<p className="mt-[27px] text-base leading-4.5">
					Pas encore membre?{" "}
					<Link to="/signup" className="font-medium text-primary hover:underline">
						Créez un compte
					</Link>
				</p>
				<form className="flex w-full max-w-73 flex-col [&_label]:text-sm [&_label]:leading-4.5" onSubmit={onSubmit} noValidate aria-busy={submitting}>
					<Field id="email" label="Adresse mail" error={errors.email} className="mt-7">
						<input
							type="email"
							autoComplete="email"
							value={email}
							onChange={(e) => {
								setEmail(e.target.value);
								setFormError("");
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
								setFormError("");
								if (errors.password) setErrors({ ...errors, password: validatePassword(e.target.value) });
							}}
						/>
					</Field>
					{formError && (
						<p role="alert" className="mt-4 text-center text-sm leading-4.5 text-[#D92D20]">
							{formError}
						</p>
					)}
					<a href="#" className="mt-[23px] self-center text-base leading-4.5 text-primary hover:underline">
						Mot de passe oublié ?
					</a>
					<Button
						type="submit"
						className={`mt-2 w-[205px] self-center py-2.5! leading-4.5 ${submitting ? "cursor-wait opacity-70" : ""}`}
					>
						{submitting ? "Connexion…" : "Connexion"}
					</Button>
				</form>
			</div>
		</main>
	);
}
