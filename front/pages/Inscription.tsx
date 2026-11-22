import { useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthLayout from "../components/AuthLayout";
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
				<input type="password" autoComplete="new-password" placeholder="••••••••" {...register("password")} />
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
		<AuthLayout mode="signup">
			<p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">Bienvenue sur JobUp</p>
			<h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Créez votre compte.</h1>
			<p className="mt-3 text-sm leading-relaxed text-[#6b7280]">Choisissez votre profil pour commencer votre parcours.</p>
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
			<p className="mt-8 border-t border-[#e5e7eb] pt-6 text-sm text-[#6b7280]">Déjà inscrit ? <Link to="/login" className="font-semibold text-primary hover:underline">Se connecter →</Link></p>
		</AuthLayout>
	);
}
