import { useEffect, useState } from "react";
import { Link, Navigate, useParams, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Navbar from "../components/Navbar";
import Pagination from "../components/Pagination";
import { EditOfferDialog, DeleteOfferDialog } from "../components/OfferDialogs";
import { getSession, type SessionResult } from "../services/auth";
import { offerRequest, offerUrl, type Offer, type OfferPage } from "../services/offers";
import { card, focus } from "../utils/searchPageStyles";

export default function RecruiterOffersPage() {
	const { id } = useParams();
	const navigate = useNavigate();
	const [session, setSession] = useState<SessionResult | null>(null);
	const [page, setPage] = useState(1);
	const [data, setData] = useState<OfferPage | null>(null);
	const [detail, setDetail] = useState<Offer | null>(null);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [loading, setLoading] = useState(true);
	const [revision, setRevision] = useState(0);
	const [dialog, setDialog] = useState<{ action: "edit" | "delete"; offer: Offer } | null>(null);
	useEffect(() => { getSession().then(setSession); }, [revision]);
	useEffect(() => {
		if (!session?.ok || session.user.role !== 3) return;
		let active = true;
		setLoading(true); setError(""); setData(null); setDetail(null);
		const load = id ? offerRequest<Offer>(offerUrl(Number(id))) : offerRequest<OfferPage>(`/api/recruiter/offers?page=${page}`);
		load.then(result => {
			if (!active) return;
			if (id) setDetail(result as Offer); else setData(result as OfferPage);
		}).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
		return () => { active = false; };
	}, [session, id, page, revision]);
	if (session && !session.ok && session.reason === "noSession") return <Navigate to="/login" replace />;
	if (session?.ok && session.user.role !== 3) return <main className="p-8"><h1>Accès réservé aux recruteurs</h1><Link to="/">Accueil</Link></main>;
	function changed(message: string) { setDialog(null); setNotice(message); setPage(1); setRevision(value => value + 1); }
	function actions(offer: Offer) { return <div className="flex gap-4">
		<button className={`rounded-lg p-2 text-primary ${focus}`} aria-label={`Modifier l’offre ${offer.title}`} onClick={() => setDialog({ action: "edit", offer })}>✎ Modifier</button>
		<button className={`inline-flex items-center gap-2 rounded-lg p-2 text-red-700 ${focus}`} aria-label={`Supprimer l’offre ${offer.title}`} onClick={() => setDialog({ action: "delete", offer })}>
			<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>
			Supprimer
		</button>
	</div>; }
	return <div className="min-h-dvh bg-[#f0f0f0] p-4 pb-16 md:p-6">
		<Navbar><Link className="ml-auto text-primary" to="/recruiter/offers">Vos offres</Link></Navbar>
		<main className="mx-auto mt-10 max-w-[1236px]">
			<h1 className="mb-6 text-4xl font-bold">{id ? "Détail de l’offre" : "Vos offres"}</h1>
			{notice && <p role="status" className="mb-4 text-green-800">{notice}</p>}
			{(!session || (session.ok && loading)) && <p role="status">Chargement…</p>}
			{session && !session.ok && <p role="alert">Impossible de vérifier votre connexion.</p>}
			{error && <p role="alert" className="mb-4 text-red-700">{error}</p>}
			{(error || (session && !session.ok)) && <Button onClick={() => setRevision(value => value + 1)}>Réessayer</Button>}
			{id && <Link to="/recruiter/offers" className="mb-6 block text-primary underline">Retour à vos offres</Link>}
			{detail && <article className={`${card} max-w-3xl`}>
				{detail.image_url && <img className="h-56 w-full rounded-xl object-cover" src={detail.image_url} alt="" />}
				<h2 className="text-2xl font-semibold">{detail.title}</h2><p>{detail.company} · {detail.location}</p>
				<p>{detail.contract_type} · {detail.duration}{detail.start_date && ` · À partir du ${detail.start_date}`}</p>
				<p className="whitespace-pre-wrap break-words">{detail.description}</p><p>Compétences : {detail.requirements || "Non précisées"}</p>{actions(detail)}
			</article>}
			{data && <><p className="mb-4 text-gray-600">{data.count} offre(s)</p>
				{data.count === 0 && <p>Aucune offre publiée pour le moment.</p>}
				<ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.results.map(offer => <li key={offer.id} className={card}>
					{offer.image_url && <img className="h-40 w-full rounded-xl object-cover" src={offer.image_url} alt="" />}
					<h2 className="break-words text-xl font-semibold">{offer.title}</h2><p>{offer.company} · {offer.location}</p>
					<p className="line-clamp-3 break-words">{offer.description}</p>
					<Link className="text-primary underline" to={`/recruiter/offers/${offer.id}`}>Plus d’informations<span className="sr-only"> sur {offer.title}</span></Link>{actions(offer)}
				</li>)}</ul>
				<Pagination currentPage={page} totalPages={Math.ceil(data.count / 6)} onPageChange={setPage} />
			</>}
		</main>
		{dialog?.action === "edit" && <EditOfferDialog offer={dialog.offer} onClose={() => setDialog(null)} onSaved={() => changed("L’offre a été modifiée.")} />}
		{dialog?.action === "delete" && <DeleteOfferDialog offer={dialog.offer} onClose={() => setDialog(null)} onDeleted={() => { changed("L’offre a été supprimée."); if (id) navigate("/recruiter/offers"); }} />}
	</div>;
}
