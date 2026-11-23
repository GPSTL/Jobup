import { useEffect, useState } from "react";

const STORAGE_KEY = "jobup-theme";
type Theme = "light" | "dark";

function initialTheme(): Theme {
	if (typeof document === "undefined") return "light";
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === "light" || saved === "dark") return saved;
	} catch { /* Fall back to light when storage is unavailable. */ }
	return "light";
}

export default function ThemeToggle() {
	const [theme, setTheme] = useState<Theme>(initialTheme);
	useEffect(() => {
		document.documentElement.dataset.theme = theme;
		document.documentElement.style.colorScheme = theme;
		window.dispatchEvent(new CustomEvent("jobup-theme-change", { detail: theme }));
	}, [theme]);

	const isLight = theme === "light";
	return (
		<button
			type="button"
			className="theme-toggle !static !z-auto !inline-flex !h-10 !w-auto shrink-0 items-center gap-2 !rounded-full !px-3.5 !text-sm !shadow-none"
			onClick={() => {
				const nextTheme = isLight ? "dark" : "light";
				setTheme(nextTheme);
				try { localStorage.setItem(STORAGE_KEY, nextTheme); } catch { /* Storage is optional. */ }
			}}
			aria-label={isLight ? "Activer le mode sombre" : "Activer le mode clair"}
			title={isLight ? "Passer en mode sombre" : "Passer en mode clair"}
		>
			{isLight ? (
				<>
					<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
					</svg>
					<span className="hidden sm:inline">Sombre</span>
				</>
			) : (
				<>
					<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<circle cx="12" cy="12" r="4" />
						<path d="M12 2v2M12 20v2m-7.07-14.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2m-17.07 7.07 1.41-1.41m11.32-11.32 1.41-1.41" />
					</svg>
					<span className="hidden sm:inline">Clair</span>
				</>
			)}
		</button>
	);
}
