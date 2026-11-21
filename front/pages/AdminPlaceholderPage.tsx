import AdminNavbar from "../components/AdminNavbar";

type AdminPlaceholderPageProps = {
	title: string;
	description: string;
	/** What the page will hold, shown while it is empty */
	empty: string;
};

// Page of the administration not built yet: its place in the navigation, an empty state
export default function AdminPlaceholderPage({ title, description, empty }: AdminPlaceholderPageProps) {
	return (
		<div className="min-h-dvh bg-[#f8fafc] px-4 pt-4 pb-16 text-ink md:px-6 md:pt-6">
			<header><AdminNavbar /></header>
			<main className="mx-auto mt-8 max-w-[1236px] rounded-2xl border border-[#e5e7eb] bg-surface px-5 py-7 shadow-xs md:px-10 md:py-8">
				<div className="mb-6 flex flex-col gap-1">
					<h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
					<p className="text-sm text-[#6b7280]">{description}</p>
				</div>
				<p role="status" className="py-16 text-center text-sm text-[#6b7280]">{empty}</p>
			</main>
		</div>
	);
}
