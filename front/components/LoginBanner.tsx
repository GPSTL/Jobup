import type { ReactNode } from "react";

import LockIcon from "./LockIcon";
import { useSession } from "./SessionProvider";

type LoginBannerProps = {
	/** What the visitor gets by logging in */
	children: ReactNode;
};

// Informational reminder; login and signup actions are in the navigation bar.
export default function LoginBanner({ children }: LoginBannerProps) {
	const { user, loading } = useSession();
	if (user || loading) return null;
	return (
		<section
			aria-label="Connexion"
			className="rounded-[18px] bg-primary py-4 pr-5 pl-7 font-sans leading-[normal] text-on-primary"
		>
			<div className="flex items-center gap-4">
				<span className="flex size-10 shrink-0 items-center justify-center rounded-[20px] bg-surface/20">
					<LockIcon width={20} height={20} />
				</span>
				<p className="text-[17px] font-medium">{children}</p>
			</div>
		</section>
	);
}
