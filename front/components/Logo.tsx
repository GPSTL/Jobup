import { Link } from "react-router-dom";

type LogoProps = {
	/** Image size classes; the aspect ratio is preserved. */
	className?: string;
};

export default function Logo({ className = "h-7" }: LogoProps) {
	return (
		<Link
			to="/"
			aria-label="JobUp, accueil"
			className="shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
		>
			<img src="/static/img/JobUp_logo.svg" alt="" className={className} />
		</Link>
	);
}
