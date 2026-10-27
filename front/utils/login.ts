import { z } from "zod";
import { validateEmail, validatePassword } from "./validation";

export const loginSchema = z.object({
	email: z.string().superRefine((value, ctx) => {
		const message = validateEmail(value);
		if (message) ctx.addIssue({ code: "custom", message });
	}),
	// Existing passwords only need to be present; signup strength rules do not apply.
	password: z.string().superRefine((value, ctx) => {
		const message = validatePassword(value);
		if (message) ctx.addIssue({ code: "custom", message });
	}),
});
export type LoginForm = z.infer<typeof loginSchema>;
