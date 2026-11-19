import { useState } from "react";
import { resendConfirmation } from "../services/auth";
import { MESSAGES } from "../utils/validation";

type Status = "idle" | "sending" | "sent" | "tooManyRequests" | "error";

// "Renvoyer l'e-mail" button of the e-mail confirmation (signup and login pages)
export default function ResendConfirmation({ email }: { email: string }) {
	const [status, setStatus] = useState<Status>("idle");
	const send = async () => {
		if (status === "sending") return;
		setStatus("sending");
		const result = await resendConfirmation(email);
		if (result.ok) setStatus("sent");
		else setStatus(result.reason === "tooManyRequests" ? "tooManyRequests" : "error");
	};

	return (
		<div className="mt-3 flex flex-col items-center gap-2 text-sm">
			<button
				type="button"
				onClick={send}
				disabled={status === "sending"}
				className="cursor-pointer font-medium text-primary hover:underline disabled:cursor-wait disabled:opacity-60"
			>
				Renvoyer l’e-mail de confirmation
			</button>
			<p role="status" className="min-h-4 text-center">
				{status === "sent" && "Si ce compte attend une confirmation, un nouvel e-mail vient d’être envoyé."}
				{status === "tooManyRequests" && MESSAGES.tooManyRequests}
				{status === "error" && MESSAGES.serverError}
			</p>
		</div>
	);
}
