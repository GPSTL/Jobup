import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";

import ApplicationsLayout, { BackToApplications, LoadError, LoadingMessage } from "./ApplicationsLayout";
import { getApplication, type ApplicationResult, type ApplicationDetail } from "../services/applications";
import { MESSAGES } from "../utils/validation";

type ApplicationLoaderProps = {
	/** Écran affiché une fois la candidature chargée */
	children: (application: ApplicationDetail) => ReactNode;
};

const panel = "max-w-[1000px] gap-5 px-4 pt-8 pb-9 md:px-10";

// Charge la candidature de l'URL et gère les états communs au détail et à la reprise d'un brouillon
export default function ApplicationLoader({ children }: ApplicationLoaderProps) {
	const { id } = useParams();
	const [result, setResult] = useState<ApplicationResult | null>(null);
	// Incrémenté par « Réessayer » pour relancer la requête
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		// Ignore une réponse arrivée après un changement de candidature
		let ignore = false;
		setResult(null);
		getApplication(Number(id)).then((response) => {
			if (!ignore) setResult(response);
		});
		return () => {
			ignore = true;
		};
	}, [id, attempt]);

	if (result?.ok) return children(result.application);

	// Session expirée pendant la consultation : retour à la connexion
	if (result?.reason === "noSession") return <Navigate to="/login" replace />;

	return (
		<ApplicationsLayout className={panel}>
			<BackToApplications />
			{result === null && <LoadingMessage />}
			{result?.reason === "notFound" && (
				<>
					<h1 className="text-[28px] font-semibold">Candidature introuvable</h1>
					<p className="text-[16px] text-[#6b7280]">Cette candidature n’existe pas ou n’est pas la vôtre.</p>
				</>
			)}
			{(result?.reason === "server" || result?.reason === "network") && (
				<LoadError
					message={result.reason === "network" ? MESSAGES.networkError : MESSAGES.serverError}
					onRetry={() => setAttempt(attempt + 1)}
				/>
			)}
		</ApplicationsLayout>
	);
}
