# JOB-044 — Décision sur une candidature (REC-24)

La candidature réelle (`JobApplication.status`) est **l'unique source du statut** : la liste recruteur (`GET /api/recruiter/offers/<offer_id>/applicants`), le suivi étudiant (`GET /api/applications` et `GET /api/applications/<id>`) et toute future statistique école doivent lire ce champ, sans statut parallèle lié à la présélection.

## Transitions autorisées

| Depuis | Action | Vers |
| --- | --- | --- |
| Brouillon (0) | Envoi par l'étudiant (déjà existant) | Postulée (1) |
| Postulée (1) | **Ouvrir la candidature** par le recruteur propriétaire | En cours d’étude (3) |
| En cours d’étude (3) | Accepter / Refuser | Acceptée (4) / Refusée (5) |
| Lue (2, historique) | Accepter / Refuser | Acceptée (4) / Refusée (5) |
| Acceptée (4) / Refusée (5) | Toute tentative de changer la décision | **409** (décision définitive) |

« Lue » (2) reste toléré pour les données existantes et s'affiche déjà « En cours d'étude ». La liste des candidats d'une offre n'ouvre pas individuellement leurs candidatures : elle n'effectue donc aucune transition. L'action « Ouvrir la candidature » mène au détail, qui effectue la transition au premier `GET`. Les offres clôturées et candidatures finalisées restent consultables. Les brouillons ne sont jamais accessibles au recruteur.

## API recruteur

Les deux méthodes sont réservées au recruteur **propriétaire de l'offre** (pas à un collègue de la même entreprise). Les autres rôles reçoivent `403`, et un ID inexistant ou hors périmètre retourne `404`.

- `GET /api/recruiter/applications/<id>` : ouvre la candidature ; passe `Postulée` à `En cours d'étude` une seule fois ; retourne `{ id, offer, candidate, status, submitted_at, message, decision_message, conversation_id, contract, interview, upcoming_interviews }` (entretien : voir `interviews.md`). `message` reste la présentation envoyée par le candidat ; `decision_message` est la réponse facultative du recruteur.
- `PATCH /api/recruiter/applications/<id>` : corps JSON `{ "status": 4 | 5, "message": "..." }`, `message` facultatif, 1024 caractères maximum ; `200` et le même format de réponse. `400` si le corps est invalide, `409` si l'on décide avant ouverture ou tente de remplacer une décision. `PATCH` requiert un jeton CSRF Django `X-CSRFToken` (via `/api/csrf`).

Renvoyer **la même décision** retourne `200` avec la décision initiale et n'émet pas de nouvel événement, même si le message de la seconde requête diffère. Le changement de statut, le message et la création éventuelle de conversation sont regroupés dans une transaction.

## Visibilité et notifications

Le suivi étudiant affiche le même statut via le code numérique existant, et le détail de candidature affiche le `decision_message` lorsqu'une réponse a été donnée. Les notifications existantes sont émises après validation en base : passage en étude, acceptation ou refus. Si la décision porte un message, un extrait figure dans la notification ; le texte intégral reste dans le détail étudiant. Les événements uniques `application:<id>:review|accepted|refused` empêchent les notifications en double, y compris lors d'un nouvel envoi.

L'acceptation **crée ou réutilise** une `Conversation` pour ce recruteur et cet étudiant, sans ouvrir de conversation pour un refus. `conversation_id` pointe vers la messagerie déjà existante (`/recruiter/messages/<id>`). Le message de décision est transmis par la notification et le détail de candidature : il ne crée pas de deuxième notification « nouveau message ». La conversation permet ensuite d'échanger des messages.

Présélection (JOB-037), exclusion (JOB-038) et gestion des contrats restent indépendantes et ne sont pas modifiées.

Le contrat d'une candidature acceptée (`contract`, `null` tant qu'il n'est pas déposé) se dépose par `POST /api/recruiter/applications/<id>/contract` : voir `school.md`.
