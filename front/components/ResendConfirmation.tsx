import { useState } from "react";
import { resendConfirmation } from "../services/auth";
import { MESSAGES } from "../utils/validation";
import Button from "./Button";

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
		<div className="mt-5 flex w-full flex-col gap-3">
			<Button variant="outline" onClick={send} disabled={status === "sending"} className={`w-full py-3 ${status === "sending" ? "cursor-wait" : ""}`}>
				{status === "sending" ? "Envoi…" : "Renvoyer l’e-mail de confirmation"}
			</Button>
			<p role="status" className={`text-sm ${status === "sent" ? "text-[#6b7280]" : "text-[#DC2626] font-medium"} empty:hidden`}>
				{status === "sent" && "Si ce compte attend une confirmation, un nouvel e-mail vient d’être envoyé."}
				{status === "tooManyRequests" && MESSAGES.tooManyRequests}
				{status === "error" && MESSAGES.serverError}
			</p>
		</div>
	);
}
