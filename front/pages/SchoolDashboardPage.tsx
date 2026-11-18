import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import Button from "../components/Button";
import Field from "../components/Field";
import NotificationSettings from "../components/NotificationSettings";
import { schoolPanel, SchoolLayout, SchoolRequestState, useSchoolData } from "../components/SchoolLayout";
import { createSchool, getSchool, type SchoolDashboard, type SchoolInfo } from "../services/school";
import { focus } from "../utils/searchPageStyles";
import { REQUEST_ERRORS } from "../utils/validation";

const statCard = "flex flex-col gap-1 rounded-2xl border border-[#e5e7eb] bg-surface p-5 shadow-xs";

// Premier accès d'un compte école : il nomme son établissement, auquel les étudiants demandent ensuite à être rattachés
function SchoolSetup({ onCreated }: { onCreated: (school: SchoolInfo) => void }) {
	const [name, setName] = useState("");
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (saving) return;
		setSaving(true);
		setError("");
		const result = await createSchool(name);
		setSaving(false);
		if (result.ok) onCreated(result.data.school);
		else if ((result.reason === "invalid" || result.reason === "conflict") && result.message) setError(result.message);
		else setError(REQUEST_ERRORS[result.reason === "unauthenticated" || result.reason === "network" ? result.reason : "server"]);
	};

	return (
		<form onSubmit={submit} noValidate className={`${schoolPanel} max-w-xl`}>
			<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Bienvenue sur Jobup</h1>
			<p className="text-sm text-[#6b7280]">Indiquez le nom de votre établissement pour recevoir les demandes de vos étudiants et suivre leurs contrats.</p>
			<Field id="school-name" label="Nom de l’établissement" error={error}>
				<input type="text" value={name} onChange={(event) => setName(event.target.value)} maxLength={128} autoComplete="organization" />
			</Field>
			<Button type="submit" disabled={saving} className="w-fit">Enregistrer</Button>
		</form>
	);
}

function Overview({ school, stats }: Required<SchoolDashboard> & { school: SchoolInfo }) {
	const placed = stats.students ? Math.round((stats.signed / stats.students) * 100) : 0;
	const todo = [
		{ count: stats.pending_requests, label: "demande de rattachement", plural: "demandes de rattachement", to: "/school/students" },
		{ count: stats.contracts_to_validate, label: "contrat à valider", plural: "contrats à valider", to: "/school/contracts" },
	].filter((item) => item.count > 0);

	return (
		<>
			<div className="flex flex-col justify-between gap-4 rounded-3xl border border-[#e5e7eb] bg-surface p-6 shadow-xs sm:flex-row sm:items-center sm:p-8">
				<div>
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{school.name}</h1>
						<span className="rounded-full bg-[#dbeafe] px-2.5 py-0.5 text-xs font-semibold text-[#1d4ed8]">École</span>
					</div>
					<p className="mt-1 text-sm text-[#6b7280]">Suivez vos étudiants jusqu’à la signature de leur contrat.</p>
				</div>
				<div className="flex flex-wrap gap-2.5">
					<Link to="/school/students" className={`rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/90 ${focus}`}>Voir les étudiants</Link>
					<Link to="/school/contracts" className={`rounded-xl border border-[#d1d5db] bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-[#f9fafb] ${focus}`}>Voir les contrats</Link>
				</div>
			</div>

			<dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{[
					["Étudiants rattachés", stats.students],
					["En recherche", stats.searching],
					["Contrats signés", stats.signed],
					["Taux de placement", `${placed} %`],
				].map(([label, value]) => (
					<div key={label} className={statCard}>
						<dt className="text-sm text-[#6b7280]">{label}</dt>
						<dd className="text-3xl font-bold">{value}</dd>
					</div>
				))}
			</dl>

			<section aria-labelledby="school-todo" className={`${schoolPanel} md:px-8`}>
				<h2 id="school-todo" className="text-lg font-semibold">À traiter</h2>
				{todo.length === 0 ? (
					<p className="text-sm text-[#6b7280]">Rien en attente : toutes les demandes et tous les contrats sont à jour.</p>
				) : (
					<ul className="flex flex-col gap-2.5">
						{todo.map(({ count, label, plural, to }) => (
							<li key={to}>
								<Link to={to} className={`flex items-center justify-between gap-3 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] px-5 py-3.5 text-sm font-semibold hover:bg-white ${focus}`}>
									<span>{count} {count === 1 ? label : plural}</span>
									<span className="text-primary">Traiter →</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</section>

			<div className="rounded-2xl border border-[#e5e7eb] bg-surface p-5 shadow-xs sm:p-6">
				<NotificationSettings role="school" />
			</div>
		</>
	);
}

// Accueil de l'école : son établissement, l'avancement de ses étudiants et ce qui attend une décision
export default function SchoolDashboardPage() {
	const { result, retry, setData } = useSchoolData(getSchool);
	const dashboard = result?.ok ? result.data : null;
	return (
		<SchoolLayout>
			<SchoolRequestState result={result} retry={retry} />
			{dashboard && (dashboard.school && dashboard.stats ? (
				<Overview school={dashboard.school} stats={dashboard.stats} />
			) : (
				<SchoolSetup onCreated={(school) => setData({ school, stats: { students: 0, searching: 0, signed: 0, pending_requests: 0, contracts_to_validate: 0 } })} />
			))}
		</SchoolLayout>
	);
}
