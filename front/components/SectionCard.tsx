import type { ReactNode } from "react";

type SectionCardProps = {
	title: string;
	/** Content of the card, on the left */
	children: ReactNode;
	/** Button on the right of the card, e.g. "Modifier". Below the content on small screens. */
	action?: ReactNode;
};

// Modular card block of the "Mon espace" dashboard
export default function SectionCard({ title, children, action }: SectionCardProps) {
	return (
		<section className="flex flex-col gap-3 rounded-2xl border border-[#e5e7eb] bg-surface p-5 shadow-xs sm:p-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="text-lg font-bold text-ink">{title}</h2>
				{action && <div className="shrink-0">{action}</div>}
			</div>
			<div className="min-w-0 text-sm sm:text-base">{children}</div>
		</section>
	);
}
