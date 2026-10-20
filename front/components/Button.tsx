import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type ButtonProps = {
	children: ReactNode;
	/** Internal path: the button becomes a link (e.g. "/signup"). */
	to?: string;
	onClick?: () => void;
	/** "submit" to submit a form. No effect on a link. */
	type?: "button" | "submit";
	/** "md": navigation bar, "lg": home page buttons. */
	size?: "md" | "lg";
	/** Extra classes */
	className?: string;
};

const base = [
	"inline-flex items-center justify-center rounded-full cursor-pointer",
	"bg-primary text-on-primary font-medium",
	// Keyboard focus: blue outline separated from the button by a white band,
	// so it stays visible on a white background as well as on the home page photo.
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
	"focus-visible:ring-2 focus-visible:ring-surface",
].join(" ");

const sizes = {
	md: "px-4 py-1 text-base",
	lg: "px-6 py-2 text-lg",
};

export default function Button({
	children,
	to,
	onClick,
	type = "button",
	size = "md",
	className = "",
}: ButtonProps) {
	const classes = `${base} ${sizes[size]} ${className}`;

	if (to) {
		return (
			<Link to={to} onClick={onClick} className={classes}>
				{children}
			</Link>
		);
	}

	return (
		<button type={type} onClick={onClick} className={classes}>
			{children}
		</button>
	);
}
