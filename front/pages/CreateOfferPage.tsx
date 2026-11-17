import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import Button from "../components/Button";
import Field from "../components/Field";
import { getOwnCompany, type OwnCompanyResult } from "../services/companies";
import { createOffer } from "../services/recruiterOffers";
import { SECTOR_OPTIONS } from "../utils/companies";
import { newOfferSchema, type NewOfferForm } from "../utils/offer";
import { focus } from "../utils/searchPageStyles";
import { REQUEST_ERRORS } from "../utils/validation";
import { RecruiterOffersLayout } from "./RecruiterOffersPage";

const panel = "mx-auto flex max-w-2xl flex-col gap-6 rounded-2xl border border-[#e5e7eb] bg-surface px-5 py-7 shadow-xs md:px-10 md:py-8";

// Recruteur sans entreprise : une offre est toujours publiée au nom d'une entreprise
export function NoCompanyForOffer() {
	return (
		<div className="flex flex-col items-center gap-3 py-6 text-center">
			<h2 className="text-xl font-semibold">Aucune entreprise rattachée</h2>
			<p className="text-sm text-[#6b7280]">Votre compte n’est rattaché à aucune entreprise : vous ne pouvez pas encore publier d’offre. Contactez l’équipe JobUp pour rattacher votre entreprise.</p>
			<Button to="/recruiter/offers">Retour à vos offres</Button>
		</div>
	);
}

type OfferFormProps = {
	/** Entreprise du recruteur, affichée sans pouvoir être modifiée */
	companyName: string;
};

