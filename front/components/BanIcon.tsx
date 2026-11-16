import type { SVGProps } from "react";

// 🚫 : cercle barré, pour écarter un candidat (JOB-038)
export default function BanIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			{...props}
		>
			<circle cx="10" cy="10" r="8.333" />
			<path d="M4.1 4.1L15.9 15.9" />
		</svg>
	);
}
