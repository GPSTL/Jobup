# Student profile API

Contract between the profile API (JOB-008) and the “Mon espace” page (JOB-017): reading and updating the photo, the personal description and the desired position. The CV has its own API (JOB-018).

## Authentication

- The routes use the Django session opened by `POST /api/login`: every front-end request passes `credentials: "same-origin"`.
- `<id>` is the account id, that is, the `id` field returned by `POST /api/login` and `GET /api/me`.
- `PATCH` and `POST` requests send the `X-CSRFToken` header with the value of the `csrftoken` cookie. This cookie is set by the `POST /api/login` response and changes at every login. `GET /api/csrf` also returns the token, as `{"csrfToken": "…"}`: this is what the signup page uses.

## The profile

All three routes respond with the same body, the profile:

```json
{
  "photo_url": "/media/photos/3f2b8c1e.png",
  "description": "Étudiant en M2 informatique, à la recherche d’une alternance de 12 mois.",
  "desired_position": "Développeur web"
}
```

| Field | Type | Content |
| --- | --- | --- |
| `photo_url` | string or `null` | URL of the photo, to use as is in `src`; `null` when there is no photo. Each new photo gets a new URL. |
| `description` | string | Personal description, 500 characters max; empty string if not written yet. |
| `desired_position` | string | Desired position as free text, 100 characters max; empty string if not filled in. |

No field is required: the profile can be incomplete. The body is the student sheet (`Student.to_dict()`), so it also contains other student fields (`uid`, `category`, `experience_level`…), which are not part of this contract. Since the body is the same for the three routes, the front end can replace its copy of the profile with the response to a `PATCH` or a `POST`.

## Routes

### `GET /api/student/<id>`

Returns the profile. Available to the student themselves and to administrators.

### `PATCH /api/student/<id>`

Updates the description, the desired position, or both. Restricted to the student themselves.

The JSON body contains one or more of the `description` and `desired_position` fields; fields left out do not change:

```json
{ "desired_position": "Développeur web" }
```

Leading and trailing spaces are removed, and an empty string clears the field. Any other field (`role`, `email`, `photo_url`…) is refused: this route changes neither the role nor the rights of the account.

### `POST /api/student/<id>/photo`

Replaces the photo. Restricted to the student themselves.

The body is `multipart/form-data`, with the file in the `photo` field: JPG or PNG (checked on the file content, not on its extension), 2 MB max, that is 2 × 1024 × 1024 bytes, and 25 megapixels max (width × height ≤ 25,000,000).

The photo is saved again from its pixels: its metadata (EXIF, which holds the GPS position of phone photos, XMP, comment) are removed, except the color profile, and the orientation given by the EXIF is applied to the image. The previous photo is deleted.

## Status codes

| Case | Code | Body |
| --- | --- | --- |
| Success | `200` | The profile, updated after a `PATCH` or a `POST` |
| Invalid data | `400` | `{"errors": {"<field>": "<message>", …}}` |
| No session | `403` | `{"detail": "Authentication credentials were not provided."}` |
| `X-CSRFToken` header missing or wrong | `403` | `{"detail": "CSRF Failed: …"}` |
| `<id>` of another account, whether it exists or not (except `GET` by an administrator) | `403` | `{"error": "Forbidden"}` |
| No student profile for this `<id>` | `404` | `{"error": "Student not found"}` |

Without a session, the API responds `403`, not `401`: this is how DRF behaves with Django sessions. Since the front end only requests the profile of the logged-in student, a `403` on these routes means in practice that the session has expired.

A `400` without `errors` signals a malformed body (unreadable JSON, or JSON that is not an object): it is a front-end bug, to be handled like a server error.

## Error messages per field

The messages in `errors` are in French, like the interface, and are displayed as is:

| Field | Case | Message |
| --- | --- | --- |
| `description` | More than 500 characters | La présentation ne doit pas dépasser 500 caractères. |
| `desired_position` | More than 100 characters | Le poste recherché ne doit pas dépasser 100 caractères. |
| `description` or `desired_position` | Value that is not a string | Ce champ doit être un texte. |
| Any other `PATCH` field | Field that cannot be changed | Ce champ ne peut pas être modifié. |
| `photo` | No file sent | Aucune photo reçue. |
| `photo` | Neither JPG nor PNG | La photo doit être au format JPG ou PNG. |
| `photo` | More than 2 MB | La photo ne doit pas dépasser 2 Mo. |
| `photo` | More than 25 megapixels | La photo ne doit pas dépasser 25 mégapixels. |

## Front-end example

```ts
// Read on every request: the token changes at each login
const csrfToken = () => document.cookie.match(/(?:^|; )csrftoken=([^;]*)/)?.[1] ?? "";

// Update the desired position
await fetch(`/api/student/${id}`, {
	method: "PATCH",
	credentials: "same-origin",
	headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken() },
	body: JSON.stringify({ desired_position: "Développeur web" }),
});

// Replace the photo: without Content-Type, which the browser adds itself for a FormData
const body = new FormData();
body.append("photo", file);
await fetch(`/api/student/${id}/photo`, {
	method: "POST",
	credentials: "same-origin",
	headers: { "X-CSRFToken": csrfToken() },
	body,
});
```