// Formulaire « Créer une offre » de JOB-051 (PR #25), repris sur main par JOB-065
export function CreateOfferForm({ companyName }: OfferFormProps) {
	const navigate = useNavigate();
	const [error, setError] = useState("");
	const [accessError, setAccessError] = useState(false);
	// Mis à jour tout de suite, contrairement à l'état : un double envoi est ignoré
	const pending = useRef(false);
	const [publishing, setPublishing] = useState(false);
	const {
		register,
		handleSubmit,
		setError: setFieldError,
		formState: { errors, isSubmitting },
	} = useForm<NewOfferForm>({
		resolver: zodResolver(newOfferSchema),
		defaultValues: { title: "", description: "", category: "", requirements: "", image_url: "", contract_type: "alternance", duration: "", start_date: "", location: "" },
	});
	const busy = isSubmitting || publishing;

	const submit = handleSubmit(
		async (values) => {
			if (pending.current) return;
			pending.current = true;
			setPublishing(true);
			setError("");
			setAccessError(false);
			try {
				const result = await createOffer({ ...values, category: Number(values.category), start_date: values.start_date || null });
				if (result.ok) {
					// Retour à « Vos offres », où la nouvelle offre apparaît en premier
					navigate("/recruiter/offers", { replace: true, state: { offerCreated: result.offer.title } });
					return;
				}
				for (const key of Object.keys(result.errors) as (keyof NewOfferForm)[]) {
					setFieldError(key, { message: result.errors[key] }, { shouldFocus: true });
				}
				// La saisie est gardée dans tous les cas, pour réessayer
				const denied = result.status === 401 || result.status === 403;
				setAccessError(denied);
				setError(
					denied
						? "Votre accès a expiré ou a été refusé. Reconnectez-vous avant de réessayer."
						: result.status === 400
							? "Vérifiez les champs du formulaire."
							: result.status === 404
								? "Votre compte n’est rattaché à aucune entreprise. Contactez l’équipe JobUp."
								: "Impossible de publier l’offre. Vérifiez votre connexion et réessayez.",
				);
			} finally {
				pending.current = false;
				setPublishing(false);
			}
		},
		() => setError("Vérifiez les champs du formulaire."),
	);

	return (
		<form onSubmit={submit} noValidate aria-busy={busy}>
			<fieldset disabled={busy} className="flex flex-col gap-4">
				<Field id="offer-title" label="Intitulé du poste *" error={errors.title?.message}>
					<input {...register("title")} required maxLength={128} placeholder="Ex. : Développeur Java en alternance" />
				</Field>
				<Field id="offer-category" label="Secteur *" error={errors.category?.message}>
					<select {...register("category")} required>
						<option value="">Choisissez un secteur</option>
						{SECTOR_OPTIONS.map(({ value, label }) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</Field>
				<Field id="offer-image" label="Image de l’offre (URL HTTP ou HTTPS)" error={errors.image_url?.message}>
					<input type="url" {...register("image_url")} maxLength={200} placeholder="https://…" />
				</Field>
				<Field id="offer-contract" label="Type de contrat" error={errors.contract_type?.message}>
					<select {...register("contract_type")}>
						<option value="">Non précisé</option>
						<option value="alternance">Alternance</option>
						<option value="stage">Stage</option>
						<option value="cdd">CDD</option>
						<option value="cdi">CDI</option>
					</select>
				</Field>
				<Field id="offer-requirements" label="Compétences recherchées" error={errors.requirements?.message}>
					<textarea {...register("requirements")} maxLength={256} rows={2} placeholder="Ex. : Java, SQL, Git" className="h-auto! py-2.5" />
				</Field>
				<div className="grid gap-4 sm:grid-cols-2">
					<Field id="offer-duration" label="Durée" error={errors.duration?.message}>
						<input {...register("duration")} maxLength={64} placeholder="Ex. : 12 mois" />
					</Field>
					<Field id="offer-start" label="Date de début" error={errors.start_date?.message}>
						<input type="date" {...register("start_date")} />
					</Field>
				</div>
				<Field id="offer-description" label="Description du poste *" error={errors.description?.message}>
					<textarea {...register("description")} required maxLength={2048} rows={6} placeholder="Décrivez les missions et le profil recherché…" className="h-auto! py-2.5" />
				</Field>
				{/* Rattachement fait par le serveur : affiché pour information, jamais envoyé */}
				{/* Sans Field : il remplacerait aria-describedby, qui relie le champ à son explication */}
				<div className="flex flex-col gap-1.5">
					<label htmlFor="offer-company" className="text-sm font-medium text-ink">
						Nom de l’entreprise
					</label>
					<input
						id="offer-company"
						value={companyName}
						readOnly
						aria-describedby="offer-company-hint"
						className="min-h-11 w-full cursor-default rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-3.5 py-2.5 text-sm text-[#6b7280] outline-none"
					/>
					<p id="offer-company-hint" className="text-xs text-[#6b7280]">
						L’offre est publiée au nom de votre entreprise. Modifiez-la depuis{" "}
						<Link to="/recruiter/account" className={`rounded-sm text-primary underline ${focus}`}>
							Mon espace
						</Link>
						.
					</p>
				</div>
				<Field id="offer-location" label="Lieu du poste" error={errors.location?.message}>
					<input {...register("location")} maxLength={128} placeholder="Ex. : Paris, Lyon" />
				</Field>
			</fieldset>

			{error && (
				<p role="alert" className="mt-4 text-sm font-medium text-[#b91c1c]">
					{error}
				</p>
			)}
			{accessError && (
				<Link to="/login" target="_blank" rel="noopener" state={{ recruiterReturnTo: "/recruiter/offers/new" }} className={`mt-2 block rounded-sm text-sm text-primary underline ${focus}`}>
					Se reconnecter dans un nouvel onglet
				</Link>
			)}

			<div className="mt-6 flex flex-col gap-3">
				<Button type="submit" disabled={busy} className="py-3">
					{busy ? "Publication…" : "Publier l’offre"}
				</Button>
				<Button variant="outline" disabled={busy} onClick={() => navigate("/recruiter/offers")} className="py-3">
					Annuler
				</Button>
				<p className="text-center text-xs text-[#6b7280]">Vérifiez les informations avant de publier votre offre : elle sera visible tout de suite.</p>
			</div>
		</form>
	);
}

// « Vos offres → Créer une offre » (JOB-065, REC-22, maquette « Créer une offre »)
export default function CreateOfferPage() {
	// null pendant le chargement de l'entreprise du recruteur
	const [company, setCompany] = useState<OwnCompanyResult | null>(null);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let ignore = false;
		getOwnCompany().then((result) => {
			if (!ignore) setCompany(result);
		});
		return () => {
			ignore = true;
		};
	}, [attempt]);

	if (company?.ok === false && company.reason === "unauthenticated") return <Navigate to="/login" replace />;

	return (
		<RecruiterOffersLayout>
			<section aria-labelledby="create-offer-title" className={panel}>
				<Link to="/recruiter/offers" className={`self-start rounded-sm text-sm font-semibold text-primary hover:underline ${focus}`}>
					← Retour à vos offres
				</Link>
				<div className="text-center">
					<h1 id="create-offer-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
						Publier une offre
					</h1>
					<p className="mt-1 text-sm text-[#6b7280]">Présentez votre poste et trouvez votre futur alternant. Les champs marqués d’un * sont obligatoires.</p>
				</div>

				{company === null && <p role="status" className="text-sm text-[#6b7280]">Chargement…</p>}
				{company?.ok === false && company.reason === "noCompany" && <NoCompanyForOffer />}
				{company?.ok === false && company.reason !== "noCompany" && company.reason !== "unauthenticated" && company.reason !== "invalid" && (
					<div role="alert" className="flex flex-col items-center gap-4 text-center">
						<p className="text-sm">{REQUEST_ERRORS[company.reason]}</p>
						<Button
							onClick={() => {
								setCompany(null);
								setAttempt(attempt + 1);
							}}
						>
							Réessayer
						</Button>
					</div>
				)}
				{company?.ok && <CreateOfferForm companyName={company.company.name} />}
			</section>
		</RecruiterOffersLayout>
	);
}
