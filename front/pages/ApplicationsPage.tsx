import { useEffect, useId, useState } from "react";
import { Navigate } from "react-router-dom";

import ApplicationCard from "../components/ApplicationCard";
import ApplicationsLayout, { LoadError, LoadingMessage } from "../components/ApplicationsLayout";
import { getApplications, type ApplicationSummary } from "../services/applications";
import { byLastUpdate } from "../utils/applications";
import { MESSAGES } from "../utils/validation";

type ColumnProps = {
	title: string;
	applications: ApplicationSummary[];
	emptyMessage: string;
};

function Column({ title, applications, emptyMessage }: ColumnProps) {
	const titleId = useId();
	return (
		<section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-3">
			<div className="flex items-center gap-2.5">
				<h2 id={titleId} className="text-[20px] font-semibold">{title}</h2>
				<span className="rounded-full bg-[#f3f4f6] px-2.5 py-[5px] text-[13px] font-semibold text-[#6b7280]">
					<span className="sr-only">Nombre de candidatures : </span>
					{applications.length}
				</span>
			</div>
			{applications.length === 0 ? (
				<p className="text-[15px] text-[#6b7280]">{emptyMessage}</p>
			) : (
				<ul className="flex flex-col gap-3">
					{byLastUpdate(applications).map((application) => (
						<ApplicationCard key={application.id} application={application} />
					))}
				</ul>
			)}
		</section>
	);
}

// Suivi des candidatures de l'étudiant (JOB-033, ETU-14)
export default function ApplicationsPage() {
	const [columns, setColumns] = useState<{ inProgress: ApplicationSummary[]; completed: ApplicationSummary[] } | null>(null);
	const [error, setError] = useState("");
	const [noSession, setNoSession] = useState(false);
	// Incrémenté par « Réessayer » pour relancer la requête
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let ignore = false;
		setColumns(null);
		setError("");
		getApplications().then((result) => {
			if (ignore) return;
			if (result.ok) setColumns(result);
			else if (result.reason === "noSession") setNoSession(true);
			else setError(result.reason === "network" ? MESSAGES.networkError : MESSAGES.serverError);
		});
		return () => {
			ignore = true;
		};
	}, [attempt]);

	// Session expirée pendant la consultation : retour à la connexion
	if (noSession) return <Navigate to="/login" replace />;

	return (
		<ApplicationsLayout className="max-w-[1236px] gap-5 px-4 pt-8 pb-9 md:px-10">
			<div className="flex flex-col gap-1.5">
				<h1 className="text-[32px] font-semibold">Candidatures</h1>
				<p className="text-[16px] text-[#6b7280]">Suivez vos candidatures et faites le bilan de votre recherche.</p>
			</div>

			{error && <LoadError message={error} onRetry={() => setAttempt(attempt + 1)} />}
			{!error && columns === null && <LoadingMessage />}
			{columns && (
				<div className="grid items-start gap-6 md:grid-cols-2">
					<Column title="En cours" applications={columns.inProgress} emptyMessage="Aucune candidature en cours." />
					<Column title="Finalisées" applications={columns.completed} emptyMessage="Aucune candidature finalisée." />
				</div>
			)}
		</ApplicationsLayout>
	);
}
