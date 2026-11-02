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

// Preserve JOB-028's non-student fields while their signup APIs are unavailable.
export const organizationSignupSchema = signupSchema.extend({
	telephone: z.string().regex(/^(?:0|\+33)[1-9]\d{8}$/, "Numéro invalide : 10 chiffres commençant par 0."),
});
export type OrganizationSignupForm = z.infer<typeof organizationSignupSchema>;
