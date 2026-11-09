import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type FormEvent, type KeyboardEvent } from "react";
import { Link, Navigate } from "react-router-dom";

import ArrowLeftIcon from "./ArrowLeftIcon";
import Button from "./Button";
import { getMessages, sendMessage, type Message } from "../services/messages";
import { groupByDay, formatTime, MAX_MESSAGE_LENGTH, mergeMessages, REFRESH_DELAY, SEND_ERRORS, type MessageDay } from "../utils/messages";
import { MESSAGES } from "../utils/validation";

export type MessageTransport = { getMessages: typeof getMessages; sendMessage: typeof sendMessage };
const defaultTransport: MessageTransport = { getMessages, sendMessage };

type MessageThreadProps = {
	variant?: "student" | "recruiter";
	presence?: ReactNode;
	/** Injected only for explicitly labelled frontend previews/tests. */
	transport?: MessageTransport;
	conversationId: number;
	/** Interlocuteur, préparé par la page comme pour la liste */
	name: string;
	initials: string;
	color: string;
	/** Retour à la liste, sur téléphone */
	backTo: string;
	/** Un message a été envoyé ou reçu : la page met à jour l'aperçu de la liste */
	onActivity: () => void;
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// Les messages groupés par jour, chaque jour introduit par sa pastille de date (maquette Messages)
export function ThreadMessages({ days, name, variant = "student" }: { days: MessageDay[]; name: string; variant?: "student" | "recruiter" }) {
	return days.map((day) => (
		<section key={day.key} aria-label={day.label} className="flex flex-col gap-4">
			<h3 className="flex justify-center">
				<span className={`rounded-full px-3 py-1 text-[12px] font-medium text-[#6b7280] ${variant === "recruiter" ? "border border-gray-200 bg-white" : "bg-[#e5e7eb]"}`}>{day.label}</span>
			</h3>
			<ul className="flex flex-col gap-4">
				{day.messages.map((message) => (
					<li key={message.id} className={`flex ${message.from_me ? "justify-end" : ""}`}>
						<div
							className={`flex flex-col gap-1 rounded-[18px] px-4 py-3 ${variant === "recruiter" ? `w-fit max-w-[min(440px,85%)] ${message.from_me ? "bg-primary text-on-primary" : "border border-gray-200 bg-white text-[#111827]"}` : `max-w-[min(700px,85%)] ${message.from_me ? "rounded-br-[4px] bg-[#dcedfc]" : "rounded-bl-[4px] bg-[#e5e7eb]"}`}`}
						>
							<p className="text-[14px] leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]">
								<span className="sr-only">{message.from_me ? "Vous" : name} : </span>
								{message.body}
							</p>
							<time dateTime={message.created_at} className={`text-[11px] ${variant === "recruiter" ? message.from_me ? "text-white/90" : "text-gray-500" : "self-end text-[#6b7280]"}`}>
								{formatTime(message.created_at)}
							</time>
						</div>
					</li>
				))}
			</ul>
		</section>
	));
}

// Fil d'une conversation et champ d'envoi (JOB-034, ETU-15). À monter avec key={conversationId}.
export default function MessageThread({ conversationId, name, initials, color, backTo, onActivity, presence, transport = defaultTransport, variant = "student" }: MessageThreadProps) {
	const [messages, setMessages] = useState<Message[] | null>(null);
	const [hasMore, setHasMore] = useState(false);
	const [loadError, setLoadError] = useState("");
	const [noSession, setNoSession] = useState(false);
	// Incrémenté par « Réessayer » pour relancer le chargement
	const [attempt, setAttempt] = useState(0);
	const [olderLoading, setOlderLoading] = useState(false);
	const [olderError, setOlderError] = useState("");
	const [draft, setDraft] = useState("");
	const [sending, setSending] = useState(false);
	const [sendError, setSendError] = useState("");

	const scroller = useRef<HTMLDivElement>(null);
	// Défilement à appliquer après l'affichage : en bas, ou à la même distance du bas après l'ajout de l'historique
	const pendingScroll = useRef<"bottom" | { fromBottom: number } | null>(null);
	// Dernier message affiché : point de départ du rafraîchissement
	const lastId = useRef(0);
	const loaded = messages !== null;

	useEffect(() => {
		lastId.current = messages?.[messages.length - 1]?.id ?? 0;
	}, [messages]);

	useLayoutEffect(() => {
		const element = scroller.current;
		const scroll = pendingScroll.current;
		if (!element || !scroll) return;
		element.scrollTop = scroll === "bottom" ? element.scrollHeight : element.scrollHeight - scroll.fromBottom;
		pendingScroll.current = null;
	}, [messages]);

	const isNearBottom = () => {
		const element = scroller.current;
		return !element || element.scrollHeight - element.scrollTop - element.clientHeight < 80;
	};

	useEffect(() => {
		let ignore = false;
		setMessages(null);
		setLoadError("");
		transport.getMessages(conversationId).then((result) => {
			if (ignore) return;
			if (result.ok) {
				pendingScroll.current = "bottom";
				setMessages(result.messages);
				setHasMore(result.hasMore);
			} else if (result.reason === "noSession") setNoSession(true);
			else if (result.reason === "notFound") setLoadError("Cette conversation est introuvable.");
			else setLoadError(result.reason === "network" ? MESSAGES.networkError : MESSAGES.serverError);
		});
		return () => {
			ignore = true;
		};
	}, [conversationId, attempt, transport]);

	// Nouveaux messages : vérification régulière tant que l'onglet est visible, et dès qu'il le redevient.
	// En cas d'échec, la vérification suivante reprend depuis le même message : rien n'est perdu.
	useEffect(() => {
		if (!loaded) return;
		let ignore = false;
		const refresh = () => {
			if (document.visibilityState !== "visible") return;
			transport.getMessages(conversationId, { after: lastId.current }).then((result) => {
				if (ignore) return;
				if (!result.ok) {
					if (result.reason === "noSession") setNoSession(true);
					return;
				}
				if (result.messages.length === 0) return;
				if (isNearBottom()) pendingScroll.current = "bottom";
				setMessages((current) => mergeMessages(current ?? [], result.messages));
				onActivity();
			});
		};
		const timer = setInterval(refresh, REFRESH_DELAY);
		document.addEventListener("visibilitychange", refresh);
		return () => {
			ignore = true;
			clearInterval(timer);
			document.removeEventListener("visibilitychange", refresh);
		};
	}, [loaded, conversationId, onActivity, transport]);

	const loadOlder = async () => {
		const first = messages?.[0];
		if (!first) return;
		setOlderLoading(true);
		setOlderError("");
		const result = await transport.getMessages(conversationId, { before: first.id });
		setOlderLoading(false);
		if (result.ok) {
			const element = scroller.current;
			if (element) pendingScroll.current = { fromBottom: element.scrollHeight - element.scrollTop };
			setMessages((current) => mergeMessages(current ?? [], result.messages));
			setHasMore(result.hasMore);
		} else if (result.reason === "noSession") setNoSession(true);
		else setOlderError("Les messages précédents n’ont pas pu être chargés.");
	};

	const body = draft.trim();
	const tooLong = body.length > MAX_MESSAGE_LENGTH;
	const canSend = body !== "" && !tooLong && !sending && loaded;

	const send = async (event: FormEvent) => {
		event.preventDefault();
		if (!canSend) return;
		setSending(true);
		setSendError("");
		const result = await transport.sendMessage(conversationId, body);
		setSending(false);
		if (result.ok) {
			// La saisie n'est vidée qu'une fois le message enregistré : en cas d'échec, elle reste pour réessayer
			setDraft("");
			pendingScroll.current = "bottom";
			setMessages((current) => mergeMessages(current ?? [], [result.message]));
			onActivity();
		} else if (result.reason === "noSession") setNoSession(true);
		else setSendError(SEND_ERRORS[result.reason]);
	};

	// Entrée envoie, Maj+Entrée va à la ligne
	const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
			event.preventDefault();
			event.currentTarget.form?.requestSubmit();
		}
	};

	// Session expirée pendant la consultation : retour à la connexion
	if (noSession) return <Navigate to="/login" replace />;

	return (
		<>
			<div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-[#e5e7eb] bg-white px-4">
				<Link to={backTo} className={`rounded-sm text-primary md:hidden ${focus}`}>
					<ArrowLeftIcon width={20} height={20} />
					<span className="sr-only">Retour aux conversations</span>
				</Link>
				{initials && (
					<span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white ${color}`}>
						{initials}
					</span>
				)}
				<div className="min-w-0"><h2 className="truncate text-[16px] font-semibold">{name}</h2>{presence}</div>
			</div>

			{/* relative : les textes sr-only (en position absolue) restent dans la zone qui défile au lieu d'allonger la page */}
			<div ref={scroller} role="log" aria-label={`Messages avec ${name}`} className={`relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 ${variant === "recruiter" ? "bg-[#f8f9fb] md:p-6" : "bg-[#f0f0f0]"}`}>
				{!loaded && !loadError && <p aria-busy="true" className="m-auto text-[15px] text-[#6b7280]">Chargement des messages…</p>}
				{loadError && (
					<div role="alert" className="m-auto flex flex-col items-center gap-3 text-center">
						<p className="text-[15px]">{loadError}</p>
						<Button onClick={() => setAttempt(attempt + 1)}>Réessayer</Button>
					</div>
				)}
				{hasMore && (
					<div className="flex flex-col items-center gap-2">
						<button
							type="button"
							onClick={loadOlder}
							disabled={olderLoading}
							className={`rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-primary disabled:cursor-wait disabled:opacity-70 ${focus}`}
						>
							{olderLoading ? "Chargement…" : "Afficher les messages précédents"}
						</button>
						{olderError && <p role="alert" className="text-[13px] text-[#DC2626]">{olderError}</p>}
					</div>
				)}
				{messages?.length === 0 && (
					<p className="m-auto px-6 text-center text-[15px] text-[#6b7280]">Aucun message pour l’instant. Écrivez le premier ci-dessous.</p>
				)}
				{messages && <ThreadMessages days={groupByDay(messages)} name={name} variant={variant} />}
			</div>

			<form onSubmit={send} className="shrink-0 border-t border-[#e5e7eb] bg-white px-4 py-4">
				{sendError && <p role="alert" className="mb-2 text-[13px] font-medium text-[#DC2626]">{sendError}</p>}
				{tooLong && (
					<p id="new-message-length" className="mb-2 text-[13px] font-medium text-[#DC2626]">
						{MAX_MESSAGE_LENGTH} caractères maximum ({body.length} actuellement).
					</p>
				)}
				<div className="flex items-end gap-3">
					<label htmlFor="new-message" className="sr-only">Écrire un message à {name}</label>
					<textarea
						id="new-message"
						rows={1}
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						onKeyDown={onKeyDown}
						readOnly={sending}
						placeholder={variant === "recruiter" ? `Écrivez à ${name.split(" ")[0]}…` : "Écrire un message..."}
						aria-invalid={tooLong}
						aria-describedby={tooLong ? "new-message-help new-message-length" : "new-message-help"}
						className={`max-h-32 min-h-10 min-w-0 flex-1 resize-none px-4 py-2.5 text-[14px] leading-5 outline-none [field-sizing:content] placeholder:text-[#9ca3af] focus:ring-2 focus:ring-primary ${variant === "recruiter" ? "rounded-xl border border-gray-200 bg-[#f8f9fb]" : "rounded-[20px] bg-[#f3f4f6]"}`}
					/>
					<p id="new-message-help" className="sr-only">Entrée pour envoyer, Maj+Entrée pour aller à la ligne.</p>
					<button
						type="submit"
						disabled={!canSend}
						aria-label={sending ? "Envoi en cours" : "Envoyer le message"}
						className={`flex size-11 shrink-0 cursor-pointer items-center justify-center disabled:cursor-default disabled:opacity-40 ${variant === "recruiter" ? "rounded-xl bg-primary text-on-primary enabled:hover:bg-primary/90" : "rounded-full hover:bg-[#f3f4f6] disabled:hover:bg-transparent"} ${focus}`}
					>
						{variant === "recruiter" ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13" /></svg> : <img src="/static/img/messages/send.svg" width={24} height={24} alt="" />}
					</button>
				</div>
			</form>
		</>
	);
}
