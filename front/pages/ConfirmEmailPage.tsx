import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import Button from "../components/Button";
import { confirmEmail } from "../services/auth";
import { MESSAGES } from "../utils/validation";

type State = "loading" | "confirmed" | "expired" | "invalid" | "server" | "network";

const CONTENT: Record<State, { title: string; text: string }> = {
	loading: { title: "Confirmation en cours…", text: "Confirmation de votre adresse e-mail…" },
	confirmed: { title: "Adresse confirmée.", text: "Votre adresse e-mail est confirmée. Vous pouvez maintenant vous connecter." },
	expired: { title: "Lien expiré.", text: "Ce lien de confirmation a expiré. Saisissez votre adresse sur la page de connexion pour en recevoir un nouveau." },
	invalid: { title: "Lien invalide.", text: "Ce lien de confirmation n’est pas valide." },
	server: { title: "Une erreur est survenue.", text: MESSAGES.serverError },
	network: { title: "Serveur injoignable.", text: MESSAGES.networkError },
};

// Target of the link of the confirmation e-mail: /confirm-email?token=…
// The token is sent with a POST, not confirmed by a GET, so that a link previewed by a mail
// scanner does not confirm an account.
export default function ConfirmEmailPage() {
	const [searchParams] = useSearchParams();
	const token = searchParams.get("token") ?? "";
	const [state, setState] = useState<State>(token ? "loading" : "invalid");

	useEffect(() => {
		if (!token) return;
		let cancelled = false;
		confirmEmail(token).then((result) => {
			if (!cancelled) setState(result.ok ? "confirmed" : result.reason);
		});
		return () => { cancelled = true; };
	}, [token]);

	const { title, text } = CONTENT[state];
	return (
		<AuthLayout mode="login">
			<div role="status" aria-live="polite">
				<p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">Confirmation</p>
				<h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
				<p className="mt-3 text-sm leading-relaxed text-[#6b7280]">{text}</p>
			</div>
			{(state === "confirmed" || state === "expired" || state === "invalid") && (
				<Button to="/login" className="mt-8 w-full py-3">{state === "confirmed" ? "Se connecter" : "Aller à la connexion"}</Button>
			)}
		</AuthLayout>
	);
}
