import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";


// Provisional contract: recruiter-authorized records must be returned by the server.
// TODO JOB-008/JOB-018: validate profile fields and authorization rules before API integration.
const candidates = [
	{
		id: "sarah-benali",
		photo: null as string | null,
		school: "IUT Montreuil" as string | null,
		cv: null as { downloadUrl: string } | null,
		skills: ["Angular", "TypeScript", "Accessibilité"],
		availability: "Octobre 2026",
		duration: "12 mois",
		name: "Sarah Benali",
		initials: "SB",
		education: "Licence Pro Dev Web — IUT Montreuil",
		bio: "Passionnée de front-end (Angular, accessibilité), je cherche une alternance de 12 mois en développement web. Disponible dès octobre 2026.",
	},
	{
		id: "lucas-martin", photo: null, school: "Université Paris Cité", cv: null,
		skills: ["React", "JavaScript", "CSS"], availability: "Novembre 2026", duration: "12 mois",
		name: "Lucas Martin", initials: "LM", education: "Licence Informatique",
		bio: "Je recherche une alternance en développement front-end pour contribuer à des interfaces accessibles et découvrir le travail en équipe.",
	},
	{
		id: "ines-diallo", photo: null, school: null, cv: null,
		skills: ["Python", "Django", "SQL"], availability: "Janvier 2027", duration: "24 mois",
		name: "Inès Diallo", initials: "ID", education: "Master Informatique",
		bio: "Intéressée par le développement back-end, je souhaite approfondir mes compétences en API et en bases de données pendant une alternance.",
	},
];
// TODO: replace demonstration messages with the authenticated messaging API.
const initialMessages = [
	{ id: 1, candidateId: "sarah-benali", sender: "Sarah Benali", subject: "Ma candidature en alternance", body: "Bonjour, je suis intéressée par votre offre en développement web. Je suis disponible pour échanger sur ma candidature.", read: false },
	{ id: 2, candidateId: null, sender: "Équipe JobUp", subject: "Bienvenue sur JobUp", body: "Retrouvez ici les échanges avec vos candidats. Ces messages sont des exemples pour présenter la messagerie.", read: false },
];
const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

