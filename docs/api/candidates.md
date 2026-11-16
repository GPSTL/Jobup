# Recruiter candidates API

Contract between the candidates API (JOB-035, REC-01) and the “Candidats” tab of the recruiter: the cards (`front/pages/CandidatesPage.tsx`), the full profile with the exchange history (`front/pages/CandidateProfilePage.tsx`), and the CV download. The front end calls it through `front/services/candidates.ts`, whose types mirror the bodies below.

## Authentication

- The routes use the Django session opened by `POST /api/login`: every front-end request passes `credentials: "same-origin"`.
- They are reserved for recruiters (`role` 3). Without a session, as a student or as an administrator, they respond `403`.
- `<id>` is the account id of the student, that is, the `id` field of a card.

## Who a recruiter sees

Every recruiter sees every active student, whether or not they filled in a school, a photo or a CV, newest accounts first, except the candidates they already kept with ♥ (JOB-037, see “The shortlist” below) and those they excluded with 🚫 (JOB-038, see “The exclusion” below). The filters (JOB-036, see “The filters” below) narrow this list down further; the rule is in `visibleStudents()`, `recruiterDeck()` and `candidate_list()` (`jobup/candidates.py`).

To be validated by the team (open question of JOB-035): ETU-02 presents the CV of the profile as a way to apply without typing again, and this API lets every recruiter download it. Students should at least be told so on their profile.

## The card

`GET /api/recruiter/candidates` responds with an array of cards:

```json
{
  "id": 12,
  "first_name": "Lucas",
  "last_name": "Martin",
  "photo_url": null,
  "education": null,
  "school": "Université Paris Nanterre",
  "description": "Étudiant en Master MIAGE, je recherche une alternance de 12 mois.",
  "cv_url": "/api/recruiter/candidates/12/cv"
}
```

| Field | Type | Content |
| --- | --- | --- |
| `id` | number | Account id of the student. |
| `first_name`, `last_name` | string | Name of the student. |
| `photo_url` | string or `null` | URL of the photo of the profile (JOB-008), e.g. `/media/photos/<name>.jpg`; `null` when the student has none. |
| `education` | string or `null` | Program followed, e.g. “Master MIAGE”. Always `null` for now: no screen asks the student for it, and `Student` does not store it. |
| `school` | string or `null` | Name of the school; `null` when not filled in. |
| `description` | string | Personal presentation; empty string when not written yet. |
| `cv_url` | string or `null` | Download route of the CV, below; `null` when the student has no CV, so that the front end never shows a broken link. Never the URL of the file itself. |

## The profile

`GET /api/recruiter/candidates/<id>` responds with the card, plus:

```json
{
  "region": "Paris",
  "study_degree": 4,
  "available_from": "2026-11-02",
  "skills": ["Java", "Spring Boot", "SQL"],
  "experiences": [],
  "exchanges": [
    {
      "kind": "application",
      "id": 31,
      "date": "2026-10-15T09:12:00.123456Z",
      "offer_title": "Développeur Java en alternance"
    },
    {
      "kind": "message",
      "id": 87,
      "date": "2026-10-16T14:05:00.123456Z",
      "from_me": true,
      "body": "Bonjour Lucas, votre profil nous intéresse."
    }
  ]
}
```

| Field | Type | Content |
| --- | --- | --- |
| `region` | string | `Student.region` (“Île-de-France” by default). |
| `study_degree` | number or `null` | Value of `StudyDegree`: 1 to 5 for BAC+1 to BAC+5; `null` when not filled in. |
| `available_from` | string or `null` | Date without time, ISO 8601. `Student.available_from` is set to the creation date of the profile. |
| `skills` | array of strings | `Student.skills`, split on commas; empty items are removed. |
| `experiences` | array | Always empty for now: `Student` only stores `experience_level`, a number of months. Items will be `{ "title": string, "details": string }`. |
| `exchanges` | array | History of the exchanges with the logged-in recruiter, oldest first. |

