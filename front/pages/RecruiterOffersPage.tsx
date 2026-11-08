import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Pagination from "../components/Pagination";
import Button from "../components/Button";
import { fetchOffers, OfferError, type Offer } from "../services/offers";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";
const panel = "recruiter-state-panel";
const unavailable = "Fonctionnalité bientôt disponible";
const fallbackImage = "/static/img/recruiter/offer-team.webp";

function RecruiterNavbar() {
  return <Navbar variant="recruiter">
    <div className="recruiter-nav-items">
      {["Mon espace", "Filtrer", "Candidats"].map(label => <button key={label} type="button" disabled title={unavailable}>{label}</button>)}
      <Link to="/recruiter/offers" aria-current="page" className={`recruiter-nav-active ${focus}`}>Vos offres</Link>
      <button type="button" disabled title={unavailable}>Messages</button>
      <button type="button" disabled title={unavailable} aria-label="Notifications bientôt disponibles" className="recruiter-notifications"><img src="/static/img/recruiter/bell.svg" alt="" /></button>
    </div>
  </Navbar>;
}

function OfferActions({ title }: { title: string }) {
  return <div className="recruiter-card-actions">
    <button type="button" disabled title={unavailable} className="recruiter-candidates">Consulter la liste de candidats</button>
    <div className="recruiter-edit-actions">
      <button type="button" disabled title={unavailable} aria-label={`Supprimer l’offre ${title} — bientôt disponible`}><img src="/static/img/recruiter/delete.svg" alt="" /></button>
      <button type="button" disabled title={unavailable} aria-label={`Modifier l’offre ${title} — bientôt disponible`}><img src="/static/img/recruiter/edit.svg" alt="" /></button>
    </div>
  </div>;
}

function OfferImage({ offer }: { offer: Offer }) {
  return <img src={offer.image_url || fallbackImage} alt="" loading="lazy" className="recruiter-offer-image" onError={(event) => {
    if (!event.currentTarget.src.endsWith(fallbackImage)) event.currentTarget.src = fallbackImage;
  }} />;
}

export default function RecruiterOffersPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const pageValue = params.get("page") || "1";
  const page = /^[1-9]\d*$/.test(pageValue) && Number.isSafeInteger(Number(pageValue)) ? Number(pageValue) : 1;
  const path = id ? `/${id}` : "";
  const [request, setRequest] = useState<{ path: string; data?: Offer[] | Offer; error?: number }>({ path });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setRequest({ path });
    fetchOffers<Offer[] | Offer>(path, controller.signal).then(
      data => { if (!controller.signal.aborted) setRequest({ path, data }); },
      error => { if (!controller.signal.aborted) setRequest({ path, error: error instanceof OfferError ? error.status : 0 }); },
    );
    return () => controller.abort();
  }, [path, retry]);

  const current = request.path === path ? request : { path };
  if (current.error === 401 || current.error === 403) return <Navigate to="/login" state={{ recruiterReturnTo: location.pathname + location.search }} replace />;
  const list = Array.isArray(current.data) ? current.data : undefined;
  const offer = current.data && !Array.isArray(current.data) ? current.data : undefined;
  const totalPages = list ? Math.max(1, Math.ceil(list.length / 3)) : 1;
  const pageMissing = list !== undefined && page > totalPages;
  const error = pageMissing ? 404 : current.error;
  const visibleOffers = list?.slice((page - 1) * 3, page * 3);
  const back = `/recruiter/offers${params.toString() ? `?${params}` : ""}`;

  return <div className="recruiter-offers-page">
    <header className="recruiter-header"><RecruiterNavbar /></header>
    <main className={id ? "recruiter-detail-main" : "recruiter-offers-main"}>
      <h1 className="sr-only">{id ? "Détail de l’offre" : "Vos offres"}</h1>
      {!id && <div className="recruiter-offers-toolbar"><button type="button" disabled title={unavailable}>Créer une offre</button></div>}
      {!current.data && current.error === undefined && <p role="status" aria-busy="true">Chargement des offres…</p>}
      {error !== undefined && <div className={`${panel} flex flex-col items-start gap-4`}>
        <p role="alert">{error === 404 ? (id ? "Cette offre est introuvable ou n’est plus disponible." : "Cette page d’offres n’existe pas.") : "Impossible de charger les offres. Vérifiez votre connexion et réessayez."}</p>
        {error === 404 ? <Link to="/recruiter/offers" className={`text-primary underline ${focus}`}>Voir vos offres</Link> : <Button onClick={() => setRetry(value => value + 1)}>Réessayer</Button>}
      </div>}
      {list && !pageMissing && <>
        <p className="sr-only" role="status">{list.length} offres publiées. Page {page}. Les plus récentes en premier.</p>
        {list.length === 0 ? <p className={panel}>Vous n’avez aucune offre publiée pour le moment.</p> : <ul className="recruiter-offer-grid">
          {visibleOffers?.map(item => <li key={item.id} className="recruiter-offer-card">
            <h2>{item.title}</h2>
            <OfferImage offer={item} />
            <div className="recruiter-card-description"><p>{item.description}</p>
              <Link to={`/recruiter/offers/${item.id}?page=${page}`} className={`recruiter-more-link ${focus}`}>Plus d’informations<span className="sr-only"> : {item.title}</span></Link>
            </div>
            <OfferActions title={item.title} />
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
            <p className="text-gray-500">Publiée le {new Date(offer.created_at).toLocaleDateString("fr-FR")}</p>
          </div>
        </div>
        <h3>Description du poste</h3>
        <p className="recruiter-detail-copy">{offer.description}</p>
        {offer.requirements && <><h3>Profil recherché</h3><p className="recruiter-detail-copy">{offer.requirements}</p></>}
      </article>}
    </main>
  </div>;
}
