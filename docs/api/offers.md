# Published offers (JOB-068)

`GET /api/offers` returns all published offers as an array, ordered by
`created_at DESC, id DESC`. The `/offers` interface paginates this real result
set locally, six offers per page. `GET /api/offers/:id` loads the same public
representation directly, independently of the current list page.

Both routes are read-only and accessible to visitors and authenticated students
with identical visibility. They do not use the private recruiter offers API.
Only `Offer.is_active=True` rows are returned; inactive and missing details both
return `404 {"error": "Offer not found"}`. An empty list returns `200 []`.

```json
{
  "id": 12,
  "title": "Développeur Java",
  "description": "Une alternance dans notre équipe.",
  "requirements": "Java, SQL",
  "category": 1,
  "created_at": "2026-11-16T09:00:00Z",
  "company": {"id": 3, "name": "Atelier Studio", "city": "Paris"}
}
```

The payload is an explicit allowlist. Recruiter identity, email, company SIRET,
applications, applicant counts and other private data are excluded from both
list and direct detail access. `company` is `null` when the recruiter has no
company. Category values reuse `JobCategory`. The model has no offer location,
image or duration: city comes from the company, and the interface must not invent
missing offer information.

## Publication integration (JOB-065 / JOB-051 / JOB-020)

This checkout has no recruiter creation/publication API or separate offer draft
state. The existing public company endpoints already interpret `is_active=True`
as published. This API uses the same convention without changing the model or
database. JOB-065/JOB-051 must create unpublished drafts with `is_active=False`,
set it to `True` when publishing, and set it to `False` when withdrawing. If a
separate publication status is introduced, update the shared public visibility
rules before enabling it. No distinction in visibility between visitors and
students is introduced; JOB-020's public `/offers` navigation remains available.

Backend tests verify unpublished → published → withdrawn visibility in list
and direct access using isolated test records. A full recruiter UI journey
requires the JOB-065 publication and withdrawal implementation to be integrated.
The public JOB-068 offer API requires no schema change; saved-offer persistence
adds the `SavedOffer` database table.

## Student saved offers

Saved offers are persistent, private to the authenticated student, and require a
student account. The routes use normal session authentication and CSRF
protection for writes:

- `GET /api/student/saved-offers` lists that student's saved, currently active
  offers, newest first. Each item uses the public offer fields plus `saved_at`.
- `POST /api/student/saved-offers/:id` saves a currently active offer. It
  returns the saved offer with `saved_at` (`201` when created, `200` if it was
  already saved).
- `DELETE /api/student/saved-offers/:id` removes the student's saved offer and
  returns `204`, including when it was already removed.

Visitors receive the normal unauthenticated response; authenticated non-student
roles receive `403`. Saving an unknown or inactive offer returns `404`. The
database enforces one saved row per student and offer. Removing or deleting an
offer or student cascades to its saved rows.