The exchanges are the applications sent by the student to the offers of the logged-in recruiter (`kind: "application"`, date of sending, title of the offer). Drafts are left out, since the recruiter never received them. The applications to the offers of other recruiters, colleagues of the same company included, are never sent. They also include the messages of the conversation between the student and the logged-in recruiter (JOB-039): `kind: "message"`, id of the `Message`, date of sending, `from_me` (true when the recruiter sent it) and `body`. The messages of the conversations of other recruiters are never sent. Applications and messages come mixed, oldest first; the whole conversation is in the « Messages » tab (`docs/api/recruiter-conversations.md`).

## The CV

`GET /api/recruiter/candidates/<id>/cv` responds with the file of the CV, as an attachment under its stored name (`Content-Disposition: attachment; filename="CV_Lucas_Martin.pdf"`). This is `Student.resume`, the CV of the profile (JOB-018), not the copy sent with an application (JOB-033).

## The shortlist

The shortlist (JOB-037, REC-03) holds the candidates a recruiter kept with ♥. It belongs to the recruiter, not to their company: colleagues never see it, and a candidate appears at most once in it. A kept candidate leaves the cards of `GET /api/recruiter/candidates`, but their profile and CV stay reachable from the shortlist.

| Route | Effect | Success |
| --- | --- | --- |
| `POST /api/recruiter/candidates/<id>/shortlist` | Keeps the candidate (♥). Keeping them again creates no duplicate. | `201` with the item, `200` if already kept |
| `DELETE /api/recruiter/candidates/<id>/shortlist` | Removes the candidate (“Retirer”). No effect if they were not kept. | `204` |
| `GET /api/recruiter/shortlist` | The kept candidates, most recently kept first. Deactivated students are left out. | `200` with an array of items |

An item is a card, plus:

```json
{
  "shortlisted_at": "2026-11-09T14:02:11.123456Z",
  "offer": null
}
```

| Field | Type | Content |
| --- | --- | --- |
| `shortlisted_at` | string | Date and time of the ♥, ISO 8601. |
| `offer` | object or `null` | `{ "id": number, "title": string }`: the offer the candidate was kept for (“Pour : …” in the mockup). Always `null` for now: no screen lets the recruiter pick the offer yet (JOB-036). |

`POST` and `DELETE` change data: like every write, they need the `X-CSRFToken` header, with the token of `GET /api/csrf`. On `POST`, an unknown `<id>`, an inactive student or an account that is not a student responds `404` `{"error": "Candidate not found"}`.

## The exclusion

The exclusion (JOB-038, REC-04) is the 🚫 button of a card: the candidate leaves the cards of the logged-in recruiter, and the next card is shown.

**Scope (to be validated, open question of REC-04):** for now an exclusion belongs to the recruiter alone, has no expiry, and applies to all their searches. It is never shared with colleagues of the same company, and one recruiter's exclusion changes nothing for another. Widening it to the company, an offer or a search means changing the `Exclusion` model and the `exclude()` of `candidate_list()`.

| Route | Effect | Success |
| --- | --- | --- |
| `POST /api/recruiter/candidates/<id>/exclusion` | Excludes the candidate. Idempotent: excluding them again creates no duplicate, so a retry after a network error is always safe. | `201` `{"id": 12, "excluded": true}`, `200` with the same body if already excluded |

- The check is done on the server: an account that is not a recruiter gets `403`, and an unknown `<id>`, an inactive student or an account that is not a student gets `404` `{"error": "Candidate not found"}`. Like every write, the route needs the `X-CSRFToken` header.
- Only the `Exclusion` row is written. The applications of the candidate keep their status (formally refusing one is REC-24), the profile and CV stay reachable by their direct URL, and the shortlist is not modified.
- A candidate who is already on the shortlist is already out of the cards; excluding them leaves them on the shortlist. What an exclusion should do to a shortlisted candidate, and a way to restore an excluded one, are still to be decided: there is no `DELETE` route yet.

## The filters

