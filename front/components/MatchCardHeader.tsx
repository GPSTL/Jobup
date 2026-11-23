import type { ReactNode } from "react";

export default function MatchCardHeader({ label, metadata, percentage }: {
	label: string;
	metadata?: ReactNode;
	percentage?: number;
}) {
	return (
		<header className="match-card-header px-5 py-4 sm:px-6 sm:py-5">
			<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
				<span className="rounded-lg bg-white/10 px-2.5 py-1 font-semibold text-white">{label}</span>
				{metadata}
			</div>
			{percentage !== undefined && (
				<p className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
					<strong className="match-card-score text-5xl leading-none font-extrabold tracking-tight tabular-nums">{percentage}%</strong>
					<span className="text-sm font-medium">de compatibilité</span>
				</p>
			)}
		</header>
	);
}
