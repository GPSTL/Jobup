# Student profile API

Contract between the profile API (JOB-008) and the “Mon espace” page (JOB-017): reading and updating the photo, the personal description, the desired position and, since JOB-071, the rest of the profile seen and filtered by the recruiters (program, study level, experience, skills, region, availability). The CV has its own API (JOB-018), which also suggests values of the profile from the CV (JOB-071): see [resume.md](resume.md).

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
  "desired_position": "Développeur web",
  "education": "Master MIAGE",
  "study_degree": 5,
  "category": 1,
  "experience_level": 14,
  "skills": ["Java", "Spring Boot", "SQL"],
  "region": "Île-de-France",
  "available_from": "2026-09-01"
}
```

| Field | Type | Content |
| --- | --- | --- |
| `photo_url` | string or `null` | URL of the photo, to use as is in `src`; `null` when there is no photo. Each new photo gets a new URL. |
| `description` | string | Personal description, 500 characters max; empty string if not written yet. |
| `desired_position` | string | Desired position as free text, 100 characters max; empty string if not filled in. |
| `education` | string | Program followed (“Master MIAGE”), 100 characters max; empty string if not filled in. Shown on the candidate cards of the recruiters (`education` of `/api/recruiter/candidates`). |
| `study_degree` | integer or `null` | `StudyDegree`: `1` to `5` for Bac + 1 to Bac + 5. |
| `category` | integer or `null` | `JobCategory`, the field of the search: the values of the sectors of the companies (`SECTORS` in `front/utils/companies.ts`), `99` for “Autre”. Neither the profile seen by the recruiters nor their filters read it, so “Mon espace” does not ask for it. |
| `experience_level` | integer | Professional experience in months, internships and apprenticeships included, `0` to `600`. The “Expérience” filter of the recruiters reads it; their candidate profile does not show it. |
| `skills` | array of strings | Skills, 20 max, 40 characters max each, without commas, once each whatever the case. Stored comma separated, 256 characters max in all. The “Logiciels maîtrisés” filter reads them. |
| `region` | string | Where the student looks for an apprenticeship, free text (a region, a city, “Télétravail”), 64 characters max. `Île-de-France` for a new profile. |
| `available_from` | string or `null` | Date from which the student is available, `AAAA-MM-JJ`. The recruiters see the month only (“Disponible en septembre 2026”, then “Disponible immédiatement”), and “Mon espace” shows it the same way. |

No field is required: the profile can be incomplete. The body is the student sheet (`Student.to_dict()`), so it also contains other student fields (`uid`, `subscription`, `rhythm`, `available_to`, `school`), which are not part of this contract. Since the body is the same for the three routes, the front end can replace its copy of the profile with the response to a `PATCH` or a `POST`.

## Routes

### `GET /api/student/<id>`

Returns the profile. Available to the student themselves and to administrators.

### `PATCH /api/student/<id>`

Updates one or more fields of the profile. Restricted to the student themselves.

The JSON body contains one or more of the fields of the table above, except `photo_url`; fields left out do not change:

```json
{ "desired_position": "Développeur web", "skills": ["Java", "SQL"], "study_degree": 5 }
```

Leading and trailing spaces are removed, and an empty string clears a text field. `null` clears `study_degree`, `category` and `available_from`, and `[]` clears the skills. Numbers are numbers: `true` or `"5"` are refused. When one value is refused, nothing is saved. Any other field (`role`, `email`, `photo_url`…) is refused: this route changes neither the role nor the rights of the account.

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
| `education` | More than 100 characters | La formation ne doit pas dépasser 100 caractères. |
| `region` | More than 64 characters | La région ne doit pas dépasser 64 caractères. |
| `description`, `desired_position`, `education` or `region` | Value that is not a string | Ce champ doit être un texte. |
| `study_degree` | Not `1` to `5` or `null` | Choisissez un niveau d’études de la liste. |
| `category` | Not a value of `JobCategory` or `null` | Choisissez un domaine de la liste. |
| `experience_level` | Not an integer from `0` to `600` | L’expérience est un nombre de mois, de 0 à 600. |
| `skills` | Not an array of strings, more than 20, more than 40 characters, a comma, more than 256 characters in all | Indiquez au plus 20 compétences, de 40 caractères au plus chacune et sans virgule. |
| `available_from` | Not a date `AAAA-MM-JJ` or `null` | Indiquez une date valide. |
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
