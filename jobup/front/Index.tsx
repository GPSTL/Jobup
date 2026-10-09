import React, { useState } from "react";

export default () => {
	const [counter, setCounter] = useState<number>(0);

	return (
		<p onClick={() => setCounter(counter + 1)}>
			Hello world ! <br /> Client n°{counter}
		</p>
	);
};
