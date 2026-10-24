import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type LoginBannerProps = {
	/** What the visitor gets by logging in */
	children: ReactNode;
};

const button = [
	"whitespace-nowrap rounded-[10px] px-3.5 py-[9px] text-[14px] font-semibold",
	"motion-safe:transition-colors motion-safe:duration-200",
	// White outline: a blue one would not show on the banner
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface",
].join(" ");

// Blue banner of the public pages, inviting logged-out visitors to log in or sign up
export default function LoginBanner({ children }: LoginBannerProps) {
	return (
		<section
			aria-label="Connexion"
			className="flex flex-col gap-4 rounded-[18px] bg-primary py-4 pr-5 pl-7 font-sans leading-[normal] text-on-primary md:flex-row md:items-center"
		>
			<div className="flex items-center gap-4">
				<span className="flex size-10 shrink-0 items-center justify-center rounded-[20px] bg-surface/20">
					<img src="/static/img/lock.svg" alt="" width={20} height={20} />
				</span>
				<p className="text-[17px] font-medium">{children}</p>
			</div>
			<div className="flex gap-4 md:ml-auto">
				<Link to="/login" className={`${button} border-[1.5px] border-surface hover:bg-surface/15`}>
					Se connecter
				</Link>
				<Link to="/signup" className={`${button} bg-surface text-primary hover:bg-surface/90`}>
					Créer un compte
				</Link>
			</div>
		</section>
	);
}
