import React from "react";

type Props = {
	id: string;
	label: string;
	error?: string;
	children: React.ReactElement<any>;
};

// Label + input/select + error message under it
export default ({ id, label, error, children }: Props) => (
	<div className={error ? "ju-field ju-field--error" : "ju-field"}>
		<label htmlFor={id}>{label}</label>
		{React.cloneElement(children, {
			id,
			"aria-invalid": !!error,
			"aria-describedby": error ? `${id}-error` : undefined,
		})}
		{error && (
			<p id={`${id}-error`} className="ju-field-error">
				{error}
			</p>
		)}
	</div>
);
