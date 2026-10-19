import Button from "../components/Button";


export default () => {

	return (
		<>
			<h1 className="text-3xl font-bold text-blue-600"> JobUp </h1>
			<Button children="click" onClick={() => alert("Ameli")} size="lg" />
			<Button children="click" to="/inscription" size="md" />
		</>
	);
};
