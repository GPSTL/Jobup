# Recruiter offers and applicants (JOB-040 / REC-11)

The read-only entry point is `/recruiter/offers`. Every offer links to
`/recruiter/offers/:id/applicants`; the offer is loaded from its URL after a reload.
The candidate profile reuses JOB-035, with `?offer=:id` providing a return link.

Both API routes require an authenticated recruiter session. Ownership is scoped
to `Offer.recruiter.user`, not the company: colleagues cannot read one another’s
offer applicants. A missing or foreign offer returns the same `404` response.
Other roles and unauthenticated requests receive `403` (or `401` depending on
authentication configuration).

## GET `/api/recruiter/offers`

Returns an array, newest offer first (`created_at DESC`, then `id DESC`):

```json
[
  {
    "id": 12,
    "title": "Développeur Java en alternance",
    "description": "Une alternance de 12 mois.",
    "created_at": "2026-10-10T09:00:00Z",
    "is_active": true,
    "image_url": "",
    "applicant_count": 2
  }
]
```

Recruiters without an associated profile or offers receive `[]`. Closed offers
remain available for consulting their received applications. Offers are created with
`POST` on the same route (JOB-065, below); editing and deletion remain in JOB-022 / JOB-023.
`image_url` is the image chosen at creation, or `""`: the cards then use the decorative Figma image.

## GET `/api/recruiter/offers/:id/applicants`

```json
{
  "offer": {
    "id": 12,
    "title": "Développeur Java en alternance",
    "description": "Une alternance de 12 mois.",
    "created_at": "2026-10-10T09:00:00Z",
    "is_active": true
  },
  "applications": [
    {
      "id": 53,
      "candidate": {
        "id": 7,
        "first_name": "Lucas",
        "last_name": "Martin",
        "photo_url": null,
        "education": null,
        "school": null,
        "description": "",
        "cv_url": null
      },
      "status": 1,
      "submitted_at": "2026-10-15T09:00:00Z"
    }
  ]
}
```

Applicants come exclusively from this offer’s `JobApplication` rows with a
non-null `submitted_at` and a non-draft status. They are ordered by receipt date,
newest first, then application ID descending. Final applications are retained.
This is an application history, independent of the general active candidate
search. Existing JOB-035 rules still apply when opening a profile or its CV.
The candidate payload is the shared card contract in [candidates.md](candidates.md).

The current endpoints return all results without pagination, like the existing
candidate list. The interface filters these received applications locally and
stores the selected filter in `?status=all|submitted|review|accepted|refused`.
`READ` (2) and `IN_REVIEW` (3) share “En cours d’étude”; the other labels reuse
the student application status mapping. Unknown filters default to “Toutes”.
Filter counts always describe the complete returned application set.

Viewing or filtering does not change application statuses. Decisions,
notifications and contract upload belong to subsequent tickets. No schema or
database migration is required.

## POST `/api/recruiter/offers` — publish an offer (JOB-065 / REC-22)

Integrates the “Créer une offre” form of JOB-051 (PR #25, branch `JOB-23`). The
offer is published immediately (`is_active: true`) and appears in the `GET` above.
Like every write, the request needs the `X-CSRFToken` header.

**Company:** the offer always belongs to the company of the logged-in recruiter,
set by the server. There is no company field: `company`, `company_id`,
`recruiter`, `is_active`, `id`… in the body are refused with
`Ce champ ne peut pas être défini.` A recruiter without a profile or a company
gets `404` `{"error": "No company"}`; other roles get `403`.

| Field | Rule |
| --- | --- |
| `title` | Required, 128 characters maximum, spaces around removed |
| `description` | Required, 2048 characters maximum, spaces around removed |
| `category` | Required, a value of `JobCategory` |
| `requirements` | Optional, 256 characters maximum |
| `image_url` | Optional, `http` or `https` URL, 200 characters maximum |
| `contract_type` | Optional: `alternance`, `stage`, `cdd`, `cdi` |
| `duration` | Optional, 64 characters maximum (e.g. `12 mois`) |
| `start_date` | Optional, `YYYY-MM-DD` |
| `location` | Optional, 128 characters maximum |

Errors are `400` with a list of French messages per field, displayed under the
fields of the form: `{"title": ["Ce champ est obligatoire."]}`. Nothing is saved.

Success is `201` with the **published offer**. This format is the reading
contract shared with JOB-068 (student offer page):

```json
{
  "id": 12,
  "title": "Développeur Python",
  "description": "Construire une application.",
  "requirements": "Python, Django",
  "category": 1,
  "image_url": "https://example.com/image.webp",
  "contract_type": "alternance",
  "duration": "12 mois",
  "start_date": "2027-01-01",
  "location": "Paris",
  "company": { "id": 4, "name": "Atelier" },
  "is_active": true,
  "created_at": "2026-11-16T15:00:00Z"
}
```

The new `Offer` columns (`image_url`, `contract_type`, `duration`, `start_date`,
`location`) need `make migrate` on an existing checkout (never `make init`).

## Design references

- [Vos offres](https://www.figma.com/design/nHHBagsmfJK4TVHwNGFfks/JobUp?node-id=1-783)
- [Candidats d’une offre](https://www.figma.com/design/nHHBagsmfJK4TVHwNGFfks/JobUp?node-id=8-725)
- [Créer une offre](https://www.figma.com/design/nHHBagsmfJK4TVHwNGFfks/JobUp?node-id=1-961)

The implementation reuses the account navigation, candidate identity and status
components. The shared navigation’s existing notification placeholder is outside
this ticket. Decision/contract controls from the mockup are omitted because
their behavior is explicitly outside JOB-040.
