# Entretiens

Pendant l'étude d'une candidature (statut « Lue » ou « En cours d'étude »), le recruteur propose un ou plusieurs créneaux d'entretien ; l'étudiant en retient un. Code : `jobup/interviews.py` (règles), `jobup/recruiter_offers.py` (routes du recruteur), `jobup/api.py` (route de l'étudiant). Modèles `Interview` (une par candidature) et `InterviewSlot`.

Les dates sont en ISO 8601 avec leur fuseau ; un horaire sans fuseau est refusé. Les requêtes qui modifient demandent l'en-tête `X-CSRFToken` (`GET /api/csrf`).

## Chevauchements

- Les créneaux d'une même proposition ne se chevauchent pas entre eux.
- Aucun créneau proposé ne chevauche un entretien déjà confirmé du recruteur, avec un autre candidat (`409 Recruiter busy`).
- Un même horaire peut être proposé à plusieurs candidats : le premier qui le choisit le prend. Chez les autres, les créneaux qui le chevauchent passent en `unavailable: "taken"` et ne peuvent plus être choisis (`409 Slot taken`).
- L'étudiant ne peut pas retenir un créneau qui chevauche un de ses entretiens confirmés, chez n'importe quel recruteur (`unavailable: "busy"`, `409 Student busy`). Le recruteur ne voit jamais cette information.
- Deux créneaux qui se touchent (fin de l'un = début de l'autre) ne se chevauchent pas.
- Une candidature refusée libère le créneau de son entretien.

## Objet `interview`

```json
{
  "id": 4,
  "status": "proposed",
  "location": "Visio : lien envoyé par message",
  "message": "Prévoir 45 minutes.",
  "created_at": "2026-11-23T15:00:00Z",
  "slots": [
    { "id": 9, "starts_at": "2026-11-26T13:00:00Z", "ends_at": "2026-11-26T14:00:00Z", "chosen": false, "unavailable": null },
    { "id": 10, "starts_at": "2026-11-27T08:00:00Z", "ends_at": "2026-11-27T08:45:00Z", "chosen": false, "unavailable": "taken" }
  ],
  "confirmed_slot": null,
  "available_count": 1
}
```

- `status` : `proposed` tant que l'étudiant n'a pas choisi, puis `confirmed` ; `confirmed_slot` est alors le créneau retenu (`chosen: true`).
- `slots` : du plus proche au plus lointain. `unavailable` : `null` (le créneau peut être choisi), `passed` (déjà commencé), `taken` (pris par un autre candidat du même recruteur) ou `busy` (vue de l'étudiant seulement). Toujours `null` une fois l'entretien confirmé.
- `available_count` : créneaux que l'étudiant peut encore choisir ; `0` une fois l'entretien confirmé.

## Recruteur

### `POST /api/recruiter/applications/<id>/interview`

```json
{
  "slots": [{ "starts_at": "2026-11-26T14:00:00+01:00", "ends_at": "2026-11-26T15:00:00+01:00" }],
  "location": "",
  "message": ""
}
```

De 1 à 10 créneaux ; `location` (200 caractères) et `message` (1 024) facultatifs. Une proposition à laquelle l'étudiant n'a pas encore répondu est remplacée par la nouvelle. Répond `201` avec le détail de la candidature (`GET /api/recruiter/applications/<id>`), qui contient désormais :

- `interview` : l'objet ci-dessus, ou `null` ;
- `upcoming_interviews` : les autres entretiens confirmés et pas encore terminés du recruteur, `[{ starts_at, ends_at, candidate, offer, application_id }]`, pour signaler un chevauchement dès la saisie.

Erreurs :

| Statut | `error` | Cas |
|---|---|---|
| 400 | `Invalid payload` | Corps invalide : aucun ou plus de 10 créneaux, horaire sans fuseau, champ inconnu, texte trop long |
| 400 | `Invalid duration` | Un créneau dure moins de 15 minutes ou plus de 4 heures (ou finit avant de commencer) |
| 400 | `Slot in the past` | Un créneau a déjà commencé |
| 400 | `Slot too far` | Un créneau commence dans plus d'un an |
| 400 | `Slots overlap` | Deux créneaux de la proposition se chevauchent |
| 409 | `Recruiter busy` | Un créneau chevauche un entretien confirmé du recruteur |
| 409 | `Application not in review` | La candidature n'est pas « Lue » ou « En cours d'étude » |
| 409 | `Interview already confirmed` | L'étudiant a déjà choisi : annuler l'entretien avant d'en proposer un autre |
| 404 | `Application not found` | Candidature inconnue, brouillon, ou d'une offre d'un autre recruteur (même de l'entreprise) |

Les erreurs sur un créneau ajoutent `slot`, l'indice du créneau en cause dans la liste envoyée.

### `DELETE /api/recruiter/applications/<id>/interview`

Annule l'entretien, proposé ou confirmé ; l'étudiant est prévenu. Répond `200` avec le détail de la candidature (`interview: null`), `404 Interview not found` sans entretien.

### `GET /api/recruiter/offers/<id>/applicants`

Chaque candidature porte `interview` : `null`, ou `{ status, slot_count, confirmed_slot }` (sans le détail des créneaux). La page de l'offre en tire la liste « Entretiens prévus ».

## Étudiant

### `GET /api/applications`

Ajoute `interviews` : les candidatures en cours d'étude qui ont un entretien, chacune avec son objet `interview`. Elles restent aussi dans `in_progress` ; la page « Candidatures » les range dans sa colonne « Entretiens ».

`GET /api/applications/<id>` ajoute `interview` (objet ci-dessus, avec `busy`) ou `null`.

### `POST /api/applications/<id>/interview`

`{ "slot": 9 }` : retient ce créneau. Répond `200` avec le détail de la candidature. Renvoyer le créneau déjà retenu ne change rien.

| Statut | `error` | Cas |
|---|---|---|
| 400 | `Invalid payload` | `slot` absent ou invalide |
| 404 | `Application not found` | Candidature inconnue ou d'un autre étudiant |
| 404 | `Interview not found` | Pas d'entretien (jamais proposé, ou annulé) |
| 404 | `Slot not found` | Le créneau n'appartient pas à cet entretien |
| 409 | `Application closed` | La candidature n'est plus en cours d'étude |
| 409 | `Interview already confirmed` | Un autre créneau est déjà retenu |
| 409 | `Slot passed` / `Slot taken` / `Student busy` | Le créneau ne peut plus être choisi (voir « Chevauchements ») |

## Notifications

Type `interview` (`docs/api/notifications.md`) :

| Événement | Destinataire | Préférence |
|---|---|---|
| Créneaux proposés (ou remplacés) | L'étudiant : « Entretien proposé », lien `/applications/<id>` | `application_status` |
| Entretien annulé | L'étudiant : « Entretien annulé » | `application_status` |
| Créneau choisi | Le recruteur de l'offre : « Entretien confirmé », avec la date, lien `/recruiter/applications/<id>` | `new_applications` |
