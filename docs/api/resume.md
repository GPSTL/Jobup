# Student CV API

Contract between the CV API (JOB-018) and the “Mon CV” block of “Mon espace” (JOB-019): reading the name and the date of the current CV, and importing a CV, which replaces the current one.

## Authentication

Same as the profile API: the routes use the Django session, `<id>` is the account id, and `POST` requests send the `X-CSRFToken` header. See [Authentication in profile.md](profile.md#authentication).

## The CV

Both routes respond with the same body, the CV:

```json
{
  "file_name": "CV_Camille_Martin.pdf",
  "updated_at": "2026-11-08T09:42:17.204519Z"
}
```

| Field | Type | Content |
| --- | --- | --- |
| `file_name` | string or `null` | Name of the file, to display as is; `null` when the student has not imported a CV yet. |
| `updated_at` | string or `null` | Date and time of the last import, in ISO 8601 format, in UTC; `null` when there is no CV. |

The name is the one of the imported file, with these changes, made when it is saved:

- spaces become `_`, and characters other than letters, digits, `-`, `_` and `.` are removed: `Mon CV (2026).pdf` becomes `Mon_CV_2026.pdf`;
- it is shortened to 60 characters, extension included;
- when its extension does not match the content of the file, the right one is added: `CV.doc` holding a PDF becomes `CV.doc.pdf`.

In `front/services/cv.ts` (JOB-019), `file_name` and `updated_at` are the `fileName` and `updatedAt` fields of `Cv`, and `"file_name": null` stands for `cv: null`. Since the body is the same for both routes, the front end can replace its copy of the CV with the response to a `POST`.

## Routes

### `GET /api/student/<id>/resume`

Returns the CV. Available to the student themselves and to administrators.

### `POST /api/student/<id>/resume`

Imports a CV, which replaces the current one. Restricted to the student themselves.

The body is `multipart/form-data`, with the file in the `resume` field: PDF, DOCX or DOC, 5 MB max, that is 5 × 1024 × 1024 bytes.

The format is checked on the content of the file, not on its extension nor on the type sent by the browser:

| Format | Recognized by |
| --- | --- |
| PDF | The file starts with `%PDF-`. |
| DOCX | ZIP archive holding `word/document.xml`. |
| DOC | Signature of the OLE2 compound files, which hold the Word 97-2003 documents. Excel and PowerPoint 97-2003 files share it and are not told apart. |

The current CV is replaced only once the new one is saved: when the import fails, because the file is refused or cannot be stored, the current CV stays in place, unchanged. After a successful import, the file of the previous CV is deleted. This does not affect the applications already sent: since JOB-033, an application keeps its own copy of the CV, made when it is sent.

### `GET /api/student/<id>/resume/suggestions`

Pre-fill of the profile from the CV (JOB-071). Restricted to the student themselves: their CV is only read for them. The current CV is read again on the server, and values of the profile are taken from its text. **Nothing is saved**: the page shows them, the student ticks those they keep, then saves them with `PATCH /api/student/<id>` ([profile.md](profile.md)).

```json
{
  "readable": true,
  "suggestions": {
    "desired_position": "Développeur web",
    "education": "Master 2 MIAGE — Université Paris Nanterre",
    "study_degree": 5,
    "skills": ["Java", "Spring Boot", "SQL"],
    "region": "Île-de-France"
  }
}
```

- Only the values found are in `suggestions`: an absent field gave nothing. `{}` when nothing was found.
- `readable` is `false` when the text of the CV cannot be read: old Word format (`.doc`), scanned or protected PDF, damaged file. `suggestions` is then `{}`.
- Read: the text of the PDF (first 5 pages, with `pypdf`) or of the DOCX (`word/document.xml`, read without an XML parser, so that its entities are never expanded), 40,000 characters at most.
- `desired_position`: a label (“Poste recherché : …”, “Objectif : …”), a sentence (“je recherche une alternance en tant que …”), or else the title of the CV (“Développeur Full Stack en alternance”).
- `education` and `study_degree`: the line of the highest degree (Master 2 → Bac + 5, M1 → Bac + 4, Licence or BUT or Bachelor → Bac + 3, BTS or DUT → Bac + 2…), without its dates.
- `skills`: the known skills cited by the CV, in its order, 20 at most: a list of common software, languages and tools, and the skills already entered by the students, whose spelling (that of the filters of the recruiters) wins. Whole names only: “Java” is not found in “JavaScript”.
- `region`: the first region or large city cited, usually the address at the top of the CV, as a region (“Lyon” gives “Auvergne-Rhône-Alpes”).

| Case | Code | Body |
| --- | --- | --- |
| Values read | `200` | As above |
| `<id>` of another account, no session | `403` | `{"error": "Forbidden"}` or the DRF body |
| No student profile for this `<id>` | `404` | `{"error": "Student not found"}` |
| No CV | `404` | `{"error": "Resume not found"}` |

## Storage

The CV is stored in the media folder (`MEDIA_ROOT`), as `CVs/<random identifier>/<name>`. Each import gets a new folder, so the file keeps its name, which is also the name of the copy made for an application (JOB-033).

The API never gives the path of the CV, nor a URL to download it. In development, Django serves the whole media folder (`jobup/urls.py`), so anyone who knows the path of a CV can download it: the random folder makes it impossible to guess. Downloading the CV, by recruiters in particular, is not part of this API (JOB-035).

## Status codes

| Case | Code | Body |
| --- | --- | --- |
| Success | `200` | The CV, updated after a `POST` |
| Invalid file | `400` | `{"errors": {"resume": "<message>"}}` |
| No session | `403` | `{"detail": "Authentication credentials were not provided."}` |
| `X-CSRFToken` header missing or wrong | `403` | `{"detail": "CSRF Failed: …"}` |
| `<id>` of another account, whether it exists or not (except `GET` by an administrator) | `403` | `{"error": "Forbidden"}` |
| No student profile for this `<id>` | `404` | `{"error": "Student not found"}` |
| The file cannot be stored | `500` | Django error page, not JSON |

As for the profile, a `403` on these routes means in practice that the session has expired. A `500` is a server error, after which the current CV is unchanged.

## Error messages

The messages in `errors` are in French, like the interface, and are displayed as is:

| Field | Case | Message |
| --- | --- | --- |
| `resume` | No file sent | Aucun CV reçu. |
| `resume` | Neither PDF, nor DOCX, nor DOC | Le CV doit être au format PDF, DOCX ou DOC. |
| `resume` | More than 5 MB | Le CV ne doit pas dépasser 5 Mo. |

The last two are the messages of `validateCv` (`front/utils/validation.ts`, JOB-019), which checks the extension and the size before sending.

## Front-end example

```ts
// Read on every request: the token changes at each login
const csrfToken = () => document.cookie.match(/(?:^|; )csrftoken=([^;]*)/)?.[1] ?? "";

// Current CV
const response = await fetch(`/api/student/${id}/resume`, { credentials: "same-origin" });
const { file_name, updated_at } = await response.json();
const cv = file_name === null ? null : { fileName: file_name, updatedAt: updated_at };

// Import a CV: without Content-Type, which the browser adds itself for a FormData
const body = new FormData();
body.append("resume", file);
await fetch(`/api/student/${id}/resume`, {
	method: "POST",
	credentials: "same-origin",
	headers: { "X-CSRFToken": csrfToken() },
	body,
});
```