The “Filtres” panel of the “Candidats” tab (JOB-036, REC-02) narrows the cards down. `GET /api/recruiter/candidates` takes the criteria as query parameters, e.g. `?position=Data%20analyst&skill=SQL&region=remote`. Every criterion that is filled in must hold; an empty or missing one is not applied. The rules of “Who a recruiter sees” still apply: a filter never brings back a kept, excluded or inactive candidate.

| Parameter | Value | A card is kept when |
| --- | --- | --- |
| `position` | A value of `positions` below; at most 100 characters | `Student.desired_position` is the same, whatever the case, the accents and the hyphens. |
| `experience` | `beginner`, `junior` or `confirmed` | `Student.experience_level`, in months, is within the level: 0 to 5, 6 to 23, 24 and more. |
| `skill` | A value of `skills` below; at most 64 characters | One of the skills of `Student.skills` is the same, whatever the case and the accents: `SQL` does not find `PostgreSQL`. |
| `region` | Free text: a city, a region or “remote”; at most 64 characters | `remote`, `full remote`, `télétravail`, `à distance` or `distanciel` find the students whose region is one of these words. Anything else must appear in the region of the student, whatever the case, the accents and the hyphens: `paris` finds “Paris 15e”, `saint etienne` finds “Saint-Étienne”. |

A criterion that is not one of these values, or that is too long, responds `400` `{"error": "Invalid filters"}`. Other parameters are ignored.

`GET /api/recruiter/candidates/filters` gives the values of the lists of the form, so that the form never offers a value the API refuses:

```json
{
  "positions": ["Data analyst", "Développeur back-end"],
  "experiences": [
    { "value": "beginner", "label": "Débutant (moins de 6 mois)" },
    { "value": "junior", "label": "Junior (6 mois à 2 ans)" },
    { "value": "confirmed", "label": "Confirmé (2 ans et plus)" }
  ],
  "skills": ["Excel", "Java", "Power BI", "SQL"]
}
```

- `positions` and `skills` come from the cards of the logged-in recruiter: every value finds at least one card when the page loads. A value written differently by several students (“Data analyst”, “data ANALYST”) appears once, always with the same spelling; the lists are in alphabetical order.
- `experiences` are the three levels above, in this order, with the label shown by the form.
- Like the other routes, it is reserved for recruiters.

The front end keeps the criteria in the URL of the page (`/recruiter/candidates?skill=SQL&candidate=12`): they survive a reload and the arrows of the browser, and “Retour aux candidats” on a profile gives them back.

To be validated by the team (open questions of REC-02):

- No screen asks the student for `experience_level` (0 by default, that is “Débutant”), `skills` or `region` (“Île-de-France” by default) yet: only `desired_position` is filled in from the profile (JOB-008). Until then, the demo data below fills them.
- One value per list, and the criteria are combined (all of them must hold).
- A city is not matched to its region: `Paris` does not find “Île-de-France”.

## Status codes

| Case | Code | Body |
| --- | --- | --- |
| Success | `200` | The cards, the profile or the file |
| Invalid filters | `400` | `{"error": "Invalid filters"}` |
| No session | `403` | `{"detail": "Authentication credentials were not provided."}` |
| Account that is not a recruiter | `403` | `{"error": "Forbidden"}` |
| `<id>` unknown, of an inactive student, or of an account that is not a student | `404` | `{"error": "Candidate not found"}` |
| CV route, student without a CV, or file missing from the media folder | `404` | `{"error": "Resume not found"}` |

Since the front end only reaches these routes once `RequireRecruiter` has checked the session, a `403` means in practice that the session has expired.

## Demo data

A new database has no student, so a recruiter sees no candidate until students sign up. `python manage.py seed_candidates <email of a recruiter>` creates the students of the mockups (Lucas Martin and Sarah Benali, with a CV) and Inès Diallo (without school nor CV), and an application of Lucas Martin to an offer of this recruiter, for the history. Their position, experience, skills and region fill the lists of the filters. Running it again creates nothing new. Nobody can log in with these accounts.
