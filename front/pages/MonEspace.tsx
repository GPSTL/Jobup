import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Button from "../components/Button";
import CvSection from "../components/CvSection";
import CvSuggestionsPanel from "../components/CvSuggestionsPanel";
import NotificationSettings from "../components/NotificationSettings";
import PhotoSection from "../components/PhotoSection";
import ProfileCompletion from "../components/ProfileCompletion";
import ProfileDetailsSection from "../components/ProfileDetailsSection";
import SchoolSection from "../components/SchoolSection";
import StudentContractsSection from "../components/StudentContractsSection";
import StudentNavbar from "../components/StudentNavbar";
import TextSection from "../components/TextSection";
import type { User } from "../services/auth";
import { getProfile, updatePhoto, updateProfile, type Profile, type ProfileError, type ProfileResult } from "../services/profile";
import { MESSAGES, REQUEST_ERRORS } from "../utils/validation";

// Same limits as the API (JOB-008)
const DESCRIPTION_MAX_LENGTH = 500;
const POSITION_MAX_LENGTH = 100;

type MonEspaceProps = {
	/** Logged-in student, given by RequireStudent */
	user: User;
};

export default function MonEspace({ user }: MonEspaceProps) {
	// null while the profile loads
	const [profile, setProfile] = useState<Profile | null>(null);
	const [loadError, setLoadError] = useState<ProfileError | null>(null);
	// Incremented by "Réessayer" to load the profile again
	const [attempt, setAttempt] = useState(0);
	// Known once CvSection has loaded the CV
	const [hasCv, setHasCv] = useState<boolean | null>(null);
	// "Pré-remplir mon profil" (JOB-071): each opening reads the CV again
	const [prefill, setPrefill] = useState(0);

	useEffect(() => {
		// Ignores the answer if the page was left in the meantime
		let ignore = false;
		getProfile(user.id).then((result) => {
			if (ignore) return;
			if (result.ok) setProfile(result.profile);
			else setLoadError(result.reason === "invalid" ? "server" : result.reason);
		});
		return () => {
			ignore = true;
		};
	}, [user.id, attempt]);

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

	const initials = `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || "ET";

	return (
		<div className="min-h-dvh bg-[#f8fafc] px-4 pt-4 pb-16 text-ink md:px-6 md:pt-6">
			<header>
				<StudentNavbar />
			</header>

			<main className="mx-auto mt-8 flex max-w-[1236px] flex-col gap-6">
				{/* Student Dashboard Header Banner */}
				<div className="flex flex-col justify-between gap-4 rounded-3xl border border-[#e5e7eb] bg-surface p-6 shadow-xs sm:flex-row sm:items-center sm:p-8">
					<div className="flex items-center gap-4">
						<div aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-on-primary">
							{initials}
						</div>
						<div>
							<div className="flex flex-wrap items-center gap-2">
								<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mon espace</h1>
								<span className="rounded-full bg-[#dbeafe] px-2.5 py-0.5 text-xs font-semibold text-[#1d4ed8]">
									Étudiant
								</span>
							</div>
							<p className="mt-1 text-sm text-[#6b7280]">
								Gérez votre profil, votre CV et vos préférences pour postuler en un clic.
							</p>
							{profile && (
								<div className="mt-3 max-w-md">
									<ProfileCompletion profile={profile} hasCv={hasCv} />
								</div>
							)}
						</div>
					</div>
					<div className="flex flex-wrap gap-2.5">
						<Link to="/offers" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/90">
							Découvrir les offres
						</Link>
						<Link to="/applications" className="rounded-xl border border-[#d1d5db] bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-[#f9fafb]">
							Mes candidatures
						</Link>
					</div>
				</div>

				{loadError && (
					<div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-[#e5e7eb] bg-surface p-6 text-center shadow-xs">
						<p className="text-sm">{REQUEST_ERRORS[loadError]}</p>
						{loadError === "unauthenticated" ? <Button to="/login">Se connecter</Button> : <Button onClick={retry}>Réessayer</Button>}
					</div>
				)}

				<div className="grid items-start gap-6 lg:grid-cols-[1.15fr_0.85fr]">
					<div className="flex flex-col gap-6">
						{!profile && !loadError && (
							<div className="flex flex-col gap-6">
								<p role="status" className="sr-only">
									Chargement de votre profil…
								</p>
								{[1, 2, 3].map((n) => (
									<div key={n} className="h-32 rounded-2xl bg-surface motion-safe:animate-pulse" />
								))}
							</div>
						)}

						{profile && (
							<>
								{prefill > 0 && (
									<CvSuggestionsPanel
										key={prefill}
										userId={user.id}
										profile={profile}
										onSave={(changes) => updateProfile(user.id, changes)}
										onSaved={setProfile}
										onClose={() => setPrefill(0)}
									/>
								)}
								<PhotoSection photoUrl={profile.photoUrl} onUpload={async (file) => applyResult(await updatePhoto(user.id, file))} />
								<TextSection
									title="Poste recherché"
									value={profile.desiredPosition}
									emptyText="Vous n’avez pas encore indiqué de poste."
									hint="Votre objectif principal : il sert aux suggestions d’offres et aide les entreprises à comprendre votre recherche."
									placeholder="Ex. : Développeur web"
									maxLength={POSITION_MAX_LENGTH}
									onSave={async (desiredPosition) => applyResult(await updateProfile(user.id, { desiredPosition }))}
								/>
								<TextSection
									title="Présentation personnelle"
									value={profile.description}
									emptyText="Vous n’avez pas encore rédigé de présentation."
									hint="Un court résumé de votre parcours et de vos atouts, visible sur votre profil et utile aux recruteurs."
									placeholder="Ex. : Étudiant en M2 informatique, je recherche une alternance de 12 mois en développement web."
									maxLength={DESCRIPTION_MAX_LENGTH}
									multiline
									onSave={async (description) => applyResult(await updateProfile(user.id, { description }))}
								/>
								{/* JOB-071: what the recruiters see and filter on */}
								<ProfileDetailsSection profile={profile} onSave={(changes) => updateProfile(user.id, changes)} onSaved={setProfile} />
							</>
						)}
					</div>

					<div className="flex flex-col gap-6">
						{/* JOB-019: loads its own data, so it does not wait for the profile */}
						<CvSection userId={user.id} onCvChange={setHasCv} onPrefill={() => setPrefill((count) => count + 1)} />
						<SchoolSection />
						<StudentContractsSection />
						{/* JOB-042: notifications and e-mail preference, loaded on their own too */}
						<div className="rounded-2xl border border-[#e5e7eb] bg-surface p-5 shadow-xs sm:p-6">
							<NotificationSettings />
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
