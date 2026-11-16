# REC-05 — interface recruteur (frontend)

Routes protégées par RequireRecruiter : `/recruiter/messages` et `/recruiter/messages/:id`.
Le profil transmet `?candidate=<id>` pour sélectionner une conversation existante,
avec l'identifiant du compte du candidat (celui de `/api/recruiter/candidates/<id>`).
La création d'une conversation reste à coordonner avec JOB-041 ; aucune conversation
n'est créée automatiquement à l'ouverture d'un profil. Sans conversation avec ce
candidat, la page l'indique et renvoie vers la liste.

Le fil réutilise MessageThread et les GET/POST de JOB-034, sans stockage parallèle.
Envoi refusé si vide ou > 2000 caractères. Brouillon conservé en cas d'erreur.
Horodatages serveur, affichage local fr-FR, regroupement par jour. Polling des
messages toutes les 10 secondes lorsque l'onglet est visible.

## Liste et présence

La liste vient de `GET /api/recruiter/conversations` : contrat et mécanisme de présence
dans `docs/api/recruiter-conversations.md`. La recherche par nom filtre la liste chargée ;
la recherche côté serveur et le bouton « + » relèvent de JOB-041.

Le serveur envoie l'âge de la dernière requête du candidat (`seen_seconds_ago`), que
`front/services/recruiterConversations.ts` convertit en `last_seen_at` dans l'horloge du
navigateur. « En ligne » pendant 120 secondes, puis « Hors ligne » ; `null` affiche
« Présence indisponible ». Le navigateur réévalue l'expiration toutes les 5 secondes
et actualise la liste toutes les 30 secondes quand la page est visible.
Côté étudiant, `RequireStudent` envoie une requête par minute tant que la page est
visible (`front/services/presence.ts`).

La conformité visuelle Figma reste à valider.
