import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import ArrowLeftIcon from "../components/ArrowLeftIcon";
import ConversationList, { type ConversationItem } from "../components/ConversationList";
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

// Messagerie de l'étudiant (JOB-032, ETU-07) : liste et recherche des conversations.
// Le fil de la conversation sélectionnée est traité par JOB-034.
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
						<>
							<div className="flex items-center gap-3 border-b border-[#e5e7eb] bg-white px-5 py-4">
								<Link to="/messages" className="rounded-sm text-primary focus-visible:outline-2 focus-visible:outline-primary md:hidden">
									<ArrowLeftIcon width={20} height={20} />
									<span className="sr-only">Retour aux conversations</span>
								</Link>
								<h2 className="truncate text-[17px] font-semibold">
									{selected ? interlocutorName(selected) : "Conversation"}
								</h2>
							</div>
							{/* TODO JOB-034 : afficher le fil de messages et le champ d'envoi */}
							<p className="m-auto px-6 text-center text-[15px] text-[#6b7280]">Le fil de discussion sera bientôt disponible.</p>
						</>
					)}
				</section>
			</main>
		</div>
	);
}
