import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Pagination from "../components/Pagination";
import Button from "../components/Button";
import { fetchOffers, OfferError, type Offer, type OfferPage } from "../services/offers";

import { EditOfferDialog, DeleteOfferDialog } from "../components/OfferDialogs";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";
const panel = "recruiter-state-panel";
const unavailable = "Fonctionnalité bientôt disponible";
const fallbackImage = "/static/img/recruiter/offer-team.png";

export function RecruiterNavbar() {
  return <Navbar variant="recruiter">
    <div className="recruiter-nav-items">
      {["Mon espace", "Filtrer", "Candidats"].map(label => <button key={label} type="button" disabled title={unavailable}>{label}</button>)}
      <Link to="/recruiter/offers" aria-current="page" className={`recruiter-nav-active ${focus}`}>Vos offres</Link>
      <button type="button" disabled title={unavailable}>Messages</button>
      <button type="button" disabled title={unavailable} aria-label="Notifications bientôt disponibles" className="recruiter-notifications"><img src="/static/img/recruiter/bell.svg" alt="" /></button>
    </div>
  </Navbar>;
}

function OfferImage({ offer }: { offer: Offer }) {
  return <img src={offer.image_url || fallbackImage} alt="" loading="lazy" className="recruiter-offer-image" onError={(event) => {
    if (!event.currentTarget.src.endsWith(fallbackImage)) event.currentTarget.src = fallbackImage;
  }} />;
}

