import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Logo from "../components/Logo";
import Button from "../components/Button";
import { confirmEmail } from "../services/auth";
import { MESSAGES } from "../utils/validation";

type State = "loading" | "confirmed" | "expired" | "invalid" | "server" | "network";

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

	return (
		<main className="flex min-h-screen flex-col items-center bg-[#F0F0F0] px-4 pt-10 pb-16 sm:pt-19">
			<Logo className="h-12 sm:h-16" />
			<div className="mt-8.5 flex w-full max-w-[545px] flex-col items-center rounded-[25px] bg-surface px-4 pt-8 pb-10 text-center shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
				<h1 className="text-4xl leading-[33px] font-semibold">Confirmation</h1>
				<div role="status" aria-live="polite" className="mt-8 flex flex-col items-center gap-4">
					{state === "loading" && <p>Confirmation de votre adresse e-mail…</p>}
					{state === "confirmed" && (
						<>
							<p>Votre adresse e-mail est confirmée. Vous pouvez maintenant vous connecter.</p>
							<Button to="/login">Se connecter</Button>
						</>
					)}
					{state === "expired" && (
						<>
							<p>Ce lien de confirmation a expiré. Saisissez votre adresse sur la page de connexion pour en recevoir un nouveau.</p>
							<Button to="/login">Aller à la connexion</Button>
						</>
					)}
					{state === "invalid" && (
						<>
							<p>Ce lien de confirmation n’est pas valide.</p>
							<Button to="/login">Aller à la connexion</Button>
						</>
					)}
					{state === "server" && <p>{MESSAGES.serverError}</p>}
					{state === "network" && <p>{MESSAGES.networkError}</p>}
				</div>
			</div>
		</main>
	);
}
