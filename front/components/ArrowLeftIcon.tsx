import type { SVGProps } from "react";

export default function ArrowLeftIcon(props: SVGProps<SVGSVGElement>) {
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
			<path d="M15.8333 10H4.16667" />
			<path d="M10 15.8333L4.16667 10L10 4.16667" />
		</svg>
	);
}
