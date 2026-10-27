import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginForm } from "../utils/login";

import Logo from "../components/Logo";
import Field from "../components/Field";
import Button from "../components/Button";
import { login } from "../services/auth";
import { MESSAGES } from "../utils/validation";

const FORM_ERRORS = {
	invalidCredentials: MESSAGES.invalidCredentials,
	server: MESSAGES.serverError,
	network: MESSAGES.networkError,
};

export default function Connexion() {
	const { register, handleSubmit, setFocus, formState: { errors, isSubmitting } } = useForm<LoginForm>({
		resolver: zodResolver(loginSchema),
		defaultValues: { email: "", password: "" },
	});
	const [formError, setFormError] = useState("");
	const submittingRef = useRef(false);
	const onSubmit = handleSubmit(async ({ email, password }) => {
		if (submittingRef.current) return;
		submittingRef.current = true;
		setFormError("");
		try {
			const result = await login(email.trim(), password);
			if (!result.ok) {
				setFormError(FORM_ERRORS[result.reason]);
				if (result.reason === "invalidCredentials") setFocus("password");
				return;
			}
			// TODO: redirect to the student space once its route is confirmed (JOB-006).
		} finally {
			submittingRef.current = false;
		}
	}, () => setFormError(""));

	// Identifiants incorrects : les deux champs en rouge, message sous le mot de passe (maquette)
	const credentialsError = formError === MESSAGES.invalidCredentials;

	return (
		<main className="flex min-h-screen flex-col items-center bg-[#F0F0F0] px-4 pt-10 pb-16 sm:pt-19">
			<Logo className="h-12 sm:h-16" />
			<div className="mt-8.5 flex w-full max-w-[545px] flex-col items-center rounded-[25px] bg-surface px-4 pt-8 pb-10 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
				<h1 className="text-4xl leading-[33px] font-semibold">Connexion</h1>
				<p className="mt-[27px] text-base leading-4.5">
					Pas encore membre&nbsp;?{" "}
					<Link to="/signup" className="font-medium text-primary hover:underline">
						Créez un compte
					</Link>
				</p>
				<form className="flex w-full max-w-73 flex-col [&_label]:text-sm [&_label]:leading-4.5" onSubmit={onSubmit} noValidate aria-busy={isSubmitting}>
					<Field id="email" label="Adresse mail" error={errors.email?.message} invalid={credentialsError} className="mt-7">
						<input
							type="email"
							autoComplete="email"
							{...register("email", { onChange: () => setFormError("") })}
						/>
					</Field>
					<Field id="password" label="Mot de passe" error={errors.password?.message || (credentialsError ? formError : "")} className="mt-[29px]">
						<input
							type="password"
							autoComplete="current-password"
							{...register("password", { onChange: () => setFormError("") })}
						/>
					</Field>
					{formError && !credentialsError && (
						<p role="alert" className="mt-[5px] text-xs leading-3 font-medium text-[#DC2626]">
							{formError}
						</p>
					)}
					<a href="#" className="mt-[23px] self-center text-base leading-4.5 text-primary hover:underline">
						Mot de passe oublié ?
					</a>
					<Button
						type="submit"
						disabled={isSubmitting}
						className={`mt-2 w-[205px] self-center py-2.5! leading-3.75 ${isSubmitting ? "cursor-wait opacity-70" : ""}`}
					>
						{isSubmitting ? "Connexion…" : "Connexion"}
					</Button>
				</form>
			</div>
		</main>
	);
}
