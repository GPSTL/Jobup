# Company page API (JOB-066, REC-25)

Contract between the company page API and the “Page entreprise” tab of the recruiter's “Mon espace”. The code is in `jobup/recruiter_company.py`. The public page that students see stays the one of JOB-021 (`GET /api/companies/<id>`, read only), which shows the changes as soon as they are saved.

## Who can edit

- The route has no company id: a recruiter only ever reads and edits **their own company** (`Recruiter.company`). Another company can never be targeted, and `id` or `siret` in the body are refused.
- **Every recruiter attached to the company** can edit it (team decision for the open question of REC-25).
- An account that is not a recruiter gets `403`. A recruiter attached to no company gets `404` `{"error": "No company"}`: attaching or creating a company is not part of JOB-066.

## Routes

| Route | Effect | Success |
| --- | --- | --- |
| `GET /api/recruiter/company` | Reads the company of the logged-in recruiter | `200` with the body below |
| `PATCH /api/recruiter/company` | Saves the page: the fields, and the logo when one is sent | `200` with the saved company |

```json
{
  "id": 4,
  "name": "Atelier Studio",
  "logo_url": "/media/logos/3f2a….png",
  "sector": 1,
  "city": "Paris 9e",
  "employees": 70,
  "website": "https://atelier-studio.fr",
  "description": "Atelier Studio conçoit des applications web et mobiles…",
  "active_offers": 3
}
```

`active_offers` (active offers of all the company's recruiters) fills the “3 offres en cours” of the student preview. `logo_url` is `null` without a logo; it is also returned by the public page and the directory of JOB-021. The SIRET is never returned.

## Saving

The body is JSON, or `multipart/form-data` when a new logo is sent with the fields (field `logo`). Like every write, it needs the `X-CSRFToken` header, with the token of `GET /api/csrf`.

| Field | Rule |
| --- | --- |
| `name` | Required, 128 characters maximum, not the name of another company (case insensitive) |
| `sector` | Required, a value of `JobCategory` |
| `city` | Optional, 64 characters maximum; empty or missing clears it |
| `description` | Optional, 2048 characters maximum; empty or missing clears it |
| `logo` | Optional: JPG or PNG read from the content (whatever the file name), 2 MB and 25 megapixels maximum. Saved again without its metadata, under a new name; the old file is deleted. Without `logo`, the current logo is kept |

Spaces around the texts are removed. `employees` and `website` are not on the form and are never changed.

**All or nothing:** if any field or the logo is refused, nothing is saved and the previous page is kept. The response is `400` with one French message per field, to show under it:

```json
{ "errors": { "name": "Le nom de l’entreprise est obligatoire (128 caractères maximum).", "logo": "Le logo ne doit pas dépasser 2 Mo." } }
```

| Case | Message |
| --- | --- |
| `name` missing, blank or too long | `Le nom de l’entreprise est obligatoire (128 caractères maximum).` |
| `name` already used | `Une autre entreprise porte déjà ce nom.` |
| `sector` missing or unknown | `Choisissez un secteur dans la liste.` |
| `city` too long | `La localisation ne doit pas dépasser 64 caractères.` |
| `description` too long | `La présentation ne doit pas dépasser 2048 caractères.` |
| `logo` not JPG or PNG | `Le logo doit être au format JPG ou PNG.` |
| `logo` too large | `Le logo ne doit pas dépasser 2 Mo.` / `Le logo ne doit pas dépasser 25 mégapixels.` |
| Any other field (`id`, `siret`, …) | `Ce champ ne peut pas être modifié.` |

A body that is neither an object nor a form gets `400` `{"error": "Invalid payload"}`.

## After a pull

The new `Company.logo` column needs `make migrate` on an existing checkout (never `make init`, which deletes the database).
