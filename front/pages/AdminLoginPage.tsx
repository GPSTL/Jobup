import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import Button from "../components/Button";
import Field from "../components/Field";
import Logo from "../components/Logo";
import { ADMIN_ROLE, adminLogin, getSession, type SessionResult } from "../services/auth";
import { adminReturnTo } from "../utils/adminUsers";
import { loginSchema, type LoginForm } from "../utils/login";
import { MESSAGES } from "../utils/validation";

const FORM_ERRORS = {
	invalidCredentials: MESSAGES.invalidCredentials,
	suspended: MESSAGES.accountSuspended,
	server: MESSAGES.serverError,
	network: MESSAGES.networkError,
};

// Same form as the login of the other roles (Connexion), without the signup link nor
// « Mot de passe oublié » : the administrator accounts are created by the team (create_admin)
export function AdminLoginView({ onLoggedIn }: { onLoggedIn: () => void }) {
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
			const result = await adminLogin(email.trim(), password);
			if (!result.ok) {
				setFormError(FORM_ERRORS[result.reason]);
				if (result.reason === "invalidCredentials") setFocus("password");
				return;
			}
			onLoggedIn();
		} finally {
			submittingRef.current = false;
		}
	}, () => setFormError(""));

	// Wrong credentials: both fields in red, the message under the password
	const credentialsError = formError === MESSAGES.invalidCredentials;

	return (
		<main className="flex min-h-dvh flex-col items-center justify-center bg-[#f8fafc] px-4 py-12">
			<Logo className="h-10 sm:h-12" />
			<div className="mt-8 flex w-full max-w-md flex-col rounded-3xl border border-[#e5e7eb] bg-surface p-6 shadow-sm sm:p-9">
				<div className="flex flex-col items-center text-center">
					<span className="mb-2 rounded-full bg-[#dbeafe] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
						Portail d’administration
					</span>
					<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Espace administrateur</h1>
					<p className="mt-2 text-sm text-[#6b7280]">Connexion réservée aux administrateurs de JobUp.</p>
				</div>
				<form className="mt-6 flex w-full flex-col gap-4" onSubmit={onSubmit} noValidate aria-busy={isSubmitting}>
					<Field id="admin-email" label="Adresse mail" error={errors.email?.message} invalid={credentialsError}>
						<input type="email" autoComplete="username" {...register("email", { onChange: () => setFormError("") })} />
					</Field>
					<Field id="admin-password" label="Mot de passe" error={errors.password?.message || (credentialsError ? formError : "")}>
						<input type="password" autoComplete="current-password" {...register("password", { onChange: () => setFormError("") })} />
					</Field>
					{formError && !credentialsError && (
						<p role="alert" className="text-xs font-medium text-[#DC2626]">
							{formError}
						</p>
					)}
					<Button type="submit" disabled={isSubmitting} className={`mt-2 w-full py-3 ${isSubmitting ? "cursor-wait opacity-70" : ""}`}>
						{isSubmitting ? "Connexion…" : "Se connecter"}
					</Button>
				</form>
			</div>
		</main>
	);
}

// /administration (ADM-13): the login of the administrators, then the page asked before it
// (?next=) or the list of the users. An administrator already logged in goes straight on
export default function AdminLoginPage() {
	const navigate = useNavigate();
	const [params] = useSearchParams();
	const target = adminReturnTo(params.get("next"));
	const [session, setSession] = useState<SessionResult | null>(null);

	useEffect(() => {
		let ignore = false;
		getSession().then((result) => {
			if (!ignore) setSession(result);
		});
		return () => {
			ignore = true;
		};
	}, []);

	if (session === null) {
		return (
			<main className="flex min-h-dvh items-center justify-center px-4" aria-busy="true">
				<p className="text-base text-[#6b7280]">Chargement…</p>
			</main>
		);
	}
	if (session.ok && session.user.role === ADMIN_ROLE) return <Navigate to={target} replace />;
	// Visitor, account of another role or session that could not be checked: the form
	return <AdminLoginView onLoggedIn={() => navigate(target, { replace: true })} />;
}
