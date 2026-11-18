import { useState } from "react";

import Button from "./Button";
import Field from "./Field";
import { SchoolRequestState, useSchoolData } from "./SchoolLayout";
import { cancelSchoolRequest, getStudentSchool, requestSchool, type StudentSchool } from "../services/school";
import { REQUEST_ERRORS } from "../utils/validation";

// Section « Mon école » de « Mon espace » : l'étudiant demande son rattachement, que l'école valide.
// Une fois rattaché, l'école suit ses candidatures et son contrat.
export default function SchoolSection() {
	const { result, retry, setData } = useSchoolData(getStudentSchool);
	const [schoolId, setSchoolId] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const change = async (action: Promise<Awaited<ReturnType<typeof getStudentSchool>>>) => {
		if (saving) return;
		setSaving(true);
		setError("");
		const answer = await action;
		setSaving(false);
		if (answer.ok) setData(answer.data);
		else setError(answer.reason === "conflict" ? "Votre situation a changé : actualisez la page." : REQUEST_ERRORS[answer.reason === "unauthenticated" || answer.reason === "network" ? answer.reason : "server"]);
	};

	const state: StudentSchool | null = result?.ok ? result.data : null;
	const pending = state?.request?.status === "pending";
	return (
		<section id="school" aria-labelledby="student-school" className="flex scroll-mt-6 flex-col gap-3 rounded-2xl border border-[#e5e7eb] bg-surface p-5 shadow-xs sm:p-6">
			<h2 id="student-school" className="text-lg font-semibold">Mon école</h2>
			<SchoolRequestState result={result} retry={retry} />
			{state?.school && <p className="text-sm text-[#6b7280]">Vous êtes rattaché à <strong className="text-ink">{state.school.name}</strong> : elle suit vos candidatures et l’avancement de votre contrat.</p>}
			{state && !state.school && pending && (
				<>
					<p role="status" className="text-sm text-[#6b7280]">Votre demande à <strong className="text-ink">{state.request?.school.name}</strong> est en attente de validation.</p>
					<Button variant="outline" onClick={() => change(cancelSchoolRequest())} disabled={saving} className="w-fit">Annuler la demande</Button>
				</>
			)}
			{state && !state.school && !pending && (
				<form
					noValidate
					onSubmit={(event) => {
						event.preventDefault();
						if (schoolId) void change(requestSchool(Number(schoolId)));
					}}
					className="flex flex-col gap-3"
				>
					{state.request && <p role="status" className="text-sm text-[#b91c1c]">{state.request.school.name} n’a pas accepté votre demande. Vous pouvez en faire une nouvelle.</p>}
					{state.schools.length === 0 ? (
						<p className="text-sm text-[#6b7280]">Aucune école n’est encore inscrite sur Jobup.</p>
					) : (
						<>
							<p className="text-sm text-[#6b7280]">Choisissez votre école : une fois la demande acceptée, elle pourra suivre votre recherche d’alternance.</p>
							<Field id="school-choice" label="École">
								<select value={schoolId} onChange={(event) => setSchoolId(event.target.value)}>
									<option value="">Choisir mon école</option>
									{state.schools.map((school) => (
										<option key={school.id} value={school.id}>{school.name}</option>
									))}
								</select>
							</Field>
							<Button type="submit" disabled={saving || !schoolId} className="w-fit">Envoyer la demande</Button>
						</>
					)}
				</form>
			)}
			{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
		</section>
	);
}
