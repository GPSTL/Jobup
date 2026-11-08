import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Button from "../components/Button";
import Field from "../components/Field";
import { RecruiterNavbar } from "./RecruiterOffersPage";
import { createOffer, fetchOffers, type OfferCategory } from "../services/offers";
import { newOfferSchema, type NewOfferForm } from "../utils/offer";

export default function CreateOfferPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<OfferCategory[] | null>(null);
  const [categoryError, setCategoryError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [accessError, setAccessError] = useState(false);
  const pending = useRef(false);
  const [publishing, setPublishing] = useState(false);
  const { register, handleSubmit, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<NewOfferForm>({
    resolver: zodResolver(newOfferSchema),
    defaultValues: { title: "", description: "", category: "", requirements: "", image_url: "",
      contract_type: "alternance", duration: "", start_date: "", company: "", location: "" },
  });
  const busy = isSubmitting || publishing;
  useEffect(() => {
    const controller = new AbortController();
    setCategoryError(false);
    fetchOffers<OfferCategory[]>("/categories", controller.signal).then(
      data => { if (!controller.signal.aborted) setCategories(data); },
      () => { if (!controller.signal.aborted) setCategoryError(true); },
    );
    return () => controller.abort();
  }, [retry]);
  const submit = handleSubmit(async values => {
    if (pending.current || !categories) return;
    if (!categories.some(category => category.value === Number(values.category))) {
      setFieldError("category", { message: "Choisissez un secteur valide." });
      return;
    }
    pending.current = true;
    setPublishing(true);
    setError(""); setAccessError(false);
    try {
      const result = await createOffer({ ...values, category: Number(values.category), start_date: values.start_date || null });
      if (result.ok) {
        navigate(`/recruiter/offers/${result.offer.id}`, { replace: true, state: { offerCreated: true } });
        return;
      }
      for (const key of Object.keys(result.errors) as (keyof NewOfferForm)[]) {
        setFieldError(key, { message: result.errors[key] }, { shouldFocus: true });
      }
      const denied = result.status === 401 || result.status === 403;
      setAccessError(denied);
      setError(denied ? "Votre accès a expiré ou a été refusé. Reconnectez-vous avant de réessayer."
        : result.status === 400 ? "Vérifiez les champs du formulaire."
        : result.status === 404 ? "Votre profil recruteur est indisponible. Contactez votre administrateur."
        : "Impossible de publier l’offre. Vérifiez votre connexion et réessayez.");
    } finally { pending.current = false; setPublishing(false); }
  }, () => setError("Vérifiez les champs du formulaire."));

  return <div className="recruiter-offers-page">
    <header className="recruiter-header"><RecruiterNavbar /></header>
    <main className="mx-auto mt-10 max-w-3xl">
      <Link to="/recruiter/offers" className="recruiter-back-link">← Retour à vos offres</Link>
      <section className="recruiter-state-panel">
        <h1 className="text-3xl font-semibold">Créer une offre</h1>
        <p className="mt-3 mb-6 text-gray-600">Les champs marqués d’un * sont obligatoires. L’offre sera publiée dès sa validation.</p>
        {categoryError && <div role="alert" className="mb-6 flex flex-wrap items-center gap-4">
          <p>Impossible de charger les secteurs.</p><Button onClick={() => setRetry(value => value + 1)}>Réessayer</Button>
        </div>}
        {!categories && !categoryError && <p role="status" className="mb-4">Chargement des secteurs…</p>}
        <form onSubmit={submit} noValidate aria-busy={busy}>
          <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
            <Field id="offer-title" label="Intitulé de l’offre *" error={errors.title?.message} className="sm:col-span-2">
              <input {...register("title")} required maxLength={128} />
            </Field>
            <Field id="offer-category" label="Secteur *" error={errors.category?.message}>
              <select {...register("category")} required disabled={!categories}>
                <option value="">Choisissez un secteur</option>
                {categories?.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
              </select>
            </Field>
            <Field id="offer-contract" label="Contrat" error={errors.contract_type?.message}>
              <select {...register("contract_type")}>
                <option value="">Non précisé</option><option value="alternance">Alternance</option>
                <option value="stage">Stage</option><option value="cdd">CDD</option><option value="cdi">CDI</option>
              </select>
            </Field>
            <Field id="offer-location" label="Lieu" error={errors.location?.message}>
              <input {...register("location")} maxLength={128} />
            </Field>
            <Field id="offer-duration" label="Durée" error={errors.duration?.message}>
              <input {...register("duration")} maxLength={64} placeholder="Ex. : 12 mois" />
            </Field>
            <Field id="offer-start" label="Date de début" error={errors.start_date?.message}>
              <input type="date" {...register("start_date")} />
            </Field>
            <Field id="offer-company" label="Nom affiché de l’entreprise (facultatif)" error={errors.company?.message}>
              <input {...register("company")} maxLength={128} placeholder="Votre entreprise par défaut" />
            </Field>
            <Field id="offer-description" label="Description du poste *" error={errors.description?.message} className="sm:col-span-2">
              <textarea {...register("description")} required maxLength={2048} rows={7} className="h-auto! py-3" />
            </Field>
            <Field id="offer-requirements" label="Profil recherché et compétences" error={errors.requirements?.message} className="sm:col-span-2">
              <textarea {...register("requirements")} maxLength={256} rows={3} className="h-auto! py-3" />
            </Field>
            <Field id="offer-image" label="Image (URL HTTP ou HTTPS)" error={errors.image_url?.message} className="sm:col-span-2">
              <input type="url" {...register("image_url")} maxLength={200} />
            </Field>
          </fieldset>
          {error && <p role="alert" className="mt-5 text-red-700">{error}</p>}
          {accessError && <Link to="/login" target="_blank" rel="noopener" state={{ recruiterReturnTo: "/recruiter/offers/new" }} className="mt-2 block text-primary underline">Se reconnecter dans un nouvel onglet</Link>}
          <div className="mt-8 flex flex-wrap justify-end gap-4">
            <Button disabled={busy} onClick={() => navigate("/recruiter/offers")} className="bg-gray-200! text-gray-900!">Annuler</Button>
            <Button type="submit" disabled={busy || !categories}>{busy ? "Publication…" : "Publier l’offre"}</Button>
          </div>
        </form>
      </section>
    </main>
  </div>;
}
