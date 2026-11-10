import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";

import CandidatePresence from "../components/CandidatePresence";
import ConversationList, { type ConversationItem } from "../components/ConversationList";
import MessageThread from "../components/MessageThread";
import RecruiterNavbar from "../components/RecruiterNavbar";
import { getRecruiterConversations, type RecruiterConversation } from "../services/recruiterConversations";
import { avatarColor, formatConversationDate } from "../utils/conversations";
import { MESSAGES } from "../utils/validation";

// The list also brings the presence of the candidates: refreshed while the tab is visible
const LIST_REFRESH_DELAY = 30_000;

const candidateName = ({ candidate }: RecruiterConversation) => `${candidate.first_name} ${candidate.last_name}`;
const candidateInitials = ({ candidate }: RecruiterConversation) =>
	`${candidate.first_name[0] ?? ""}${candidate.last_name[0] ?? ""}`.toUpperCase();

const toItem = (conversation: RecruiterConversation): ConversationItem => ({
	id: conversation.id,
	to: `/recruiter/messages/${conversation.id}`,
	name: candidateName(conversation),
	initials: candidateInitials(conversation),
	color: avatarColor(conversation.id),
	preview: conversation.last_message
		? `${conversation.last_message.from_me ? "Vous : " : ""}${conversation.last_message.body}`
		: "Aucun message pour l’instant",
	date: conversation.last_message ? formatConversationDate(conversation.last_message.created_at) : "",
});

// Messages of the recruiter (JOB-039, REC-05): their conversations with the candidates, the thread
// of the selected one (shared with the student, JOB-034) and the presence of the candidate.
// Search on the server and starting a conversation ("+"): JOB-041.
export default function RecruiterMessagesPage() {
	const { id } = useParams();
	const [params] = useSearchParams();
	const selectedId = id === undefined ? undefined : Number(id);
	const [conversations, setConversations] = useState<RecruiterConversation[] | null>(null);
	const [error, setError] = useState("");
	const [noSession, setNoSession] = useState(false);
	const [query, setQuery] = useState("");
	// Incremented by « Réessayer » to load the list again
	const [attempt, setAttempt] = useState(0);

	// Also called by the thread after a message is sent or received, to update the list.
	// isCurrent ignores a response that arrives after leaving the page.
	const load = useCallback(async (isCurrent: () => boolean = () => true) => {
		const result = await getRecruiterConversations();
		if (!isCurrent()) return;
		if (result.ok) {
			setConversations(result.conversations);
			setError("");
		} else if (result.reason === "noSession") setNoSession(true);
		else setError(result.reason === "network" ? MESSAGES.networkError : MESSAGES.serverError);
	}, []);

	useEffect(() => {
		let current = true;
		const isCurrent = () => current;
		void load(isCurrent);
		const timer = setInterval(() => {
			if (document.visibilityState === "visible") void load(isCurrent);
		}, LIST_REFRESH_DELAY);
		return () => {
			current = false;
			clearInterval(timer);
		};
	}, [load, attempt]);

	// Session expired during the visit: back to the login
	if (noSession) return <Navigate to="/login" replace />;

	const selected = conversations?.find((conversation) => conversation.id === selectedId);
	// « Message » on the profile of a candidate (JOB-035) opens their conversation
	const candidateId = params.get("candidate");
	const target = candidateId ? conversations?.find((conversation) => conversation.candidate.id === Number(candidateId)) : undefined;
	if (id === undefined && target) return <Navigate to={`/recruiter/messages/${target.id}`} replace />;
	// Candidate without a conversation: starting one is JOB-041 ("+")
	const noConversation = id === undefined && Boolean(candidateId) && conversations !== null && target === undefined;
	// Small screens show one panel: the list, or the conversation (or why there is none)
	const showThread = selectedId !== undefined || noConversation;
	const search = query.trim().toLocaleLowerCase("fr");
	const filtered = conversations?.filter((conversation) => candidateName(conversation).toLocaleLowerCase("fr").includes(search));

	return (
		<div className="flex h-dvh flex-col gap-6 bg-[#f0f0f0] px-4 pt-4 pb-6 md:gap-10 md:px-6 md:pt-14 md:pb-12">
			<header className="mx-auto w-full max-w-[1236px]">
				<RecruiterNavbar />
			</header>
			<main className="mx-auto flex min-h-0 w-full max-w-[1236px] flex-1 overflow-hidden rounded-[24px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] md:max-h-[680px]">
				<div className={`min-h-0 w-full flex-col border-gray-200 md:flex md:w-[330px] md:shrink-0 md:border-r ${showThread ? "hidden" : "flex"}`}>
					<ConversationList
						title="Candidats"
						searchLabel="Rechercher un candidat"
						query={query}
						onQueryChange={setQuery}
						items={filtered ? filtered.map(toItem) : null}
						error={error}
						onRetry={() => {
							setError("");
							setAttempt((value) => value + 1);
						}}
						selectedId={selectedId}
					/>
				</div>
				<section aria-label="Conversation" className={`min-h-0 min-w-0 flex-1 flex-col md:flex ${showThread ? "flex" : "hidden"}`}>
					{selectedId === undefined ? (
						<p className="m-auto p-6 text-center text-gray-500">
							{noConversation ? (
								<>
									Vous n’avez pas encore de conversation avec ce candidat.{" "}
									<Link to="/recruiter/messages" className="text-primary underline">
										Voir vos conversations
									</Link>
								</>
							) : (
								"Sélectionnez une conversation pour l’afficher."
							)}
						</p>
					) : !Number.isSafeInteger(selectedId) || selectedId <= 0 ? (
						<p role="alert" className="m-auto p-6">
							Conversation introuvable.{" "}
							<Link to="/recruiter/messages" className="text-primary underline">
								Retour
							</Link>
						</p>
					) : (
						<MessageThread
							key={selectedId}
							variant="recruiter"
							conversationId={selectedId}
							name={selected ? candidateName(selected) : "Conversation"}
							initials={selected ? candidateInitials(selected) : ""}
							color={avatarColor(selectedId)}
							backTo="/recruiter/messages"
							onActivity={load}
							presence={<CandidatePresence lastSeen={selected?.last_seen_at ?? null} />}
						/>
					)}
				</section>
			</main>
		</div>
	);
}
