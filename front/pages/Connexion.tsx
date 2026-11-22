import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginForm } from "../utils/login";

import AuthLayout from "../components/AuthLayout";
import Field from "../components/Field";
import Button from "../components/Button";
import { login } from "../services/auth";
import { MESSAGES } from "../utils/validation";
import { accountHome } from "../utils/accountHome";

const FORM_ERRORS = {
	invalidCredentials: MESSAGES.invalidCredentials,
	suspended: MESSAGES.accountSuspended,
	server: MESSAGES.serverError,
	network: MESSAGES.networkError,
};

export default function Connexion() {
	const navigate = useNavigate();
	const location = useLocation();
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
			navigate(accountHome(result.user.role, location.state?.recruiterReturnTo, location.state?.studentReturnTo), { replace: true });
		} finally {
			submittingRef.current = false;
		}
	}, () => setFormError(""));

	// Identifiants incorrects : les deux champs en rouge, message sous le mot de passe (maquette)
	const credentialsError = formError === MESSAGES.invalidCredentials;

	return (
		<AuthLayout mode="login">
			<p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">Espace membre</p>
			<h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Heureux de vous retrouver.</h1>
			<p className="mt-3 text-sm leading-relaxed text-[#6b7280]">Connectez-vous pour reprendre là où vous en étiez.</p>
					<form className="mt-8 flex w-full flex-col gap-5" onSubmit={onSubmit} noValidate aria-busy={isSubmitting}>
						<Field id="email" label="Adresse mail" error={errors.email?.message} invalid={credentialsError}>
							<input
								type="email"
								autoComplete="email"
								placeholder="vous@exemple.fr"
								{...register("email", { onChange: () => setFormError("") })}
							/>
						</Field>
						<Field id="password" label="Mot de passe" error={errors.password?.message || (credentialsError ? formError : "")}>
							<input
								type="password"
								autoComplete="current-password"
								placeholder="••••••••"
								{...register("password", { onChange: () => setFormError("") })}
							/>
						</Field>
						{formError && !credentialsError && (
							<p role="alert" className="text-xs font-medium text-[#DC2626]">
								{formError}
							</p>
						)}
						<Button
							type="submit"
							disabled={isSubmitting}
							className={`mt-1 w-full py-3 ${isSubmitting ? "cursor-wait opacity-70" : ""}`}
						>
							{isSubmitting ? "Connexion…" : "Connexion"}
						</Button>
					</form>
			<p className="mt-8 border-t border-[#e5e7eb] pt-6 text-sm text-[#6b7280]">Pas encore de compte ? <Link to="/signup" className="font-semibold text-primary hover:underline">Créer un compte →</Link></p>
		</AuthLayout>
	);
}