export default function EntrepriseCandita() {
	const [params, setParams] = useSearchParams();
	const profileId = params.get("profil");
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState(false);
	const [records, setRecords] = useState<typeof candidates>([]);
	const [retry, setRetry] = useState(0);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setLoadError(false);
		// TODO: replace this mock with an authenticated recruiter API. Never fetch all
		// students and filter permissions in the browser. Server must authorize each record.
		Promise.resolve(candidates).then((data) => {
			if (!cancelled) setRecords(data);
		}).catch(() => {
			if (!cancelled) setLoadError(true);
		}).finally(() => {
			if (!cancelled) setLoading(false);
		});
		return () => { cancelled = true; };
	}, [retry]);
	const [message, setMessage] = useState("");
	const [activeNav, setActiveNav] = useState("Candidats");
	const selectedId = profileId ?? params.get("candidat");
	const candidateIndex = selectedId ? records.findIndex((item) => item.id === selectedId) : 0;
	const candidate = records[candidateIndex];
	function changeCandidate(offset: number) {
		const next = records[candidateIndex + offset];
		if (next) {
			setParams({ candidat: next.id }, { replace: true });
			setMessage("");
		}
	}
	const profileOpen = Boolean(profileId);
	function showProfile() { if (candidate) setParams({ profil: candidate.id }); }
	function closeProfile() { setParams(candidate ? { candidat: candidate.id } : {}); }
	const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
	const messages = initialMessages;

	return (
		<div className="min-h-dvh bg-[#f0f0f0] px-4 pt-6 pb-16 text-ink md:px-6">
			<header className="relative z-20 mx-auto max-w-[972px]">
				<Navbar>
					<div onMouseLeave={() => setActiveNav("Candidats")} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setActiveNav("Candidats"); }} className="ml-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-3 text-[15px] font-medium md:gap-x-9">
						{["Mon espace", "Filtrer", "Candidats", "Vos offres", "Messages"].map((label) => (
							<Link key={label} to={label === "Candidats" ? "/entreprise/candidats" : "/coming-soon"} aria-current={label === "Candidats" ? "page" : undefined} onMouseEnter={() => setActiveNav(label)} onFocus={() => setActiveNav(label)} onClick={() => setActiveNav(label)} className={`rounded-lg px-4 py-1 motion-safe:transition-colors ${activeNav === label ? "bg-primary text-on-primary" : "text-ink"} ${focus}`}>
								{label}
							</Link>
						))}
						<span role="img" aria-label="Notifications">
							<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" strokeLinecap="round" strokeLinejoin="round" /></svg>
						</span>
					</div>
				</Navbar>


			</header>

			<main className={`mx-auto mt-9 ${profileOpen ? "max-w-[720px]" : "max-w-[365px]"}`}>
				<p className="mb-4 text-center text-sm text-gray-500">Aperçu avec données fictives</p>
				{loading && <p role="status">Chargement des candidats…</p>}
				{loadError && <div role="alert"><p>Impossible de charger les candidats.</p><button type="button" onClick={() => setRetry((value) => value + 1)} className={`mt-3 text-primary underline ${focus}`}>Réessayer</button></div>}
				<h1 className="sr-only">Candidats à une alternance</h1>
				{!loading && !loadError && (candidate ? (
					<div className="relative isolate pb-8 before:absolute before:inset-x-0 before:top-8 before:bottom-0 before:-z-10 before:rounded-[20px] before:bg-white before:shadow-md">
						{!profileOpen && <nav aria-label="Parcourir les candidats" className="mb-4 flex items-center justify-between gap-3 sm:absolute sm:inset-x-[-64px] sm:top-1/2 sm:mb-0 sm:-translate-y-1/2">
							<button type="button" aria-label="Candidat précédent" disabled={candidateIndex <= 0} onClick={() => changeCandidate(-1)} className={`flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-primary bg-white text-3xl text-primary shadow-sm hover:bg-primary hover:text-white disabled:cursor-default disabled:border-gray-300 disabled:text-gray-300 disabled:hover:bg-white ${focus}`}><span aria-hidden="true">‹</span></button>
							<p role="status" aria-live="polite" className="text-sm text-gray-500 sm:sr-only">Candidat {candidateIndex + 1} sur {records.length} : {candidate.name}</p>
							<button type="button" aria-label="Candidat suivant" disabled={candidateIndex >= records.length - 1} onClick={() => changeCandidate(1)} className={`flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-primary bg-white text-3xl text-primary shadow-sm hover:bg-primary hover:text-white disabled:cursor-default disabled:border-gray-300 disabled:text-gray-300 disabled:hover:bg-white ${focus}`}><span aria-hidden="true">›</span></button>
						</nav>}

						<article onClick={profileOpen ? undefined : showProfile} className="relative flex min-h-[555px] flex-col rounded-[20px] bg-white px-8 pt-6 pb-7 shadow-[0_3px_10px_rgba(0,0,0,0.12)] sm:px-[56px]">
							<h2 className="text-center text-[28px] leading-tight font-semibold"><button type="button" onClick={showProfile} className={`cursor-pointer ${focus} ${profileOpen ? "" : "after:absolute after:inset-0 after:rounded-[20px]"}`}>{candidate.name}</button></h2>
							<p className="mt-3 text-center text-[18px] leading-[18px] font-medium">{candidate.education}</p>
							<p className="mt-2 text-center text-gray-600">{candidate.school ?? "École non renseignée"}</p>
							{candidate.photo && failedPhoto !== candidate.photo ? <img src={candidate.photo} alt={`Photo de ${candidate.name}`} onError={() => setFailedPhoto(candidate.photo)} className="mx-auto mt-4 size-[136px] rounded-full object-cover" /> : <div role="img" aria-label={`Photo non renseignée : ${candidate.initials}`} className="mx-auto mt-4 flex size-[136px] shrink-0 items-center justify-center rounded-full border-[3px] border-violet-200 bg-violet-600 text-[42px] font-bold text-white">{candidate.initials}</div>}
							<p className="mt-3 text-[18px] leading-[18px]">{candidate.bio}</p>
							{!profileOpen && <button type="button" onClick={showProfile} className={`relative z-10 mt-5 w-full cursor-pointer rounded-lg border border-primary px-5 py-3 text-[18px] font-medium text-primary hover:bg-primary hover:text-on-primary focus-visible:bg-primary focus-visible:text-on-primary motion-safe:transition-colors ${focus}`}>Consulter le profil</button>}
							{/* TODO: downloadUrl must be a server endpoint that checks recruiter access,
							    not a public media URL. No broken download action for missing CVs. */}
							{candidate.cv ? <a href={candidate.cv.downloadUrl} download onClick={(event) => event.stopPropagation()} className={`relative z-10 mt-3 underline ${focus}`}>Télécharger le CV</a> : <p className="mt-3 text-gray-500">CV non fourni</p>}
							{profileOpen && <>
								<dl className="mt-6 space-y-3"><div><dt className="font-semibold">Compétences</dt><dd>{candidate.skills.join(", ")}</dd></div><div><dt className="font-semibold">Disponibilité</dt><dd>{candidate.availability}</dd></div><div><dt className="font-semibold">Durée recherchée</dt><dd>{candidate.duration}</dd></div></dl>
								<section aria-label="Historique des échanges" className="mt-6 border-t border-gray-200 pt-4">
									<h3 className="text-xl font-semibold">Historique des échanges</h3>
									{/* TODO JOB-039: load only this recruiter's authorized conversation.
									    This candidateId filter scopes mock display; it is not access control. */}
									{messages.filter((item) => item.candidateId === candidate.id).map((item) => <article key={item.id} className="mt-3 rounded-lg bg-gray-50 p-3"><h4 className="font-medium">{item.sender} — {item.subject}</h4><p className="mt-2">{item.body}</p></article>)}
									{!messages.some((item) => item.candidateId === candidate.id) && <p className="mt-3 text-gray-500">Aucun échange avec ce candidat.</p>}
								</section>
								<div className="relative z-10 mt-6 flex flex-col gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:justify-between">
									<button type="button" onClick={(event) => { event.stopPropagation(); closeProfile(); }} className={`cursor-pointer rounded-lg border border-primary px-5 py-3 font-medium text-primary hover:bg-primary hover:text-on-primary focus-visible:bg-primary focus-visible:text-on-primary ${focus}`}>Retour aux candidats</button>
									{/* TODO JOB-039: open the existing authorized conversation, or compose a first message and create the conversation on send. */}
									<button type="button" onClick={() => setMessage("La messagerie sera bientôt disponible. Aucun message n’a été envoyé.")} className={`cursor-pointer rounded-lg border border-primary px-5 py-3 font-medium text-primary hover:bg-primary hover:text-on-primary focus-visible:bg-primary focus-visible:text-on-primary ${focus}`}>Contacter le candidat</button>
								</div>
							</>}

						</article>
					</div>
				) : (
					<section className="rounded-[20px] bg-white p-8 text-center shadow-md">
						<h2 className="text-2xl font-semibold">{profileId ? "Profil introuvable ou inaccessible" : "Aucun candidat disponible"}</h2>
						<p className="mt-3 text-gray-600">{profileId ? "Ce profil ne fait pas partie des candidats accessibles." : "Les candidats disponibles apparaîtront ici."}</p>
						<button type="button" className={`mt-6 cursor-pointer rounded-lg bg-primary px-5 py-3 text-white ${focus}`} onClick={closeProfile}>Retour aux candidats</button>
					</section>
				))}
				<p role="status" className="mt-5 text-center text-sm text-gray-600">{message}</p>
			</main>
		</div>
	);
}
