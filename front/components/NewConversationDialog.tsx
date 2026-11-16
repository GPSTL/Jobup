import { useEffect, useRef, useState } from "react";

import Button from "./Button";
import {
	searchConversationRecipients,
	startRecruiterConversation,
	type ConversationRecipient,
} from "../services/recruiterConversations";

type Props = {
	onClose: () => void;
	onConversationCreated: (id: number) => void;
};

export default function NewConversationDialog({ onClose, onConversationCreated }: Props) {
	const [query, setQuery] = useState("");
	const [recipients, setRecipients] = useState<ConversationRecipient[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [startingId, setStartingId] = useState<number | null>(null);
	const [settledQuery, setSettledQuery] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);
	const dialogRef = useRef<HTMLElement>(null);
	// Keep the latest onClose without re-running the focus/keydown effect on every parent render
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useEffect(() => {
		previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		inputRef.current?.focus();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onCloseRef.current();
				return;
			}
			if (event.key !== "Tab") return;
			const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
				'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
			);
			if (!focusable?.length) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			previousFocusRef.current?.focus();
		};
	}, []);

	useEffect(() => {
		const trimmed = query.trim();
		if (trimmed.length < 2) {
			setRecipients([]);
			setError("");
			setLoading(false);
			return;
		}
		setRecipients([]);
		const controller = new AbortController();
		const timer = window.setTimeout(() => {
			setLoading(true);
			setError("");
			void searchConversationRecipients(trimmed, controller.signal).then((result) => {
				if (result.ok) {
					setRecipients(result.recipients);
					setSettledQuery(trimmed);
				} else setError(result.reason === "noSession" ? "Votre session a expiré." : "Impossible de rechercher les candidats. Réessayez.");
			}).catch(() => {
				if (controller.signal.aborted) return;
				setError("Impossible de rechercher les candidats. Réessayez.");
			}).finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		}, 300);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [query]);

	async function selectRecipient(recipient: ConversationRecipient) {
		setStartingId(recipient.id);
		setError("");
		const result = await startRecruiterConversation(recipient.id);
		setStartingId(null);
		if (result.ok) onConversationCreated(result.id);
		else setError(result.reason === "notFound" ? "Ce candidat n’est plus disponible." : "Impossible d’ouvrir cette conversation. Réessayez.");
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => {
			if (event.target === event.currentTarget) onClose();
		}}>
			<section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="new-conversation-title" className="flex max-h-[min(80dvh,640px)] w-full max-w-lg flex-col rounded-2xl bg-white p-5 shadow-xl">
				<header className="flex items-center justify-between gap-3">
					<h2 id="new-conversation-title" className="text-xl font-semibold">Nouvelle conversation</h2>
					<button type="button" aria-label="Fermer" onClick={onClose} className="rounded-full px-3 py-1 text-2xl leading-none text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-primary">×</button>
				</header>
				<label className="mt-4 flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 focus-within:border-primary">
					<span className="sr-only">Rechercher un candidat par son nom</span>
					<input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom du candidat (2 caractères minimum)" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
				</label>
				<div className="mt-3 min-h-32 flex-1 overflow-y-auto" aria-live="polite">
					{query.trim().length < 2 && <p className="py-5 text-sm text-gray-500">Saisissez au moins deux caractères pour rechercher.</p>}
					{loading && <p className="py-5 text-sm text-gray-500" aria-busy="true">Recherche des candidats…</p>}
					{error && <p role="alert" className="py-5 text-sm text-red-700">{error}</p>}
					{!loading && !error && query.trim().length >= 2 && settledQuery === query.trim() && recipients.length === 0 && <p className="py-5 text-sm text-gray-500">Aucun candidat trouvé.</p>}
					{recipients.length > 0 && <ul className="divide-y divide-gray-100">
						{recipients.map((recipient) => (
							<li key={recipient.id}>
								<button type="button" disabled={startingId !== null} onClick={() => void selectRecipient(recipient)} className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60">
									<span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-800">{`${recipient.first_name[0] ?? ""}${recipient.last_name[0] ?? ""}`.toUpperCase()}</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate font-medium">{recipient.first_name} {recipient.last_name}</span>
										<span className="block text-xs text-gray-500">{recipient.has_conversation ? "Conversation existante · Reprendre" : "Démarrer une conversation"}</span>
									</span>
									<span aria-hidden="true" className="text-sm text-primary">{startingId === recipient.id ? "Ouverture…" : "Ouvrir"}</span>
								</button>
							</li>
						))}
					</ul>}
				</div>
				<footer className="mt-4 flex justify-end">
					<Button variant="outline" onClick={onClose}>Annuler</Button>
				</footer>
			</section>
		</div>
	);
}
