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
    "applicant_count": 2
  }
]
```

Recruiters without an associated profile or offers receive `[]`. Closed offers
remain available for consulting their received applications. This supplies a
read-only entry while offer creation, editing and deletion remain in JOB-022.
The model does not store offer images; the cards use the decorative Figma image.

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

## Design references

- [Vos offres](https://www.figma.com/design/nHHBagsmfJK4TVHwNGFfks/JobUp?node-id=1-783)
- [Candidats d’une offre](https://www.figma.com/design/nHHBagsmfJK4TVHwNGFfks/JobUp?node-id=8-725)

The implementation reuses the account navigation, candidate identity and status
components. The shared navigation’s existing notification placeholder is outside
this ticket. Decision/contract controls from the mockup are omitted because
their behavior is explicitly outside JOB-040.
