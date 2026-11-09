import { useCallback, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

import ConversationList, { type ConversationItem } from "../components/ConversationList";
import MessageThread from "../components/MessageThread";
import Navbar, { NavbarLink } from "../components/Navbar";
import { getStudentConversations, type ConversationSummary } from "../services/conversations";
import { avatarColor, conversationDate, interlocutorInitials, interlocutorName, lastMessagePreview } from "../utils/conversations";
import { MESSAGES } from "../utils/validation";

// Délai avant de lancer la recherche, pour ne pas appeler l'API à chaque touche
const SEARCH_DELAY = 300;

const toItem = (conversation: ConversationSummary): ConversationItem => ({
	id: conversation.id,
	to: `/messages/${conversation.id}`,
	name: interlocutorName(conversation),
	initials: interlocutorInitials(conversation),
	color: avatarColor(conversation.id),
	preview: lastMessagePreview(conversation),
	date: conversationDate(conversation),
});

// Messagerie de l'étudiant : liste et recherche des conversations (JOB-032, ETU-07),
// fil de la conversation sélectionnée et envoi (JOB-034, ETU-15).
export default function MessagesPage() {
	const { id } = useParams();
	const selectedId = id === undefined ? undefined : Number(id);
	const [query, setQuery] = useState("");
	const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
	const [error, setError] = useState("");
	const [noSession, setNoSession] = useState(false);
	// Incrémenté par « Réessayer » pour relancer la requête
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		// Ignore une réponse arrivée après une nouvelle saisie
		let ignore = false;
		const timer = setTimeout(() => {
			setConversations(null);
			setError("");
			getStudentConversations(query).then((result) => {
				if (ignore) return;
				if (result.ok) setConversations(result.conversations);
				else if (result.reason === "noSession") setNoSession(true);
				else setError(result.reason === "network" ? MESSAGES.networkError : MESSAGES.serverError);
			});
		}, query.trim() ? SEARCH_DELAY : 0);
		return () => {
			ignore = true;
			clearTimeout(timer);
		};
	}, [query, attempt]);

	// Après un envoi ou une réception : met à jour l'aperçu et l'ordre de la liste sans afficher son chargement
	const refreshList = useCallback(() => {
		getStudentConversations(query).then((result) => {
			if (result.ok) setConversations(result.conversations);
		});
	}, [query]);

	// Session expirée pendant la consultation : retour à la connexion
	if (noSession) return <Navigate to="/login" replace />;

	const selected = conversations?.find((conversation) => conversation.id === selectedId);

	return (
		<div className="flex h-dvh flex-col gap-6 bg-[#f0f0f0] px-4 pt-4 pb-6 md:px-6 md:pt-6">
			<header>
				{/* TODO JOB-017 : remplacer par StudentNavbar quand elle sera sur main */}
				<Navbar>
					<div className="ml-auto flex gap-6 md:gap-10">
						<NavbarLink to="/student">Mon espace</NavbarLink>
						<NavbarLink to="/companies" className="hidden md:inline-flex">Entreprises</NavbarLink>
						<NavbarLink to="/offers" className="hidden md:inline-flex">Offres</NavbarLink>
						<NavbarLink to="/messages">Messages</NavbarLink>
					</div>
				</Navbar>
			</header>

			<main className="mx-auto flex min-h-0 w-full max-w-[1236px] flex-1 overflow-hidden rounded-[24px] bg-white text-[#111827] shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
				{/* Sur mobile, la liste ou la conversation ouverte occupe tout l'écran */}
				<div className={`w-full flex-col border-[#e5e7eb] md:flex md:w-[330px] md:shrink-0 md:border-r ${selectedId === undefined ? "flex" : "hidden"}`}>
					<ConversationList
						title="Messages"
						searchLabel="Rechercher une conversation"
						query={query}
						onQueryChange={setQuery}
						items={conversations && conversations.map(toItem)}
						error={error}
						onRetry={() => setAttempt(attempt + 1)}
						selectedId={selectedId}
					/>
				</div>

				<section aria-label="Conversation" className={`min-w-0 flex-1 flex-col bg-[#f9fafb] md:flex ${selectedId === undefined ? "hidden" : "flex"}`}>
					{selectedId === undefined ? (
						<p className="m-auto px-6 text-center text-[15px] text-[#6b7280]">Sélectionnez une conversation pour l’afficher.</p>
					) : (
						<MessageThread
							key={selectedId}
							conversationId={selectedId}
							name={selected ? interlocutorName(selected) : "Conversation"}
							initials={selected ? interlocutorInitials(selected) : ""}
							color={avatarColor(selectedId)}
							backTo="/messages"
							onActivity={refreshList}
						/>
					)}
				</section>
			</main>
		</div>
	);
}
