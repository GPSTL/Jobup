import { useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Logo from "../components/Logo";
import Field from "../components/Field";
import Button from "../components/Button";
import { signup } from "../services/auth";
import { signupSchema, toSignupPayload, type SignupForm } from "../utils/signup";
import { MESSAGES } from "../utils/validation";
import { accountHome } from "../utils/accountHome";
import { ROLES, getRole, type Role, getRoleApiName, type RoleApiName } from "../utils/roles";

export { toSignupPayload } from "../utils/signup";

function GenericSignupForm({ role }: { role: RoleApiName }) {
	const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<SignupForm>({
		resolver: zodResolver(signupSchema),
		defaultValues: { first_name: "", last_name: "", email: "", password: "" },
	});
	const navigate = useNavigate();
	const pending = useRef(false);
	const onSubmit = handleSubmit(async (form) => {
		if (pending.current) return;
		pending.current = true;
		try {
			const result = await signup(toSignupPayload(form, role));
			if (result.ok) {
				// Compte créé et session ouverte par l'API : même destination qu'après la connexion
				navigate(accountHome(result.user.role), { replace: true });
			} else if (result.reason === "validation") {
				const fields = ["first_name", "last_name", "email", "password"] as const;
				let focused = false;
				for (const field of fields) {
					if (result.errors[field]) {
						setError(field, { type: "server", message: result.errors[field] }, { shouldFocus: !focused });
						focused = true;
					}
				}
				if (!focused) setError("root", { message: MESSAGES.serverError });
			} else {
				setError("root", { message: result.reason === "network" ? MESSAGES.networkError : MESSAGES.serverError });
			}
		} finally {
			pending.current = false;
		}
	});

	return (
		<form aria-busy={isSubmitting} className="mt-6 flex w-full flex-col gap-4" onSubmit={onSubmit} noValidate>
			<div className="grid gap-4 sm:grid-cols-2">
				<Field id="prenom" label="Prénom" error={errors.first_name?.message}>
					<input autoComplete="given-name" {...register("first_name")} />
				</Field>
				<Field id="nom" label="Nom" error={errors.last_name?.message}>
					<input autoComplete="family-name" {...register("last_name")} />
				</Field>
			</div>
			<Field id="email" label="Adresse mail" error={errors.email?.message}>
				<input type="email" autoComplete="email" placeholder="vous@exemple.fr" {...register("email")} />
			</Field>
			<Field id="password" label="Mot de passe" error={errors.password?.message}>
				<input type="password" autoComplete="new-password" {...register("password")} />
			</Field>
			{errors.root && <p role="alert" className="text-sm font-medium text-[#DC2626]">{errors.root.message}</p>}
			<Button type="submit" disabled={isSubmitting} className="mt-2 w-full py-3">
				{isSubmitting ? "Inscription…" : "S’inscrire"}
			</Button>
		</form>
	);
}

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

	return (
		<main className="grid min-h-dvh bg-[#f8fafc] lg:grid-cols-[1fr_1.1fr]">
			{/* Left showcase column on desktop */}
			<aside aria-label="Présentation JobUp" className="auth-mesh hidden flex-col justify-between p-12 text-white lg:flex">
				<div className="flex items-center gap-3">
					<Link to="/" className="auth-brand-badge rounded-xl bg-white/95 px-3.5 py-2 shadow-sm">
						<img src="/static/img/JobUp_logo.svg" alt="JobUp, accueil" className="auth-brand-logo-light h-6" />
						<img src="/static/img/JobUp_logo_dark.svg" alt="JobUp, accueil" className="auth-brand-logo-dark h-6" />
					</Link>
				</div>

				<div className="flex max-w-md flex-col gap-6">
					<span className="w-fit rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-xs font-semibold tracking-wide uppercase backdrop-blur-xs">
						Inscription gratuite
					</span>
					<p className="text-3xl leading-tight font-extrabold tracking-tight">
						Rejoignez l’écosystème qui simplifie la recherche et le recrutement en alternance.
					</p>
					<div className="grid gap-3 rounded-2xl border border-white/20 bg-white/10 p-5 text-sm backdrop-blur-xs">
						<p className="font-semibold">Un compte adapté à votre profil :</p>
						<p className="text-white/80">
							Étudiant, Recruteur ou École : sélectionnez votre rôle et accédez immédiatement à vos outils dédiés.
						</p>
					</div>
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
						<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Inscription</h1>
						<p className="mt-1.5 text-sm text-[#6b7280]">Sélectionnez votre profil et créez votre compte en quelques secondes.</p>
					</div>

					<div
						role="radiogroup"
						aria-label="Type de compte"
						className="mt-5 grid h-11 w-full grid-cols-3 gap-1 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-1"
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
								<span className="flex h-full w-full items-center justify-center rounded-lg text-sm font-medium text-[#6b7280] transition-colors peer-checked:bg-primary peer-checked:font-semibold peer-checked:text-on-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
									{label}
								</span>
							</label>
						))}
					</div>

					<GenericSignupForm role={getRoleApiName(role)} />

					<div className="mt-6 flex items-center justify-between border-t border-[#e5e7eb] pt-4 text-sm">
						<Link to="/" className="text-xs font-medium text-[#6b7280] hover:text-primary hover:underline">
							← Accueil
						</Link>
						<Link to="/login" className="font-medium text-primary hover:underline">
							Déjà inscrit&nbsp;? Se connecter
						</Link>
					</div>
				</div>
			</div>
		</main>
	);
}
