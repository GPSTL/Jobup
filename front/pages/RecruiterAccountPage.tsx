import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";

import Button from "../components/Button";
import ChevronDownIcon from "../components/ChevronDownIcon";
import CompanyLogo from "../components/CompanyLogo";
import EyeIcon from "../components/EyeIcon";
import LogoCropDialog from "../components/LogoCropDialog";
import MapPinIcon from "../components/MapPinIcon";
import NotificationSettings from "../components/NotificationSettings";
import RecruiterNavbar from "../components/RecruiterNavbar";
import UploadIcon from "../components/UploadIcon";
import { getOwnCompany, saveOwnCompany, type CompanyForm, type CompanyFormField, type OwnCompany, type OwnCompanyResult } from "../services/companies";
import { SECTOR_OPTIONS, sectorLabel } from "../utils/companies";
import { activeOffersLabel, COMPANY_LIMITS, formFromCompany, trimmedForm, validateCompanyForm, validateLogo } from "../utils/companyForm";
import { PREFERENCES_ANCHOR } from "../utils/notifications";
import { focus } from "../utils/searchPageStyles";
import { REQUEST_ERRORS } from "../utils/validation";

type Errors = Partial<Record<CompanyFormField, string>>;

const panel = "mx-auto flex max-w-6xl flex-col gap-6 rounded-[25px] bg-surface p-5 shadow-[0_4px_12px_rgba(0,0,0,0.1)] md:p-10";
const label = "text-[15px] font-semibold text-[#111827]";
const fieldBox = (error?: string) =>
	`w-full rounded-[12px] border bg-white px-4 py-2.5 text-[15px] text-[#111827] outline-none placeholder:text-[#9ca3af] focus:border-primary ${
		error ? "border-[#dc2626]" : "border-[#d1d5db]"
	}`;

// Onglet « Compte et abonnement » : #compte, ou #notifications pour le lien « Préférences e-mail » de la cloche (JOB-046)
const ACCOUNT_TAB = "#compte";
const tabClass = (active: boolean) =>
	`rounded-full border px-4 py-1.5 text-[14px] ${active ? "border-primary bg-[#dae8ff] font-semibold text-primary" : "border-[#d1d5db] bg-white text-[#111827] hover:bg-slate-50"} ${focus}`;

type CompanyPreviewProps = {
	form: CompanyForm;
	/** Logo enregistré, ou celui qui vient d'être choisi */
	logoUrl: string | null;
	activeOffers: number;
};

// « Aperçu côté étudiant » : la carte de l'entreprise telle que les étudiants la voient (ETU-23),
// mise à jour pendant la saisie, avant l'enregistrement
export function CompanyPreview({ form, logoUrl, activeOffers }: CompanyPreviewProps) {
	const name = form.name.trim() || "Nom de l’entreprise";
	const details = [form.sector === "" ? "" : sectorLabel(form.sector), form.city.trim()].filter(Boolean).join(" • ");
	return (
		<div className="flex flex-col gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-5">
			<div className="flex items-center gap-3">
				<CompanyLogo name={name} logoUrl={logoUrl} className="size-12 rounded-[12px] text-[18px]" />
				<div className="min-w-0">
					<p className="truncate text-[18px] font-semibold">{name}</p>
					{details && <p className="text-[13px] text-[#6b7280]">{details}</p>}
				</div>
			</div>
			<p className={`line-clamp-3 text-[14px] leading-5 whitespace-pre-line ${form.description.trim() ? "text-[#6b7280]" : "text-[#9ca3af] italic"}`}>
				{form.description.trim() || "Ajoutez une présentation pour donner envie aux étudiants de postuler."}
			</p>
			<span className="w-fit rounded-full bg-[#dae8ff] px-3 py-1 text-[13px] font-semibold text-primary">{activeOffersLabel(activeOffers)}</span>
		</div>
	);
}

