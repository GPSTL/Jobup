# Recruiter candidates API

Contract between the candidates API (JOB-035, REC-01) and the “Candidats” tab of the recruiter: the cards (`front/pages/CandidatesPage.tsx`), the full profile with the exchange history (`front/pages/CandidateProfilePage.tsx`), and the CV download. The front end calls it through `front/services/candidates.ts`, whose types mirror the bodies below.

## Authentication

- The routes use the Django session opened by `POST /api/login`: every front-end request passes `credentials: "same-origin"`.
- They are reserved for recruiters (`role` 3). Without a session, as a student or as an administrator, they respond `403`.
- `<id>` is the account id of the student, that is, the `id` field of a card.

## Who a recruiter sees

Every recruiter sees every active student, whether or not they filled in a school, a photo or a CV, newest accounts first. The filters (JOB-036) and the candidates already kept or dismissed (JOB-037, JOB-038) will narrow this list down; the rule is in `visibleStudents()` (`jobup/candidates.py`).

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
| `photo_url` | string or `null` | Always `null` for now: the photo arrives with JOB-008 (`Student.photo`). |
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

The exchanges are the applications sent by the student to the offers of the logged-in recruiter (`kind: "application"`, date of sending, title of the offer). Drafts are left out, since the recruiter never received them. The applications to the offers of other recruiters, colleagues of the same company included, are never sent. The messages of the conversation (`kind: "message"`, with `from_me` and `body`) will be added by JOB-039, once the models of JOB-032 are on main.

## The CV

`GET /api/recruiter/candidates/<id>/cv` responds with the file of the CV, as an attachment under its stored name (`Content-Disposition: attachment; filename="CV_Lucas_Martin.pdf"`). This is `Student.resume`, the CV of the profile (JOB-018), not the copy sent with an application (JOB-033).

## Status codes

| Case | Code | Body |
| --- | --- | --- |
| Success | `200` | The cards, the profile or the file |
| No session | `403` | `{"detail": "Authentication credentials were not provided."}` |
| Account that is not a recruiter | `403` | `{"error": "Forbidden"}` |
| `<id>` unknown, of an inactive student, or of an account that is not a student | `404` | `{"error": "Candidate not found"}` |
| CV route, student without a CV, or file missing from the media folder | `404` | `{"error": "Resume not found"}` |

Since the front end only reaches these routes once `RequireRecruiter` has checked the session, a `403` means in practice that the session has expired.

## Demo data

Signup creates no `Student` row, so a recruiter sees no candidate on a new database. `python manage.py seed_candidates <email of a recruiter>` creates the students of the mockups (Lucas Martin and Sarah Benali, with a CV) and Inès Diallo (without school nor CV), and an application of Lucas Martin to an offer of this recruiter, for the history. Running it again creates nothing new. Nobody can log in with these accounts.