export default function RecruiterOffersPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<{ action: "edit" | "delete"; offer: Offer } | null>(null);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const pageValue = params.get("page") || "1";
  const page = /^[1-9]\d*$/.test(pageValue) && Number.isSafeInteger(Number(pageValue)) ? Number(pageValue) : 1;
  const path = id ? `/${id}` : `?page=${page}`;
  const [request, setRequest] = useState<{ path: string; data?: OfferPage | Offer; error?: number }>({ path });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setRequest({ path });
    fetchOffers<OfferPage | Offer>(path, controller.signal).then(
      data => { if (!controller.signal.aborted) setRequest({ path, data }); },
      error => { if (!controller.signal.aborted) setRequest({ path, error: error instanceof OfferError ? error.status : 0 }); },
    );
    return () => controller.abort();
  }, [path, retry]);

  const current = request.path === path ? request : { path };
  if (current.error === 401 || current.error === 403) return <Navigate to="/login" state={{ recruiterReturnTo: location.pathname + location.search }} replace />;
  const offerPage = current.data && "results" in current.data ? current.data : undefined;
  const list = offerPage?.results;
  const offer = current.data && !("results" in current.data) ? current.data : undefined;
  const totalPages = offerPage ? Math.max(1, Math.ceil(offerPage.count / 6)) : 1;
  const pageMissing = list !== undefined && page > totalPages;
  const error = pageMissing ? 404 : current.error;
  const visibleOffers = list;
  const back = `/recruiter/offers${params.toString() ? `?${params}` : ""}`;

  function changed(message: string) { setDialog(null); setNotice(message); setRetry(value => value + 1); }
  function actions(item: Offer) {
    return <div className="flex justify-center gap-4">
      <button type="button" className={`cursor-pointer rounded-lg p-2 text-primary hover:bg-primary/10 hover:text-blue-700 focus-visible:bg-primary/10 motion-safe:transition-colors motion-safe:duration-150 ${focus}`} onClick={() => setDialog({ action: "edit", offer: item })} aria-label={`Modifier l’offre ${item.title}`}>✎ Modifier</button>
      <button type="button" className={`cursor-pointer rounded-lg p-2 text-red-700 hover:bg-red-50 hover:text-red-800 focus-visible:bg-red-50 motion-safe:transition-colors motion-safe:duration-150 ${focus}`} onClick={() => setDialog({ action: "delete", offer: item })} aria-label={`Supprimer l’offre ${item.title}`}>Supprimer</button>
    </div>;
  }
  return <div className="recruiter-offers-page">
    <header className="recruiter-header"><RecruiterNavbar /></header>
    <main className={id ? "recruiter-detail-main" : "recruiter-offers-main"}>
      <h1 className="sr-only">{id ? "Détail de l’offre" : "Vos offres"}</h1>
      {notice && <p role="status" className="mb-4 text-green-800">{notice}</p>}
      {!notice && location.state?.offerCreated && <p role="status" className="mb-4 text-green-800">L’offre a été publiée.</p>}
      {!id && <div className="recruiter-offers-toolbar"><Button to="/recruiter/offers/new">Créer une offre</Button></div>}
      {!current.data && current.error === undefined && <p role="status" aria-busy="true">Chargement des offres…</p>}
      {error !== undefined && <div className={`${panel} flex flex-col items-start gap-4`}>
        <p role="alert">{error === 404 ? (id ? "Cette offre est introuvable ou n’est plus disponible." : "Cette page d’offres n’existe pas.") : "Impossible de charger les offres. Vérifiez votre connexion et réessayez."}</p>
        {error === 404 ? <Link to="/recruiter/offers" className={`text-primary underline ${focus}`}>Voir vos offres</Link> : <Button onClick={() => setRetry(value => value + 1)}>Réessayer</Button>}
      </div>}
      {list && !pageMissing && <>
        <p className="sr-only" role="status">{offerPage?.count} offres publiées. Page {page}. Les plus récentes en premier.</p>
        {list.length === 0 ? <p className={panel}>Vous n’avez aucune offre publiée pour le moment.</p> : <ul className="recruiter-offer-grid">
          {visibleOffers?.map(item => <li key={item.id} className="recruiter-offer-card">
            <h2>{item.title}</h2>
            <OfferImage offer={item} />
            <div className="recruiter-card-description"><p>{item.description}</p>
              <Link to={`/recruiter/offers/${item.id}?page=${page}`} className={`recruiter-more-link ${focus}`}>Plus d’informations<span className="sr-only"> : {item.title}</span></Link>
            </div>
            {actions(item)}
          </li>)}
        </ul>}
        <Pagination variant="recruiter" currentPage={page} totalPages={totalPages} onPageChange={value => setParams({ page: String(value) })} />
      </>}
      {offer && <article className="recruiter-offer-detail">
        <Link to={back} className={`recruiter-back-link ${focus}`}><img src="/static/img/recruiter/back.svg" alt="" />Retour à vos offres</Link>
        <div className="recruiter-detail-summary">
          <OfferImage offer={offer} />
          <div className="recruiter-detail-info">
            <h2>{offer.title}</h2>
            <p className="recruiter-detail-company"><img src="/static/img/recruiter/building.svg" alt="" />{offer.company}</p>
            <p className="recruiter-detail-tag">{offer.category}</p>
            {offer.location && <p>{offer.location}</p>}
            {offer.contract_type && <p>{offer.contract_type}{offer.duration && ` · ${offer.duration}`}</p>}
            {offer.start_date && <p>À partir du {new Date(`${offer.start_date}T00:00:00`).toLocaleDateString("fr-FR")}</p>}
            <p className="text-gray-500">Publiée le {new Date(offer.created_at).toLocaleDateString("fr-FR")}</p>
          </div>
        </div>
        <h3>Description du poste</h3>
        <p className="recruiter-detail-copy">{offer.description}</p>
        {offer.requirements && <><h3>Profil recherché</h3><p className="recruiter-detail-copy">{offer.requirements}</p></>}
        {actions(offer)}
      </article>}
    </main>
    {dialog?.action === "edit" && <EditOfferDialog offer={dialog.offer} onClose={() => setDialog(null)} onSaved={() => changed("L’offre a été modifiée.")} />}
    {dialog?.action === "delete" && <DeleteOfferDialog offer={dialog.offer} onClose={() => setDialog(null)} onDeleted={() => {
      changed("L’offre a été supprimée.");
      if (id || page > 1) navigate("/recruiter/offers");
    }} />}
  </div>;
}
