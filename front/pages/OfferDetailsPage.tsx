import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "../components/Button";
import Navbar, { NavbarLink } from "../components/Navbar";
import { OfferError, offerRequest, type Offer } from "../services/offers";
import { card, focus } from "../utils/searchPageStyles";

const contracts: Record<string, string> = { alternance: "Alternance", stage: "Stage", cdd: "CDD", cdi: "CDI" };

export default function OfferDetailsPage() {
  const { id } = useParams();
  const [request, setRequest] = useState<{ id?: string; offer?: Offer; error?: number }>({ id });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setRequest({ id });
    offerRequest<Offer>(`/api/offers/${id}`).then(
      offer => { if (active) setRequest({ id, offer }); },
      error => { if (active) setRequest({ id, error: error instanceof OfferError ? error.status : 0 }); },
    );
    return () => { active = false; };
  }, [id, revision]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") setRevision(value => value + 1); };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);
  const current = request.id === id ? request : { id };
  const offer = current.offer;
  return <div className="min-h-dvh bg-[#f0f0f0] px-4 pt-4 pb-16 text-[#111827] md:px-6 md:pt-6">
    <header><Navbar>
      <div className="hidden gap-12 lg:flex">
        <NavbarLink to="/offers">Trouver une alternance</NavbarLink>
        <NavbarLink to="/companies">Explorer les entreprises</NavbarLink>
        <NavbarLink to="/pricing">Tarifs</NavbarLink>
      </div>
      <NavbarLink to="/signup" className="ml-auto">Inscription</NavbarLink><Button to="/login">Connexion</Button>
    </Navbar></header>
    <main className="mx-auto mt-10 flex max-w-3xl flex-col gap-6">
      <Link to="/offers" className={`self-start rounded-sm text-primary underline ${focus}`}>← Retour aux offres</Link>
      {!offer && current.error === undefined && <p role="status">Chargement de l’offre…</p>}
      {current.error !== undefined && <div className={card}>
        <h1 className="text-2xl font-semibold">{current.error === 404 ? "Offre indisponible" : "Impossible de charger l’offre"}</h1>
        <p role="alert">{current.error === 404 ? "Cette offre est introuvable ou n’est plus disponible." : "Vérifiez votre connexion et réessayez."}</p>
        {current.error !== 404 && <Button onClick={() => setRevision(value => value + 1)}>Réessayer</Button>}
      </div>}
      {offer && <article className={`${card} gap-6! p-6! sm:p-8!`}>
        {offer.image_url && <img src={offer.image_url} alt="" className="max-h-80 w-full rounded-xl object-cover" />}
        <div className="flex flex-col gap-3">
          <h1 className="break-words text-3xl font-semibold">{offer.title}</h1>
          <p className="break-words text-lg text-gray-600">{offer.company}{offer.location && ` • ${offer.location}`}</p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">{offer.category}</span>
            {offer.contract_type && <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">{contracts[offer.contract_type] || offer.contract_type}</span>}
            {offer.duration && <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">{offer.duration}</span>}
          </div>
          {offer.start_date && <p>À partir du {new Date(`${offer.start_date}T00:00:00`).toLocaleDateString("fr-FR")}</p>}
          <p className="text-sm text-gray-500">Publiée le {new Date(offer.created_at).toLocaleDateString("fr-FR")}</p>
        </div>
        <section><h2 className="mb-3 text-xl font-semibold">Description du poste</h2>
          <p className="whitespace-pre-wrap break-words leading-relaxed">{offer.description}</p>
        </section>
        {offer.requirements && <section><h2 className="mb-3 text-xl font-semibold">Profil recherché et compétences</h2>
          <p className="whitespace-pre-wrap break-words leading-relaxed">{offer.requirements}</p>
        </section>}
      </article>}
    </main>
  </div>;
}
