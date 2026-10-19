type LogoProps = {
	/** Size classes, e.g. "text-[64px]" */
	className?: string;
};

export default function Logo({ className = "" }: LogoProps) {
	return (
		<div className={`font-semibold leading-none whitespace-nowrap ${className}`}>
			Job<span className="font-extrabold text-primary">Up</span>
		</div>
	);
}
