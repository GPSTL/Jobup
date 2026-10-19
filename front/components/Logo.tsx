import { Link } from "react-router-dom";

// Size from the Figma export: 86 × 29 px, so only the height is set.
export default function Logo() {
	return (
		<Link
			to="/"
			aria-label="JobUp, accueil"
			className="shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
		>
			<img src="/static/img/JobUp_logo.svg" alt="" className="h-7" />
		</Link>
	);
}
