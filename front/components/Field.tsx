import { cloneElement, type ReactElement } from "react";

type FieldProps = {
	id: string;
	label: string;
	error?: string;
	/** The <input> or <select> */
	children: ReactElement<{ className?: string }>;
	/** Extra classes on the wrapper, e.g. spacing */
	className?: string;
};

const control = [
	"h-[34px] w-full rounded-[10px] border px-3 text-sm text-ink outline-none",
	"transition-colors duration-150",
].join(" ");

const states = {
	normal: "border-transparent bg-[#F0F0F0] focus:border-primary focus:bg-surface",
	error: "border-[#D92D20] bg-[#FEF3F2]",
};

// Label + input/select + error message under it
export default function Field({ id, label, error, children, className = "" }: FieldProps) {
	return (
		<div className={`flex flex-col gap-[5px] ${className}`}>
			<label htmlFor={id} className="text-xs leading-[15px]">
				{label}
			</label>
			{cloneElement(children, {
				id,
				"aria-invalid": !!error,
				"aria-describedby": error ? `${id}-error` : undefined,
				className: `${control} ${error ? states.error : states.normal} ${children.props.className ?? ""}`,
			} as object)}
			{error && (
				<p id={`${id}-error`} className="text-xs leading-[15px] text-[#D92D20]">
					{error}
				</p>
			)}
		</div>
	);
}
