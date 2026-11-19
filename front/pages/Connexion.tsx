import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginForm } from "../utils/login";

import Logo from "../components/Logo";
import Field from "../components/Field";
import Button from "../components/Button";
import ResendConfirmation from "../components/ResendConfirmation";
import { login } from "../services/auth";
import { MESSAGES } from "../utils/validation";
import { accountHome } from "../utils/accountHome";

const FORM_ERRORS = {
	invalidCredentials: MESSAGES.invalidCredentials,
	suspended: MESSAGES.accountSuspended,
	emailNotConfirmed: MESSAGES.emailNotConfirmed,
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
	// E-mail of the account whose address is not confirmed yet: offers to send the e-mail again
	const [unconfirmedEmail, setUnconfirmedEmail] = useState("");
	const submittingRef = useRef(false);
	const onSubmit = handleSubmit(async ({ email, password }) => {
		if (submittingRef.current) return;
		submittingRef.current = true;
		setFormError("");
		setUnconfirmedEmail("");
		try {
			const result = await login(email.trim(), password);
			if (!result.ok) {
				setFormError(FORM_ERRORS[result.reason]);
				if (result.reason === "emailNotConfirmed") setUnconfirmedEmail(email.trim());
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
		<main className="grid min-h-dvh bg-[#f8fafc] lg:grid-cols-[1fr_1.1fr]">
			{/* Left showcase column on desktop */}
			<aside aria-label="Présentation JobUp" className="auth-mesh hidden flex-col justify-between p-12 text-white lg:flex">
				<div className="flex items-center gap-3">
					<Link to="/" className="rounded-xl bg-white/95 px-3.5 py-2 shadow-sm">
						<img src="/static/img/JobUp_logo.svg" alt="JobUp, accueil" className="h-6" />
					</Link>
				</div>

				<div className="flex max-w-md flex-col gap-6">
					<span className="w-fit rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-xs font-semibold tracking-wide uppercase backdrop-blur-xs">
						Espace membre
					</span>
					<p className="text-3xl leading-tight font-extrabold tracking-tight">
						Retrouvez vos offres, vos candidatures et vos messages en un clin d’œil.
					</p>
					<ul className="flex flex-col gap-3 text-sm text-white/85">
						<li className="flex items-center gap-2.5">
							<span className="flex size-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold">✓</span>
							Postulation rapide avec votre CV pré-enregistré
						</li>
						<li className="flex items-center gap-2.5">
							<span className="flex size-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold">✓</span>
							Suivi temps réel de chaque étape du recrutement
						</li>
						<li className="flex items-center gap-2.5">
							<span className="flex size-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold">✓</span>
							Messagerie directe entre candidats et recruteurs
						</li>
					</ul>
				</div>

				<p className="text-xs text-white/65">© {new Date().getFullYear()} JobUp • Plateforme d’alternance</p>
			</aside>

			{/* Right form column */}
			<div className="flex flex-col items-center justify-center px-4 py-12 sm:px-8">
				<div className="mb-8 lg:hidden">
					<Logo className="h-9" />
				</div>

				<div className="flex w-full max-w-md flex-col rounded-3xl border border-[#e5e7eb] bg-surface p-6 shadow-sm sm:p-9">
					<div>
						<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Connexion</h1>
						<p className="mt-2 text-sm text-[#6b7280]">
							Pas encore membre&nbsp;?{" "}
							<Link to="/signup" className="font-semibold text-primary hover:underline">
								Créez un compte
							</Link>
						</p>
					</div>

					<form className="mt-6 flex w-full flex-col gap-4" onSubmit={onSubmit} noValidate aria-busy={isSubmitting}>
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
								{...register("password", { onChange: () => setFormError("") })}
							/>
						</Field>
						{formError && !credentialsError && (
							<p role="alert" className="text-xs font-medium text-[#DC2626]">
								{formError}
							</p>
						)}
						{unconfirmedEmail && <ResendConfirmation email={unconfirmedEmail} />}
						<div className="flex justify-end">
							<a href="#" className="text-sm font-medium text-primary hover:underline">
								Mot de passe oublié ?
							</a>
						</div>
						<Button
							type="submit"
							disabled={isSubmitting}
							className={`mt-1 w-full py-3 ${isSubmitting ? "cursor-wait opacity-70" : ""}`}
						>
							{isSubmitting ? "Connexion…" : "Connexion"}
						</Button>
					</form>

					<div className="mt-6 border-t border-[#e5e7eb] pt-4 text-center">
						<Link to="/" className="text-xs font-medium text-[#6b7280] hover:text-primary hover:underline">
							← Retour à l’accueil
						</Link>
					</div>
				</div>
			</div>
		</main>
	);
}
