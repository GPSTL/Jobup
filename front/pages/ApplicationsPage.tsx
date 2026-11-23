import { useEffect, useId, useState } from "react";
import { Navigate } from "react-router-dom";

import ApplicationCard from "../components/ApplicationCard";
import ApplicationsLayout, { LoadError, LoadingMessage } from "../components/ApplicationsLayout";
import ExportPanel from "../components/ExportPanel";
import { SelectionSummary, type Selection } from "../components/ExportSelection";
import { getApplications, type ApplicationSummary, type ApplicationWithInterview } from "../services/applications";
import { byLastUpdate } from "../utils/applications";
import { APPLICATION_STATUS_OPTIONS, selectionFields } from "../utils/exports";
import { MESSAGES } from "../utils/validation";

type ColumnProps = {
	title: string;
	/** Candidatures de la colonne ; celles de « Entretiens » avec leur entretien */
	applications: (ApplicationSummary | ApplicationWithInterview)[];
	emptyMessage: string;
	selection: Selection;
};

function Column({ title, applications, emptyMessage, selection }: ColumnProps) {
	const titleId = useId();
	return (
		<section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4 sm:p-5">
			<div className="flex items-center justify-between gap-2.5">
				<h2 id={titleId} className="text-base sm:text-lg font-bold text-ink">{title}</h2>
				<span className="rounded-full bg-[#dbeafe] px-2.5 py-0.5 text-xs font-bold text-[#1d4ed8]">
					<span className="sr-only">Nombre de candidatures : </span>
					{applications.length}
				</span>
			</div>
			{applications.length === 0 ? (
				<p className="rounded-xl border border-dashed border-[#d1d5db] bg-surface p-6 text-center text-sm text-[#6b7280]">{emptyMessage}</p>
			) : (
				<ul className="flex flex-col gap-3">
					{byLastUpdate(applications).map((application) => (
						<ApplicationCard key={application.id} application={application} interview={"interview" in application ? application.interview : undefined} selection={selection} />
					))}
				</ul>
			)}
		</section>
	);
}

// Suivi des candidatures de l'étudiant (JOB-033, ETU-14)
export default function ApplicationsPage() {
	const [columns, setColumns] = useState<{ inProgress: ApplicationSummary[]; completed: ApplicationSummary[]; interviews: ApplicationWithInterview[] } | null>(null);
	const [error, setError] = useState("");
	const [noSession, setNoSession] = useState(false);
	// Incrémenté par « Réessayer » pour relancer la requête
	const [attempt, setAttempt] = useState(0);
	// Candidatures cochées, pour l'export
	const [picked, setPicked] = useState<number[]>([]);
	const selection = { ids: picked, onChange: setPicked };

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

	// Une candidature avec un entretien proposé passe de « En cours » à « Entretiens »
	const withInterview = new Set(columns?.interviews.map(({ id }) => id));

	return (
		<ApplicationsLayout className="max-w-[1236px] gap-6 px-5 py-7 md:px-10 md:py-8">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Candidatures</h1>
					<p className="text-sm sm:text-base text-[#6b7280]">Suivez vos candidatures en temps réel et faites le bilan de votre recherche.</p>
				</div>
				{columns && (
					<div className="flex items-center gap-2 text-xs sm:text-sm">
						<span className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-3 py-1.5 font-medium text-[#6b7280]">
							Total : <strong className="text-ink">{columns.inProgress.length + columns.completed.length}</strong>
						</span>
					</div>
				)}
			</div>

			{columns && columns.inProgress.length + columns.completed.length > 0 && (
				<div className="flex flex-col gap-3">
					<ExportPanel
						url="/api/applications/export"
						fields={[{ kind: "checkboxes", key: "status", label: "Statut des candidatures", options: APPLICATION_STATUS_OPTIONS }, ...selectionFields("ids", picked, ["candidature", "candidatures"])]}
					/>
					<SelectionSummary selection={selection} noun={["candidature", "candidatures"]} />
				</div>
			)}

			{error && <LoadError message={error} onRetry={() => setAttempt(attempt + 1)} />}
			{!error && columns === null && <LoadingMessage />}
			{columns && (
				<div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
					<Column title="En cours" applications={columns.inProgress.filter(({ id }) => !withInterview.has(id))} emptyMessage="Aucune candidature en cours." selection={selection} />
					<Column title="Entretiens" applications={columns.interviews} emptyMessage="Aucun entretien proposé pour le moment." selection={selection} />
					<Column title="Finalisées" applications={columns.completed} emptyMessage="Aucune candidature finalisée." selection={selection} />
				</div>
			)}
		</ApplicationsLayout>
	);
}
