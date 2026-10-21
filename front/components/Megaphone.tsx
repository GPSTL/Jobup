import type { SVGProps } from "react";

export default function Megaphone(props: SVGProps<SVGSVGElement>) {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="#007FFF"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
			{...props}
		>
			<path d="M3 11L21 6V18L3 14V11Z" stroke-width="2" 
			strokeLinecap="round" 
			strokeLinejoin="round" 
			stroke="#007FFF" />
			<path d="M11.5997 16.8002C11.4947 17.181 11.3156 17.5374 11.0728 17.8491C10.83 18.1607 10.5282 18.4215 10.1847 18.6165C9.84108 18.8115 9.46245 18.9369 9.07041 18.9856C8.67836 19.0343 8.28056 19.0053 7.89973 18.9002C7.51889 18.7951 7.16248 18.6161 6.85084 18.3733C6.5392 18.1305 6.27844 17.8287 6.08343 17.4851C5.88843 17.1415 5.76301 16.7629 5.71433 16.3709C5.66565 15.9788 5.69467 15.581 5.79973 15.2002" 
			strokeWidth="2" 
			strokeLinecap="round"
			strokeLinejoin="round" 
			stroke="#007FFF" />
		</svg>
	);
}