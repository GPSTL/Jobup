import type { ReactNode } from "react";

type SectionCardProps = {
	title: string;
	/** Content of the card, on the left */
	children: ReactNode;
	/** Button on the right of the card, e.g. "Modifier". Below the content on small screens. */
	action?: ReactNode;
};

// Block of the "Mon espace" page: a title, then a gray card with the content and its action
export default function SectionCard({ title, children, action }: SectionCardProps) {
	return (
		<section className="flex flex-col gap-2">
			<h2 className="text-lg font-semibold">{title}</h2>
			<div className="flex flex-col gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 sm:flex-row sm:items-center">
				<div className="min-w-0 flex-1">{children}</div>
				{action && <div className="shrink-0">{action}</div>}
			</div>
		</section>
	);
}
