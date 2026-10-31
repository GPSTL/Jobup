# API du profil étudiant

Contrat entre l’API du profil (JOB-008) et la page « Mon espace » (JOB-017) : consultation et modification de la photo, de la présentation personnelle et du poste recherché. Le CV a sa propre API (JOB-018).

## Authentification

- Les routes utilisent la session Django ouverte par `POST /api/login` : chaque requête du front passe `credentials: "same-origin"`.
- `<id>` est l’identifiant du compte, c’est-à-dire le champ `id` renvoyé par `POST /api/login` et `GET /api/me`.
- Les requêtes `PATCH` et `POST` envoient l’en-tête `X-CSRFToken` avec la valeur du cookie `csrftoken`. Ce cookie est posé par la réponse de `POST /api/login` et change à chaque connexion.

## Le profil

Les trois routes répondent avec le profil :

```json
{
  "photo_url": "/media/photos/3f2b8c1e.png",
  "description": "Étudiant en M2 informatique, à la recherche d’une alternance de 12 mois.",
  "desired_position": "Développeur web"
}
```

| Champ | Type | Contenu |
| --- | --- | --- |
| `photo_url` | chaîne ou `null` | URL de la photo, à utiliser telle quelle dans `src` ; `null` sans photo. Chaque nouvelle photo a une nouvelle URL. |
| `description` | chaîne | Présentation personnelle, 500 caractères maximum ; chaîne vide si elle n’est pas rédigée. |
| `desired_position` | chaîne | Poste recherché en texte libre, 100 caractères maximum ; chaîne vide s’il n’est pas renseigné. |

Aucun champ n’est obligatoire : le profil peut être incomplet. La réponse peut contenir d’autres champs de l’étudiant, qui ne font pas partie de ce contrat.

## Routes

### `GET /api/student/<id>`

Renvoie le profil. Accessible à l’étudiant lui-même et aux administrateurs.

### `PATCH /api/student/<id>`

Modifie la présentation, le poste recherché, ou les deux. Réservé à l’étudiant lui-même.

Le corps JSON contient un ou plusieurs champs parmi `description` et `desired_position` ; les champs absents ne changent pas :

```json
{ "desired_position": "Développeur web" }
```

Les espaces en début et en fin de texte sont retirés, et une chaîne vide efface le champ. Tout autre champ (`role`, `email`, `photo_url`…) est refusé : cette route ne modifie ni le rôle ni les droits du compte.

### `POST /api/student/<id>/photo`

Remplace la photo. Réservé à l’étudiant lui-même.

Le corps est en `multipart/form-data`, avec le fichier dans le champ `photo` : JPG ou PNG (vérifié sur le contenu du fichier, pas sur son extension), 2 Mo maximum, soit 2 × 1024 × 1024 octets. L’ancienne photo est supprimée.

## Codes de retour

| Cas | Code | Corps |
| --- | --- | --- |
| Succès | `200` | Le profil, à jour après un `PATCH` ou un `POST` |
| Données invalides | `400` | `{"errors": {"<champ>": "<message>", …}}` |
| Pas de session | `403` | `{"detail": "Authentication credentials were not provided."}` |
| En-tête `X-CSRFToken` absent ou faux | `403` | `{"detail": "CSRF Failed: …"}` |
| `<id>` d’un autre compte, qu’il existe ou non (sauf `GET` par un administrateur) | `403` | `{"error": "Forbidden"}` |
| Pas de profil étudiant pour cet `<id>` | `404` | `{"error": "Student not found"}` |

Sans session, l’API répond `403` et non `401` : c’est le comportement de DRF avec la session Django. Comme le front ne demande que le profil de l’étudiant connecté, un `403` sur ces routes signifie en pratique que la session a expiré.

Un `400` sans `errors` signale un corps mal formé (JSON illisible, ou qui n’est pas un objet) : c’est un bug du front, à traiter comme une erreur serveur.

## Messages d’erreur par champ

Les messages de `errors` sont en français et s’affichent tels quels :

| Champ | Cas | Message |
| --- | --- | --- |
| `description` | Plus de 500 caractères | La présentation ne doit pas dépasser 500 caractères. |
| `desired_position` | Plus de 100 caractères | Le poste recherché ne doit pas dépasser 100 caractères. |
| `description` ou `desired_position` | Valeur qui n’est pas un texte | Ce champ doit être un texte. |
| Tout autre champ du `PATCH` | Champ non modifiable | Ce champ ne peut pas être modifié. |
| `photo` | Aucun fichier envoyé | Aucune photo reçue. |
| `photo` | Ni JPG ni PNG | La photo doit être au format JPG ou PNG. |
| `photo` | Plus de 2 Mo | La photo ne doit pas dépasser 2 Mo. |

## Exemple côté front

```ts
// Lu à chaque requête : le jeton change à chaque connexion
const csrfToken = () => document.cookie.match(/(?:^|; )csrftoken=([^;]*)/)?.[1] ?? "";

// Modifier le poste recherché
await fetch(`/api/student/${id}`, {
	method: "PATCH",
	credentials: "same-origin",
	headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken() },
	body: JSON.stringify({ desired_position: "Développeur web" }),
});

// Remplacer la photo : sans Content-Type, que le navigateur ajoute lui-même pour un FormData
const body = new FormData();
body.append("photo", file);
await fetch(`/api/student/${id}/photo`, {
	method: "POST",
	credentials: "same-origin",
	headers: { "X-CSRFToken": csrfToken() },
	body,
});
```
