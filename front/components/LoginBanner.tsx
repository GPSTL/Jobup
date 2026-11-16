import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import LockIcon from "./LockIcon";

type LoginBannerProps = {
	/** What the visitor gets by logging in */
	children: ReactNode;
	/** Optional calls to action shown in designs that put account links in the banner. */
	actions?: boolean;
};

// Informational reminder; login and signup actions are in the navigation bar.
export default function LoginBanner({ children, actions = false }: LoginBannerProps) {
	return (
		<section
			aria-label="Connexion"
			className="rounded-[18px] bg-primary py-4 pr-5 pl-7 font-sans leading-[normal] text-on-primary"
		>
			<div className="flex flex-wrap items-center gap-4">
				<span className="flex size-10 shrink-0 items-center justify-center rounded-[20px] bg-surface/20">
					<LockIcon width={20} height={20} />
				</span>
				<p className="min-w-0 flex-1 text-[17px] font-medium">{children}</p>
				{actions && <div className="ml-auto flex flex-wrap items-center gap-3">
					<Link to="/login" state={{ studentReturnTo: "/offers" }} className="rounded-[10px] border-[1.5px] border-white px-[14px] py-[9px] text-[14px] font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Se connecter</Link>
					<Link to="/signup" className="rounded-[10px] bg-white px-[14px] py-[9px] text-[14px] font-semibold text-primary hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Créer un compte</Link>
				</div>}
			</div>
		</section>
	);
}
