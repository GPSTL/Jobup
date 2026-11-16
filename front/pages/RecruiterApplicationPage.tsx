import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { CandidateAvatar, EducationLine } from "../components/CandidateIdentity";
import ApplicationStatusChip from "../components/ApplicationStatusChip";
import { decideApplication, getRecruiterApplication, type RecruiterApplication, type OfferResult } from "../services/recruiterOffers";
import { formatDate, STATUS } from "../utils/applications";
import { fullName } from "../utils/candidates";
import { focus } from "../utils/searchPageStyles";
import { offerPanel, OfferRequestState, RecruiterOffersLayout } from "./RecruiterOffersPage";

export function RecruiterApplicationContent({ application, onDecision, saving, error }: {
	application: RecruiterApplication;
	onDecision: (status: typeof STATUS.ACCEPTED | typeof STATUS.REFUSED, message: string) => void;
	saving: boolean;
	error: string;
}) {
	const [message, setMessage] = useState("");
	const { offer, candidate, status } = application;
	const pending = status === STATUS.READ || status === STATUS.IN_REVIEW;
	return (
		<>
			<Link className={`w-fit font-semibold text-primary ${focus}`} to={`/recruiter/offers/${offer.id}/applicants`}>Retour aux candidatures de l’offre</Link>
			<h1 className="text-[28px] font-semibold">Candidature — {offer.title}</h1>
			<div className="flex flex-wrap items-center gap-4">
				<CandidateAvatar candidate={candidate} className="size-16 text-xl" />
				<div className="min-w-0 flex-1">
					<h2 className="text-xl font-semibold">{fullName(candidate)}</h2>
					<p className="text-sm text-[#6b7280]"><EducationLine candidate={candidate} /></p>
					<p className="text-sm text-[#6b7280]">Postulée le {formatDate(application.submitted_at)}</p>
				</div>
				<ApplicationStatusChip status={status} />
			</div>
			<Link className={`w-fit font-semibold text-primary ${focus}`} to={`/recruiter/candidates/${candidate.id}?offer=${offer.id}`}>Voir le profil du candidat</Link>
			{application.message && <section className="flex flex-col gap-2"><h2 className="font-semibold">Présentation du candidat</h2><p className="whitespace-pre-line">{application.message}</p></section>}
			{pending ? (
				<section className="flex flex-col gap-4" aria-label="Décision de recrutement">
					<label className="flex flex-col gap-2 font-semibold" htmlFor="decision-message">Message au candidat (facultatif)</label>
					<textarea id="decision-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1024} disabled={saving} rows={4} className={`w-full rounded-xl border border-[#d1d5db] p-3 font-normal ${focus}`} />
					{error && <p role="alert" className="text-red-700">{error}</p>}
					<div className="flex flex-wrap gap-3">
						<button type="button" onClick={() => onDecision(STATUS.ACCEPTED, message)} disabled={saving} className={`rounded-xl bg-[#16803d] px-5 py-3 font-semibold text-white disabled:opacity-50 ${focus}`}>Accepter</button>
						<button type="button" onClick={() => onDecision(STATUS.REFUSED, message)} disabled={saving} className={`rounded-xl border border-[#b91c1c] px-5 py-3 font-semibold text-[#b91c1c] disabled:opacity-50 ${focus}`}>Refuser</button>
					</div>
				</section>
			) : (
				<section className="flex flex-col gap-3" aria-label="Décision enregistrée">
					<p role="status" className="font-semibold">Décision enregistrée : {status === STATUS.ACCEPTED ? "Acceptée" : "Refusée"}</p>
					{application.decision_message && <div><h2 className="font-semibold">Message envoyé au candidat</h2><p className="whitespace-pre-line">{application.decision_message}</p></div>}
					{status === STATUS.ACCEPTED && application.conversation_id && <Link to={`/recruiter/messages/${application.conversation_id}`} className={`w-fit font-semibold text-primary ${focus}`}>Ouvrir la conversation avec le candidat</Link>}
				</section>
			)}
		</>
	);
}

export default function RecruiterApplicationPage() {
	const { id = "" } = useParams();
	const [result, setResult] = useState<{ id: string; response: OfferResult<RecruiterApplication> } | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	useEffect(() => {
		let current = true;
		getRecruiterApplication(id).then((response) => { if (current) setResult({ id, response }); });
		return () => { current = false; };
	}, [id, attempt]);
	const response = result?.id === id ? result.response : null;
	if (response && !response.ok && response.reason === "unauthenticated") return <Navigate to="/login" replace />;
	const decide = async (status: typeof STATUS.ACCEPTED | typeof STATUS.REFUSED, message: string) => {
		if (!response?.ok || saving) return;
		setSaving(true);
		setError("");
		const decision = await decideApplication(response.data.id, status, message);
		setSaving(false);
		if (decision.ok) setResult({ id, response: decision });
		else if (decision.reason === "conflict") {
			setError("Cette candidature a déjà reçu une décision. Actualisez la page.");
		} else setError("Impossible d’enregistrer la décision. Veuillez réessayer.");
	};
	return (
		<RecruiterOffersLayout>
			<section className={offerPanel}>
				{response?.ok ? <RecruiterApplicationContent key={response.data.id} application={response.data} onDecision={decide} saving={saving} error={error} /> : <OfferRequestState result={response} retry={() => { setResult(null); setAttempt((value) => value + 1); }} />}
			</section>
		</RecruiterOffersLayout>
	);
}
