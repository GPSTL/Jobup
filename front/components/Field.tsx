import { cloneElement, type ReactElement } from "react";

type FieldProps = {
	id: string;
	label: string;
	error?: string;
	/** Champ en rouge sans message sous lui (ex. : message commun affiché sous un autre champ) */
	invalid?: boolean;
	/** The <input> or <select> */
	children: ReactElement<{ className?: string }>;
	/** Extra classes on the wrapper, e.g. spacing */
	className?: string;
};

const control = [
	"h-[34px] w-full rounded-[10px] border-[1.5px] bg-[#F0F0F0] px-3 text-sm text-ink outline-none",
	"transition-colors duration-150",
].join(" ");

const states = {
	normal: "border-transparent focus:border-primary focus:bg-surface",
	error: "border-[#DC2626]",
};

// Label + input/select + error message under it
export default function Field({ id, label, error, invalid = false, children, className = "" }: FieldProps) {
	const isInvalid = invalid || !!error;
	return (
		<div className={`flex flex-col gap-[5px] ${className}`}>
			<label htmlFor={id} className="text-xs leading-[15px]">
				{label}
			</label>
			{cloneElement(children, {
				id,
				"aria-invalid": isInvalid,
				"aria-describedby": error ? `${id}-error` : undefined,
				className: `${control} ${isInvalid ? states.error : states.normal} ${children.props.className ?? ""}`,
			} as object)}
			{error && (
				<p id={`${id}-error`} className="text-xs leading-3 font-medium text-[#DC2626]">
					{error}
				</p>
			)}
		</div>
	);
}
