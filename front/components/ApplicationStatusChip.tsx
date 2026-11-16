import { statusChip } from "../utils/applications";

// Pastille du statut d'une candidature, sur la liste et le détail
export default function ApplicationStatusChip({ status }: { status: number }) {
	const { label, className } = statusChip(status);
	return (
		<span className={`shrink-0 rounded-full px-2.5 py-[5px] text-[13px] font-semibold whitespace-nowrap ${className}`}>
			{label}
		</span>
	);
}
