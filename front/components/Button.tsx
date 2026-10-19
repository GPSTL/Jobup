import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type ButtonProps = {
	children: ReactNode;
	/** Adresse interne : le bouton devient un lien (ex. "/inscription"). */
	to?: string;
	onClick?: () => void;
	/** "submit" pour envoyer un formulaire. Sans effet sur un lien. */
	type?: "button" | "submit";
	/** "md" : barre de navigation, "lg" : boutons de la page d'accueil. */
	size?: "md" | "lg";
	/** Classes en plus */
	className?: string;
};

const base = [
	"inline-flex items-center justify-center rounded-full cursor-pointer",
	"bg-primary text-on-primary font-medium",
	// Focus au clavier : contour bleu séparé du bouton par une bande blanche,
	// pour rester visible sur fond blanc comme sur la photo de l'accueil.
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
