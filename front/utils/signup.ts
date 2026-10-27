import { z } from "zod";
import { validateEmail, validateNewPassword, validateNom, validatePrenom } from "./validation";

const validated = (validator: (value: string) => string) => z.string().superRefine((value, ctx) => {
	const message = validator(value);
	if (message) ctx.addIssue({ code: "custom", message });
});
const name = (validator: (value: string) => string) => validated(validator)
	.refine(value => value.trim().length <= 32, "32 caractères maximum.");

export const signupSchema = z.object({
	prenom: name(validatePrenom),
	nom: name(validateNom),
	email: validated(validateEmail).refine(value => value.trim().length <= 254, "254 caractères maximum."),
	password: validated(validateNewPassword),
});
export type SignupForm = z.infer<typeof signupSchema>;
export const toSignupPayload = (form: SignupForm) => ({
	prenom: form.prenom.trim(),
	nom: form.nom.trim(),
	email: form.email.trim(),
	password: form.password,
	role: "student" as const,
});
