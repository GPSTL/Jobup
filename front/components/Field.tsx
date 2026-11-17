import { cloneElement, type ReactElement } from "react";

type FieldProps = {
	id: string;
	label: string;
	error?: string;
	/** Champ en rouge sans message sous lui (ex. : message commun affiché sous un autre champ) */
	invalid?: boolean;
	/** The <input>, <select> or <textarea> */
	children: ReactElement<{ className?: string }>;
	/** Extra classes on the wrapper, e.g. spacing */
	className?: string;
};

const control = [
	"min-h-11 w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm sm:text-base text-ink outline-none",
	"transition-colors duration-150 placeholder:text-[#9ca3af]",
].join(" ");

const states = {
	normal: "border-[#d1d5db] focus:border-primary focus:ring-2 focus:ring-primary/20",
	error: "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20",
};

// Label + input/select + error message under it
export default function Field({ id, label, error, invalid = false, children, className = "" }: FieldProps) {
	const isInvalid = invalid || !!error;
	return (
		<div className={`flex flex-col gap-1.5 ${className}`}>
			<label htmlFor={id} className="text-sm font-medium text-ink">
				{label}
			</label>
			{cloneElement(children, {
				id,
				"aria-invalid": isInvalid,
				"aria-describedby": error ? `${id}-error` : undefined,
				className: `${control} ${isInvalid ? states.error : states.normal} ${children.props.className ?? ""}`,
			} as object)}
			{error && (
				<p id={`${id}-error`} className="text-xs font-medium text-[#DC2626]">
					{error}
				</p>
			)}
		</div>
	);
}
