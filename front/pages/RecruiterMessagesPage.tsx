import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import RecruiterNavbar from "../components/RecruiterNavbar";
import ConversationList from "../components/ConversationList";
import MessageThread from "../components/MessageThread";
import CandidatePresence from "../components/CandidatePresence";
import { getRecruiterConversations, type RecruiterConversation } from "../services/recruiterConversations";
import { avatarColor, formatConversationDate } from "../utils/conversations";
import { createRecruiterDemo } from "../demo/recruiterMessages";

export default function RecruiterMessagesPage() {
	const { id } = useParams();
	const [params] = useSearchParams();
	const preview = params.get("demo") === "1";
	const suffix = preview ? "?demo=1" : "";
	const selectedId = id === undefined ? undefined : Number(id);
	const [demo] = useState(createRecruiterDemo);
	const [conversations, setConversations] = useState<RecruiterConversation[] | null>(null);
	const [error, setError] = useState("");
	const [noSession, setNoSession] = useState(false);
	const [query, setQuery] = useState("");
	const [attempt, setAttempt] = useState(0);
	const refresh = useCallback(async () => {
		if (preview) { setConversations([...demo.conversations]); return; }
		const result = await getRecruiterConversations();
		if (result.ok) { setConversations(result.conversations); setError(""); }
		else if (result.reason === "noSession") setNoSession(true);
		else setError(result.reason === "unavailable" ? "La liste des conversations recruteur n’est pas encore disponible." : "Impossible de charger les conversations. Réessayez.");
	}, [preview, demo]);
	useEffect(() => {
		let ignore = false;
		// Refresh only while mounted; the shared thread handles message polling.
		const load = async () => {
			if (preview) { if (!ignore) setConversations([...demo.conversations]); return; }
			const result = await getRecruiterConversations();
			if (ignore) return;
			if (result.ok) { setConversations(result.conversations); setError(""); }
			else if (result.reason === "noSession") setNoSession(true);
			else setError(result.reason === "unavailable" ? "La liste des conversations recruteur n’est pas encore disponible." : "Impossible de charger les conversations. Réessayez.");
		};
		void load();
		const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30_000);
		return () => { ignore = true; clearInterval(timer); };
	}, [preview, demo, attempt]);
	if (noSession) return <Navigate to="/login" replace />;
	const selected = conversations?.find((item) => item.id === selectedId);
	const candidateId = params.get("candidate");
	const target = candidateId ? conversations?.find((item) => item.candidate.id === Number(candidateId)) : undefined;
	if (id === undefined && target) return <Navigate to={`/recruiter/messages/${target.id}${suffix}`} replace />;
	const name = selected ? `${selected.candidate.first_name} ${selected.candidate.last_name}` : "Conversation";
	const filtered = conversations?.filter((item) => `${item.candidate.first_name} ${item.candidate.last_name}`.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr")));
	return (
		<div className="flex h-dvh flex-col gap-6 bg-[#f0f0f0] px-4 pt-4 pb-6 md:gap-10 md:px-6 md:pt-14 md:pb-12">
			<header className="mx-auto w-full max-w-[1236px]"><RecruiterNavbar /></header>
			{preview && <p role="status" className="text-center text-sm text-gray-600">Démonstration : messages fictifs, envois non transmis et effacés au rechargement. Présence simulée avec expiration après 2 minutes.</p>}
			<main className="mx-auto flex min-h-0 w-full max-w-[1236px] flex-1 overflow-hidden rounded-[24px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] md:max-h-[680px]">
				<div className={`min-h-0 w-full flex-col border-gray-200 md:flex md:w-[330px] md:shrink-0 md:border-r ${selectedId === undefined ? "flex" : "hidden"}`}>
					<ConversationList title="Candidats" searchLabel="Rechercher un candidat" query={query} onQueryChange={setQuery} items={filtered?.map((item) => ({ id: item.id, to: `/recruiter/messages/${item.id}${suffix}`, name: `${item.candidate.first_name} ${item.candidate.last_name}`, initials: `${item.candidate.first_name[0] ?? ""}${item.candidate.last_name[0] ?? ""}`, color: preview && item.id === 1 ? "bg-violet-600" : avatarColor(item.id), preview: item.last_message ? `${item.last_message.from_me ? "Vous : " : ""}${item.last_message.body}` : "Aucun message pour l’instant", date: item.last_message ? formatConversationDate(item.last_message.created_at) : "" })) ?? null} error={error} onRetry={() => setAttempt((value) => value + 1)} selectedId={selectedId} />
					{!preview && error && <Link to="/recruiter/messages?demo=1" className="m-4 text-primary underline">Voir la démonstration</Link>}
				</div>
				<section aria-label="Conversation" className={`min-h-0 min-w-0 flex-1 flex-col md:flex ${selectedId === undefined ? "hidden" : "flex"}`}>
					{selectedId === undefined ? <p className="m-auto p-6 text-center text-gray-500">{candidateId && conversations && !target ? "Aucune conversation existante avec ce candidat. La création de conversation reste à connecter à JOB-041." : "Sélectionnez une conversation pour l’afficher."}</p> : !Number.isSafeInteger(selectedId) || selectedId <= 0 ? <p role="alert" className="m-auto p-6">Conversation introuvable. <Link to={`/recruiter/messages${suffix}`} className="text-primary underline">Retour</Link></p> : <MessageThread variant="recruiter" key={`${preview}-${selectedId}`} conversationId={selectedId} name={name} initials={selected ? `${selected.candidate.first_name[0] ?? ""}${selected.candidate.last_name[0] ?? ""}` : ""} color={preview && selectedId === 1 ? "bg-violet-600" : avatarColor(selectedId)} backTo={`/recruiter/messages${suffix}`} onActivity={refresh} transport={preview ? demo.transport : undefined} presence={<CandidatePresence lastSeen={selected?.last_seen_at ?? null} />} />}
				</section>
			</main>
		</div>
	);
}
