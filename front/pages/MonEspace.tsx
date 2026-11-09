import { useEffect, useState } from "react";

import Button from "../components/Button";
import CvSection from "../components/CvSection";
import PhotoSection from "../components/PhotoSection";
import StudentNavbar from "../components/StudentNavbar";
import TextSection from "../components/TextSection";
import { getProfile, updatePhoto, updateProfile, type Profile, type ProfileError, type ProfileResult } from "../services/profile";
import { MESSAGES, REQUEST_ERRORS } from "../utils/validation";

// TODO JOB-008: align the maximum lengths with the API
const DESCRIPTION_MAX_LENGTH = 500;
const POSITION_MAX_LENGTH = 100;

export default function MonEspace() {
	// null while the profile loads
	const [profile, setProfile] = useState<Profile | null>(null);
	const [loadError, setLoadError] = useState<ProfileError | null>(null);
	// Incremented by "Réessayer" to load the profile again
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		// Ignores the answer if the page was left in the meantime
		let ignore = false;
		getProfile().then((result) => {
			if (ignore) return;
			if (result.ok) setProfile(result.profile);
			else setLoadError(result.reason === "invalid" ? "server" : result.reason);
		});
		return () => {
			ignore = true;
		};
	}, [attempt]);

	const retry = () => {
		setLoadError(null);
		setAttempt(attempt + 1);
	};

	// Keeps the profile returned by the API. Returns the message to display, or "" when saved.
	const applyResult = (result: ProfileResult) => {
		if (result.ok) {
			setProfile(result.profile);
			return "";
		}
		// Only one field is sent at a time, so the first error is the one of that field
		if (result.reason === "invalid") return Object.values(result.fields)[0] ?? MESSAGES.serverError;
		return REQUEST_ERRORS[result.reason];
	};

	return (
		<div className="min-h-dvh bg-[#f0f0f0]">
			<header className="p-4">
				<StudentNavbar />
			</header>

			<main className="px-4 pt-6 pb-16 md:px-6 md:pt-9">
				<div className="mx-auto flex max-w-4xl flex-col gap-6 rounded-3xl bg-surface p-5 shadow-[0_4px_12px_rgba(0,0,0,0.06)] md:p-8">
					<div className="text-center">
						<h1 className="text-3xl font-bold">Mon espace</h1>
						<p className="mt-1 text-[#6c7386]">Gérez votre profil, votre CV et vos informations personnelles.</p>
					</div>

					{loadError && (
						<div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-6 text-center">
							<p>{REQUEST_ERRORS[loadError]}</p>
							{loadError === "unauthenticated" ? <Button to="/login">Se connecter</Button> : <Button onClick={retry}>Réessayer</Button>}
						</div>
					)}

					{!profile && !loadError && (
						// Gray blocks with the shape of the sections, while the profile loads
						<div className="flex flex-col gap-6">
							<p role="status" className="sr-only">
								Chargement de votre profil…
							</p>
							{[1, 2, 3].map((n) => (
								<div key={n} className="h-28 rounded-2xl bg-[#F0F0F0] motion-safe:animate-pulse" />
							))}
						</div>
					)}

					{profile && (
						<>
							<PhotoSection photoUrl={profile.photoUrl} onUpload={async (file) => applyResult(await updatePhoto(file))} />
							<TextSection
								title="Présentation personnelle"
								value={profile.description}
								emptyText="Vous n’avez pas encore rédigé de présentation."
								hint="Un court résumé de votre parcours et de vos atouts, visible sur votre profil et utile aux recruteurs."
								placeholder="Ex. : Étudiant en M2 informatique, je recherche une alternance de 12 mois en développement web."
								maxLength={DESCRIPTION_MAX_LENGTH}
								multiline
								onSave={async (description) => applyResult(await updateProfile({ description }))}
							/>
							<TextSection
								title="Poste recherché"
								value={profile.desiredPosition}
								emptyText="Vous n’avez pas encore indiqué de poste."
								hint="Votre objectif principal : il sert aux suggestions d’offres et aide les entreprises à comprendre votre recherche."
								placeholder="Ex. : Développeur web"
								maxLength={POSITION_MAX_LENGTH}
								onSave={async (desiredPosition) => applyResult(await updateProfile({ desiredPosition }))}
							/>
						</>
					)}

					{/* JOB-019: loads its own data, so it does not wait for the profile */}
					<CvSection />
				</div>
			</main>
		</div>
	);
}
