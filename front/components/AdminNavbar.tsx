import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AccountNavbar from "./AccountNavbar";
import { logout } from "../services/auth";

const links = [
	{ label: "Mon espace" },
	{ label: "Liste d’utilisateurs", to: "/administration/users" },
	{ label: "Liste d’entreprises" },
	{ label: "Liste d’écoles" },
	{ label: "Signalements" },
	{ label: "Réclamations" },
];

export default function AdminNavbar() {
	const navigate = useNavigate();
	const [pending, setPending] = useState(false);
	const [error, setError] = useState(false);
	const disconnect = async () => {
		setPending(true); setError(false);
		if (await logout()) navigate("/login", { replace: true });
		else { setError(true); setPending(false); }
	};
	return <>
		<AccountNavbar links={links} compact hoverHighlight actions={
			<button data-nav-action onClick={disconnect} disabled={pending} className="shrink-0 cursor-pointer rounded-xl border border-[#d1d5db] px-3 py-2 text-sm text-[#6b7280] motion-safe:transition-colors active:bg-primary active:text-on-primary focus-visible:bg-primary focus-visible:text-on-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{pending ? "Déconnexion…" : "↪ Déconnexion"}</button>
		} />
		{error && <p role="alert" className="mt-3 text-right text-red-600">La déconnexion a échoué. Veuillez réessayer.</p>}
	</>;
}
