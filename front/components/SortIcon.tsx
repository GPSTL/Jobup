import type { SVGProps } from "react";

export default function SortIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			{...props}
		>
			<path d="M7.33333 10.6664L4.66667 13.3328L2 10.6664M4.66667 13.3328V2.6672M7.33333 2.6672H14M7.33333 5.3336H12M7.33333 8H10" />
		</svg>
	);
}
