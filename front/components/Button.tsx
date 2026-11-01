import type { ReactNode, Ref } from "react";
import { Link } from "react-router-dom";

type ButtonProps = {
	children: ReactNode;
	/** Internal path: the button becomes a link (e.g. "/signup"). */
	to?: string;
	onClick?: () => void;
	/** "submit" to submit a form. No effect on a link. */
	type?: "button" | "submit";
	/** "md": navigation bar and forms, "lg": home page buttons. */
	size?: "md" | "lg";
	/** "primary": main action. "secondary": light blue, e.g. "Modifier". "outline": white with a border, e.g. "Annuler". */
	variant?: "primary" | "secondary" | "outline";
	/** Gives access to the <button>, e.g. to focus it. No effect on a link. */
	ref?: Ref<HTMLButtonElement>;
	/** Extra classes */
	className?: string;
};

const base = [
	"inline-flex items-center justify-center rounded-full cursor-pointer font-medium",
	// Keyboard focus: blue outline separated from the button by a white band,
	// so it stays visible on a white background as well as on the home page photo.
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
	"focus-visible:ring-2 focus-visible:ring-surface",
].join(" ");

const variants = {
	primary: "bg-primary text-on-primary",
	// Same light blue as the "Pour les étudiants" badge of the student page
	secondary: "bg-[#dae8ff] text-[#1950ff] hover:bg-[#c9dcff]",
	// Inset ring rather than a border, so the button keeps the height of the others
	outline: "bg-surface text-ink inset-ring inset-ring-[#cfd4de] hover:bg-slate-50",
};

const sizes = {
	md: "px-4 py-1 text-base",
	lg: "px-8 py-4 text-xl",
};

export default function Button({
	children,
	to,
	onClick,
	type = "button",
	size = "md",
	variant = "primary",
	ref,
	className = "",
}: ButtonProps) {
	const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

	if (to) {
		return (
			<Link to={to} onClick={onClick} className={classes}>
				{children}
			</Link>
		);
	}

	return (
		<button ref={ref} type={type} onClick={onClick} className={classes}>
			{children}
		</button>
	);
}
