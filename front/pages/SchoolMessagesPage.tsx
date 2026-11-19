import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import CandidatePresence from "../components/CandidatePresence";
import ConversationList, { type ConversationItem } from "../components/ConversationList";
import MessageThread from "../components/MessageThread";
import SchoolNavbar from "../components/SchoolNavbar";
import { getRecruiterConversations, type RecruiterConversation } from "../services/recruiterConversations";
import { avatarColor, formatConversationDate } from "../utils/conversations";
import { MESSAGES } from "../utils/validation";

// The list also brings the presence of the students: refreshed while the tab is visible
const LIST_REFRESH_DELAY = 30_000;

// Student suspended by an administrator (ADM-03): the conversation stays readable, greyed and closed
const SUSPENDED = "Compte suspendu";

const studentName = ({ candidate }: RecruiterConversation) => `${candidate.first_name} ${candidate.last_name}`;
const studentInitials = ({ candidate }: RecruiterConversation) =>
	`${candidate.first_name[0] ?? ""}${candidate.last_name[0] ?? ""}`.toUpperCase();

const toItem = (conversation: RecruiterConversation): ConversationItem => ({
	id: conversation.id,
	to: `/school/messages/${conversation.id}`,
	name: studentName(conversation),
	initials: studentInitials(conversation),
	color: avatarColor(conversation.id),
	preview: conversation.last_message
		? `${conversation.last_message.from_me ? "Vous : " : ""}${conversation.last_message.body}`
		: "Aucun message pour l’instant",
	date: conversation.last_message ? formatConversationDate(conversation.last_message.created_at) : "",
	closed: conversation.suspended ? SUSPENDED : undefined,
});

// Messages of the school: its conversations with the students, same thread as theirs (JOB-034).
// A conversation is started from the page of a student.
export default function SchoolMessagesPage() {
	const { id } = useParams();
	const selectedId = id === undefined ? undefined : Number(id);
	const [conversations, setConversations] = useState<RecruiterConversation[] | null>(null);
	const [error, setError] = useState("");
	const [noSession, setNoSession] = useState(false);
	const [query, setQuery] = useState("");

	// Also called by the thread after a message is sent or received, to update the list.
	// isCurrent ignores a response that arrives after leaving the page.
	const load = useCallback(async (isCurrent: () => boolean = () => true) => {
		const result = await getRecruiterConversations("/api/school/conversations");
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
	}, [load]);

	// Session expired during the visit: back to the login
	if (noSession) return <Navigate to="/login" replace />;

	const selected = conversations?.find((conversation) => conversation.id === selectedId);
	// Small screens show one panel: the list, or the conversation
	const showThread = selectedId !== undefined;
	const search = query.trim().toLocaleLowerCase("fr");
	const filtered = conversations?.filter((conversation) => studentName(conversation).toLocaleLowerCase("fr").includes(search));

	return (
		<div className="flex h-dvh flex-col gap-6 bg-[#f8fafc] px-4 pt-4 pb-6 text-ink md:px-6 md:pt-6">
			<header>
				<SchoolNavbar />
			</header>
			<main className="mx-auto flex min-h-0 w-full max-w-[1236px] flex-1 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-surface shadow-xs">
				<div className={`min-h-0 w-full flex-col border-[#e5e7eb] md:flex md:w-[330px] md:shrink-0 md:border-r ${showThread ? "hidden" : "flex"}`}>
					<ConversationList
						title="Étudiants"
						searchLabel="Rechercher un étudiant"
						query={query}
						onQueryChange={setQuery}
						items={filtered ? filtered.map(toItem) : null}
						error={error}
						onRetry={() => {
							setError("");
							void load();
						}}
						selectedId={selectedId}
					/>
				</div>
				<section aria-label="Conversation" className={`min-h-0 min-w-0 flex-1 flex-col md:flex ${showThread ? "flex" : "hidden"}`}>
					{selectedId === undefined ? (
						<p className="m-auto p-6 text-center text-sm text-[#6b7280]">
							Sélectionnez une conversation pour l’afficher, ou écrivez à un étudiant depuis sa{" "}
							<Link to="/school/students" className="text-primary underline">
								fiche de suivi
							</Link>
							.
						</p>
					) : !Number.isSafeInteger(selectedId) || selectedId <= 0 ? (
						<p role="alert" className="m-auto p-6 text-sm">
							Conversation introuvable.{" "}
							<Link to="/school/messages" className="text-primary underline">
								Retour
							</Link>
						</p>
					) : (
						<MessageThread
							key={selectedId}
							variant="recruiter"
							conversationId={selectedId}
							name={selected ? studentName(selected) : "Conversation"}
							initials={selected ? studentInitials(selected) : ""}
							color={selected?.suspended ? "bg-[#d1d5db]" : avatarColor(selectedId)}
							backTo="/school/messages"
							onActivity={load}
							closed={selected?.suspended ? "Le compte de cet étudiant est suspendu : vous ne pouvez plus lui écrire." : undefined}
							presence={selected?.suspended ? <p className="text-xs font-medium text-[#e00000]">{SUSPENDED}</p> : <CandidatePresence lastSeen={selected?.last_seen_at ?? null} />}
						/>
					)}
				</section>
			</main>
		</div>
	);
}
