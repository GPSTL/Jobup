import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import Button from "./Button";
import SearchIcon from "./SearchIcon";

// Une ligne de la liste, préparée par la page : la même liste sert à l'étudiant (JOB-032)
// et au recruteur (JOB-041), qui n'affichent pas les mêmes informations.
export type ConversationItem = {
	id: number;
	/** Lien vers le fil de la conversation (JOB-034) */
	to: string;
	name: string;
	initials: string;
	/** Classe de couleur de la pastille */
	color: string;
	preview: string;
	date: string;
};

type ConversationListProps = {
	/** « Messages » pour l'étudiant, « Candidats » pour le recruteur */
	title: string;
	searchLabel: string;
	query: string;
	onQueryChange: (query: string) => void;
	/** null pendant le chargement */
	items: ConversationItem[] | null;
	error: string;
	onRetry: () => void;
	selectedId?: number;
	/** Bouton affiché à côté du titre, ex. « + » pour démarrer une conversation côté recruteur (JOB-041) */
	action?: ReactNode;
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary";

// Liste des conversations avec recherche (maquette Messages, colonne de gauche)
export default function ConversationList({ title, searchLabel, query, onQueryChange, items, error, onRetry, selectedId, action }: ConversationListProps) {
	const searching = query.trim() !== "";

	return (
		<section aria-labelledby="conversations-title" className="flex min-h-0 flex-col">
			<div className="flex items-center justify-between gap-3 px-5 pt-5">
				<h1 id="conversations-title" className="text-[22px] font-semibold">{title}</h1>
				{action}
			</div>
			<label className="mx-4 mt-4 flex items-center gap-2.5 rounded-[12px] border border-[#d1d5db] px-3.5 py-2.5 focus-within:border-primary">
				<SearchIcon width={18} height={18} className="shrink-0 text-gray-500" />
				<span className="sr-only">{searchLabel}</span>
				<input
					type="search"
					value={query}
					onChange={(e) => onQueryChange(e.target.value)}
					placeholder={searchLabel}
					className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#9ca3af]"
				/>
			</label>

			<div className="mt-3 min-h-0 flex-1 overflow-y-auto pb-3">
				{items === null && !error && (
					<p aria-busy="true" className="px-5 py-6 text-[15px] text-[#6b7280]">Chargement des conversations…</p>
				)}
				{error && (
					<div role="alert" className="flex flex-col items-start gap-3 px-5 py-6">
						<p className="text-[15px]">{error}</p>
						<Button onClick={onRetry}>Réessayer</Button>
					</div>
				)}
				{items?.length === 0 && (
					<p role="status" className="px-5 py-6 text-[15px] text-[#6b7280]">
						{searching ? "Aucune conversation ne correspond à votre recherche." : "Vous n’avez pas encore de conversation."}
					</p>
				)}
				{items && items.length > 0 && (
					<ul>
						{items.map((item) => {
							const selected = item.id === selectedId;
							return (
								<li key={item.id}>
									<Link
										to={item.to}
										aria-current={selected ? "page" : undefined}
										className={`flex items-center gap-3 px-4 py-3.5 ${selected ? "bg-[#dae8ff]" : "hover:bg-[#f3f4f6]"} ${focus}`}
									>
										<span aria-hidden="true" className={`flex size-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white ${item.color}`}>
											{item.initials}
										</span>
										<span className="flex min-w-0 flex-1 flex-col gap-0.5">
											<span className="flex items-baseline justify-between gap-2">
												<span className="truncate text-[15px] font-semibold">{item.name}</span>
												<span className="shrink-0 text-[12px] text-[#6b7280]">{item.date}</span>
											</span>
											<span className="truncate text-[13px] text-[#6b7280]">{item.preview}</span>
										</span>
									</Link>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</section>
	);
}