// Compte recruteur rattaché à aucune entreprise : rattacher une entreprise ne fait pas partie de JOB-066
export function NoCompany() {
	return (
		<div className="flex flex-col items-center gap-3 py-10 text-center">
			<h2 className="text-2xl font-semibold">Aucune entreprise rattachée</h2>
			<p className="max-w-lg text-[#6b7280]">
				Votre compte n’est rattaché à aucune entreprise : la page entreprise ne peut pas encore être renseignée. Contactez l’équipe JobUp pour rattacher votre
				entreprise.
			</p>
		</div>
	);
}

// « Mon espace » recruteur : onglets « Page entreprise » (JOB-066, REC-25) et « Compte et abonnement » (JOB-046, REC-32)
export default function RecruiterAccountPage() {
	const { hash } = useLocation();
	const accountTab = hash === ACCOUNT_TAB || hash === `#${PREFERENCES_ANCHOR}`;
	// null pendant le chargement
	const [loaded, setLoaded] = useState<OwnCompanyResult | null>(null);
	// Incrémenté par « Réessayer » pour recharger l'entreprise
	const [attempt, setAttempt] = useState(0);
	const [form, setForm] = useState<CompanyForm>({ name: "", sector: "", city: "", description: "" });
	const [errors, setErrors] = useState<Errors>({});
	// Nouveau logo choisi, envoyé avec le reste du formulaire, et son aperçu local
	const [logo, setLogo] = useState<File | null>(null);
	const [logoPreview, setLogoPreview] = useState<string | null>(null);
	// Image choisie dans les fichiers, en cours de recadrage
	const [cropping, setCropping] = useState<File | null>(null);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState("");
	const [saved, setSaved] = useState("");
	const logoInput = useRef<HTMLInputElement>(null);

	useEffect(() => {
		// Ignore la réponse si la page a été quittée entre-temps
		let ignore = false;
		getOwnCompany().then((result) => {
			if (ignore) return;
			setLoaded(result);
			if (result.ok) setForm(formFromCompany(result.company));
		});
		return () => {
			ignore = true;
		};
	}, [attempt]);

	useEffect(() => {
		// L'aperçu local du logo est libéré quand il est remplacé ou que la page est quittée
		if (!logo) {
			setLogoPreview(null);
			return;
		}
		const url = URL.createObjectURL(logo);
		setLogoPreview(url);
		return () => URL.revokeObjectURL(url);
	}, [logo]);

	if (loaded?.ok === false && loaded.reason === "unauthenticated") return <Navigate to="/login" replace />;
	const company: OwnCompany | null = loaded?.ok ? loaded.company : null;

	const change = (field: keyof CompanyForm) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
		const value = field === "sector" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value;
		setForm({ ...form, [field]: value });
		setErrors({ ...errors, [field]: undefined });
		setSaved("");
	};

	const chooseLogo = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		// Vidé pour que choisir de nouveau le même fichier déclenche encore onChange
		e.target.value = "";
		if (!file) return;
		const invalid = validateLogo(file);
		setErrors({ ...errors, logo: invalid || undefined });
		setSaved("");
		// Une image valide passe d'abord par la fenêtre de recadrage
		if (!invalid) setCropping(file);
	};

	// « Annuler » : retour à la page enregistrée
	const reset = () => {
		if (!company) return;
		setForm(formFromCompany(company));
		setLogo(null);
		setErrors({});
		setSaveError("");
		setSaved("");
	};

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		if (saving || !company) return;
		const found: Errors = { ...validateCompanyForm(form), logo: errors.logo };
		const first = (["logo", "name", "sector", "city", "description"] as const).find((field) => found[field]);
		setErrors(found);
		setSaveError("");
		setSaved("");
		if (first) {
			// Le focus va au premier champ à corriger
			document.getElementById(first === "logo" ? "company-logo-button" : `company-${first}`)?.focus();
			return;
		}

		setSaving(true);
		const result = await saveOwnCompany(trimmedForm(form), logo);
		setSaving(false);
		if (result.ok) {
			setLoaded(result);
			setForm(formFromCompany(result.company));
			setLogo(null);
			setSaved("Page entreprise enregistrée. Les étudiants voient déjà ces changements.");
			return;
		}
		// Échec : rien n'a été enregistré, la saisie est gardée pour réessayer
		if (result.reason === "invalid") setErrors(result.fields);
		else if (result.reason === "unauthenticated" || result.reason === "noCompany") setLoaded(result);
		else setSaveError(`La page n’a pas été enregistrée. ${REQUEST_ERRORS[result.reason]}`);
	};

	const errorOf = (field: CompanyFormField) =>
		errors[field] && (
			<p id={`company-${field}-error`} className="text-[13px] font-medium text-[#dc2626]">
				{errors[field]}
			</p>
		);
	const described = (field: CompanyFormField) => (errors[field] ? { "aria-invalid": true, "aria-describedby": `company-${field}-error` } : {});

	return (
		<div className="min-h-dvh bg-[#f0f0f0]">
			<header className="p-4">
				<RecruiterNavbar />
			</header>

			<main className="px-4 pt-6 pb-16 md:px-6 md:pt-9">
				<section aria-labelledby="account-title" className={panel}>
					<div className="flex flex-col gap-1">
						<h1 id="account-title" className="text-[28px] font-semibold">
							Mon espace
						</h1>
						<p className="text-[#6b7280]">Présentez votre entreprise aux étudiants.</p>
					</div>

					{/* Onglets de la maquette. « Compte et abonnement » n'a encore que le bloc « Notifications » (JOB-046) :
					    l'abonnement, les factures et le compte relèvent de REC-28. */}
					<nav aria-label="Onglets de Mon espace" className="flex flex-wrap gap-2">
						<Link to="/recruiter/account" aria-current={accountTab ? undefined : "page"} className={tabClass(!accountTab)}>
							Page entreprise
						</Link>
						<Link to={`/recruiter/account${ACCOUNT_TAB}`} aria-current={accountTab ? "page" : undefined} className={tabClass(accountTab)}>
							Compte et abonnement
						</Link>
					</nav>

					{accountTab && (
						<div className="grid gap-6 lg:grid-cols-2">
							<NotificationSettings role="recruiter" />
						</div>
					)}

					{/* Onglet « Page entreprise » (JOB-066) */}
					<p role="status" className="sr-only">
						{loaded === null && !accountTab ? "Chargement de votre page entreprise…" : ""}
					</p>
					{loaded === null && !accountTab && <div className="h-72 rounded-2xl bg-[#f1f3f6] motion-safe:animate-pulse" />}

					{!accountTab && loaded?.ok === false && loaded.reason === "noCompany" && <NoCompany />}

					{!accountTab && loaded?.ok === false && loaded.reason !== "noCompany" && loaded.reason !== "invalid" && loaded.reason !== "unauthenticated" && (
						<div role="alert" className="flex flex-col items-center gap-4 py-10 text-center">
							<p>{REQUEST_ERRORS[loaded.reason]}</p>
							<Button
								onClick={() => {
									setLoaded(null);
									setAttempt(attempt + 1);
								}}
							>
								Réessayer
							</Button>
						</div>
					)}

					{!accountTab && company && (
						<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
							<form noValidate onSubmit={submit} className="flex flex-col gap-4">
								<div className="flex flex-wrap items-center gap-4">
									<CompanyLogo name={form.name || company.name} logoUrl={logoPreview ?? company.logo_url} className="size-16 rounded-[14px] text-[24px]" />
									<div className="flex-1">
										<p className={label}>Logo de l’entreprise</p>
										<p className="text-[13px] text-[#6b7280]">JPG ou PNG • 2 Mo maximum</p>
										{logo && <p className="text-[13px] text-[#6b7280]">Nouveau logo recadré : il sera enregistré avec la page.</p>}
									</div>
									<button
										id="company-logo-button"
										type="button"
										onClick={() => logoInput.current?.click()}
										{...described("logo")}
										className={`flex cursor-pointer items-center gap-2 rounded-[12px] border border-[#d1d5db] bg-white px-4 py-2 text-[14px] font-semibold hover:bg-slate-50 ${focus}`}
									>
										<UploadIcon width={16} height={16} />
										Changer le logo
									</button>
									<input ref={logoInput} type="file" accept="image/jpeg,image/png" onChange={chooseLogo} className="hidden" />
									<LogoCropDialog
										file={cropping}
										onCancel={() => setCropping(null)}
										onConfirm={(cropped) => {
											setLogo(cropped);
											setCropping(null);
										}}
									/>
								</div>
								{errorOf("logo")}

								<div className="flex flex-col gap-1.5">
									<label htmlFor="company-name" className={label}>
										Nom de l’entreprise <span aria-hidden="true">*</span>
									</label>
									<input
										id="company-name"
										value={form.name}
										onChange={change("name")}
										required
										maxLength={COMPANY_LIMITS.name}
										autoComplete="organization"
										{...described("name")}
										className={fieldBox(errors.name)}
									/>
									{errorOf("name")}
								</div>

								<div className="grid gap-4 sm:grid-cols-2">
									<div className="flex flex-col gap-1.5">
										<label htmlFor="company-sector" className={label}>
											Secteur <span aria-hidden="true">*</span>
										</label>
										<div className="relative">
											<select
												id="company-sector"
												value={form.sector}
												onChange={change("sector")}
												required
												{...described("sector")}
												className={`${fieldBox(errors.sector)} cursor-pointer appearance-none pr-10`}
											>
												<option value="">Choisissez un secteur</option>
												{SECTOR_OPTIONS.map(({ value, label: text }) => (
													<option key={value} value={value}>
														{text}
													</option>
												))}
											</select>
											<ChevronDownIcon width={16} height={16} className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[#6b7280]" />
										</div>
										{errorOf("sector")}
									</div>
									<div className="flex flex-col gap-1.5">
										<label htmlFor="company-city" className={label}>
											Localisation
										</label>
										<div className="relative">
											<input
												id="company-city"
												value={form.city}
												onChange={change("city")}
												maxLength={COMPANY_LIMITS.city}
												placeholder="Ex. : Paris 9e"
												{...described("city")}
												className={`${fieldBox(errors.city)} pr-10`}
											/>
											<MapPinIcon width={16} height={16} className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[#6b7280]" />
										</div>
										{errorOf("city")}
									</div>
								</div>

								<div className="flex flex-col gap-1.5">
									<label htmlFor="company-description" className={label}>
										Présentation
									</label>
									<textarea
										id="company-description"
										value={form.description}
										onChange={change("description")}
										rows={4}
										maxLength={COMPANY_LIMITS.description}
										placeholder="Votre activité, vos équipes, l’accompagnement des alternants…"
										{...described("description")}
										className={`${fieldBox(errors.description)} resize-y`}
									/>
									{errorOf("description")}
								</div>

								<p className="text-[13px] text-[#6b7280]">* Champs obligatoires</p>

								{saveError && (
									<p role="alert" className="rounded-[12px] bg-[#fef2f2] px-4 py-3 text-[#b91c1c]">
										{saveError}
									</p>
								)}
								<p role="status" className="text-[14px] font-medium text-[#15803d] empty:hidden">
									{saved}
								</p>

								<div className="flex justify-end gap-3">
									<Button variant="outline" onClick={reset} disabled={saving} className="px-5 py-2">
										Annuler
									</Button>
									<Button type="submit" disabled={saving} className="px-5 py-2">
										{saving ? "Enregistrement…" : "Enregistrer"}
									</Button>
								</div>
							</form>

							<aside aria-labelledby="preview-title" className="flex flex-col gap-3">
								<h2 id="preview-title" className="flex items-center gap-2 text-[15px] font-semibold">
									<EyeIcon width={18} height={18} className="text-[#6b7280]" />
									Aperçu côté étudiant
								</h2>
								<CompanyPreview form={form} logoUrl={logoPreview ?? company.logo_url} activeOffers={company.active_offers} />
								<Link to={`/companies/${company.id}`} className={`self-start rounded-sm text-[14px] font-semibold text-primary hover:underline ${focus}`}>
									Voir la page publique
								</Link>
							</aside>
						</div>
					)}
				</section>
			</main>
		</div>
	);
}
