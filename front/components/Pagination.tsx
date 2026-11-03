type PaginationProps = {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	variant?: "default" | "recruiter";
};

const item = "flex size-8 shrink-0 items-center justify-center rounded-md text-base";
const button = `${item} cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-40`;

export default function Pagination({ currentPage, totalPages, onPageChange, variant = "default" }: PaginationProps) {
	if (totalPages <= 1) return null;

	const current = Math.max(1, Math.min(currentPage, totalPages));
	const start = Math.max(1, Math.min(current - 2, totalPages - 4));
	const end = Math.min(totalPages, start + 4);
	const pages: (number | string)[] = [];
	if (start > 1) {
		pages.push(1);
		if (start > 2) pages.push("previous-gap");
	}
	for (let page = start; page <= end; page++) pages.push(page);
	if (end < totalPages) {
		if (end < totalPages - 1) pages.push("next-gap");
		pages.push(totalPages);
	}

	return (
		<nav aria-label="Pagination" className={`flex flex-wrap items-center justify-center gap-1 text-ink ${variant === "recruiter" ? "recruiter-pagination" : ""}`}>
			<button type="button" aria-label="Page précédente" disabled={current === 1} onClick={() => onPageChange(current - 1)} className={button}>
				{variant === "recruiter" ? <img src="/static/img/recruiter/previous.svg" alt="" /> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
					<path d="m15 4-8 8 8 8" strokeLinecap="round" strokeLinejoin="round" />
				</svg>}
			</button>
			{pages.map((page) => typeof page === "number" ? (
				<button key={page} type="button" aria-label={`Page ${page}`} aria-current={page === current ? "page" : undefined} onClick={() => onPageChange(page)} className={`${button} ${page === current ? "bg-primary text-on-primary" : "hover:bg-primary/10"}`}>
					{page}
				</button>
			) : <span key={page} className={item}>…</span>)}
			<button type="button" aria-label="Page suivante" disabled={current === totalPages} onClick={() => onPageChange(current + 1)} className={button}>
				{variant === "recruiter" ? <img src="/static/img/recruiter/next.svg" alt="" /> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
					<path d="m9 4 8 8-8 8" strokeLinecap="round" strokeLinejoin="round" />
				</svg>}
			</button>
		</nav>
	);
}
