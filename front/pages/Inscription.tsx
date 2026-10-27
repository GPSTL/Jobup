import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Logo from "../components/Logo";
import Field from "../components/Field";
import Button from "../components/Button";
import { signup } from "../services/auth";
import { signupSchema, toSignupPayload, type SignupForm } from "../utils/signup";
import { MESSAGES } from "../utils/validation";

export { toSignupPayload } from "../utils/signup";

// Types de compte de la maquette : seule l'inscription étudiant fait partie de JOB-005
const ROLES = [
	{ label: "Étudiant", active: true },
	{ label: "Entreprise", active: false },
	{ label: "École", active: false },
];

export default function Inscription() {
	const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<SignupForm>({
		resolver: zodResolver(signupSchema),
		defaultValues: { prenom: "", nom: "", email: "", password: "" },
	});
	const [created, setCreated] = useState(false);
	const pending = useRef(false);
	const onSubmit = handleSubmit(async (form) => {
		if (pending.current) return;
		pending.current = true;
		try {
			const result = await signup(toSignupPayload(form));
			if (result.ok) {
				setCreated(true);
			} else if (result.reason === "validation") {
				const fields = ["prenom", "nom", "email", "password"] as const;
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
		<main className="flex min-h-screen flex-col items-center bg-[#F0F0F0] px-4 pt-10 pb-16 sm:pt-19">
			<Logo className="h-12 sm:h-16" />
			<div className="mt-8.5 flex w-full max-w-[545px] flex-col items-center rounded-[25px] bg-surface px-4 pt-8 pb-10 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
				<h1 className="text-4xl leading-[33px] font-semibold">Inscription</h1>
				<div
					role="radiogroup"
					aria-label="Type de compte"
					className="mt-[17px] grid h-[42px] w-full max-w-[317px] grid-cols-3 gap-1 rounded-[11.5px] border border-[#E5E7EB] bg-[#F9FAFB] p-[3px]"
				>
					{ROLES.map(({ label, active }) => (
						<button
							key={label}
							type="button"
							role="radio"
							aria-checked={active}
							// Entreprise et École : visibles comme sur la maquette, mais pas encore disponibles
							aria-disabled={!active}
							title={active ? undefined : "Bientôt disponible"}
							className={
								active
									? "rounded-[9px] bg-primary text-[15px] font-semibold text-on-primary"
									: "cursor-not-allowed rounded-[9px] text-[15px] font-medium text-[#6B7280]"
							}
						>
							{label}
						</button>
					))}
				</div>
				{created ? (
					<p role="status" className="mt-8 text-center">Votre compte a été créé. Vous pouvez maintenant vous connecter.</p>
				) : <form aria-busy={isSubmitting} className="flex w-full max-w-73 flex-col [&_label]:text-sm [&_label]:leading-4.5" onSubmit={onSubmit} noValidate>
					<Field id="prenom" label="Prénom" error={errors.prenom?.message} className="mt-[45px]">
						<input autoComplete="given-name" {...register("prenom")} />
					</Field>
					<Field id="nom" label="Nom" error={errors.nom?.message} className="mt-[29px]">
						<input autoComplete="family-name" {...register("nom")} />
					</Field>
					<Field id="email" label="Adresse mail" error={errors.email?.message} className="mt-[29px]">
						<input type="email" autoComplete="email" {...register("email")} />
					</Field>
					<Field id="password" label="Mot de passe" error={errors.password?.message} className="mt-[29px]">
						<input type="password" autoComplete="new-password" {...register("password")} />
					</Field>
					{errors.root && <p role="alert" className="mt-4 text-sm text-red-600">{errors.root.message}</p>}
					<Button type="submit" disabled={isSubmitting} className="mt-11.5 w-[205px] self-center py-2.5! leading-3.75">
						{isSubmitting ? "Inscription…" : "S’inscrire"}
					</Button>
				</form>}
				<Link to="/login" className="mt-4 text-sm leading-4.5 font-medium text-primary hover:underline">
					Déjà inscrit&nbsp;? Se connecter
				</Link>
			</div>
		</main>
	);
}
