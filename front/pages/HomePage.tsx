import Button from "../components/Button";


export default function HomePage() {

	return (
		<>
			<h1 className="text-3xl font-bold text-primary text-center"> JobUp </h1>
			<div className="flex justify-center gap-3 mt-3.5">
				<Button children="Inscription" to="/signup" size="lg" />
				<Button children="Connexion" to="/login" size="lg" />
				<Button children="Click ME" onClick={() => alert("clicked")} />
			</div>

		</>
	);
};
