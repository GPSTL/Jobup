# Message attachments API (JOB-043, REC-14)

Contract between the recruiter's attachment feature and the message thread: the paperclip of `front/components/MessageThread.tsx` (`allowAttachment`), the file card shown to every participant, and the download. The front end calls it through `front/services/messages.ts`, whose types mirror the bodies below. The messages and their participants are those of JOB-032 and JOB-034: an attachment belongs to a `Message` (`MessageAttachment` in `jobup/models.py`), there is no second conversation system.

## Policy (to be validated by the team)

Open questions of JOB-043.

| Question | Value for now |
|---|---|
| Formats | PDF, DOCX, DOC, recognised from the content (not from the name) |
| Maximum size | 10 MB |
| Files per message | 1 |
| A message with only a file | Allowed: `body` may be empty when a file is sent |
| Who can send | The recruiter of the conversation only (not the student, not the school) |
| Who can download | Every participant of the conversation |
| Deletion | The file is deleted with its message (and so with its conversation or student). No message can be deleted from the interface yet |
| File analysis | None (no antivirus). Hook to add before opening other formats or on a public deployment |

Not done, to decide with the policy: images (the signature check is the same kind as PDF), several files per message (`MessageAttachment.message` would become a foreign key and `attachment` a list), an antivirus scan, a retention period.

## Sending

`POST /api/conversations/<id>/messages` as `multipart/form-data` with the fields `body` (text, optional when there is a file) and `file`. The JSON request without a file is unchanged.

- `201` and the saved message (see below).
- `400` and `{ "errors": { "file": "French message" } }` when the file is refused: empty (`Le fichier est vide.`), over the size limit, or neither PDF, DOCX nor DOC. Nothing is stored. A text that is too long, or no text and no file, gives the usual `400` of the thread.
- `403` when the user takes part in the conversation but is not its recruiter (a `file` field is never accepted from a student or a school employee). `403` without a session, like the rest of the thread.
- `404` when the user does not take part in the conversation.
- `500` and `{ "errors": { "file": "French message" } }` when the file cannot be stored. The message is not saved either: the file and the text are saved together or not at all, and the recruiter can try again.

The format is read from the content: a PDF renamed `.docx` is kept as a PDF, with its extension corrected (`Offre.doc` holding a PDF becomes `Offre.doc.pdf`). The name is kept, shortened to 100 characters, with spaces turned into underscores and special characters removed.

## Reading

Every message of `GET /api/conversations/<id>/messages` (latest, `before`, `after`) has an `attachment`, `null` when there is none:

```json
{
  "id": 12,
  "body": "",
  "created_at": "2026-10-21T10:32:00Z",
  "from_me": true,
  "attachment": {
    "name": "Convocation_entretien.pdf",
    "size": 225280,
    "extension": "pdf",
    "url": "/api/conversations/7/messages/12/attachment"
  }
}
```

`size` is in bytes. `url` is the address of the API below, never a path of the storage. In the list of conversations (`GET /api/student/conversations`), `last_message` also has `attachment`: the file name of the last message, or `null`; its `body` is empty for a message that holds only a file.

## Download

`GET /api/conversations/<id>/messages/<message>/attachment` responds with the file as an attachment (`Content-Disposition: attachment; filename="Convocation_entretien.pdf"`), under the content type of its format, with `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`.

`404` when the user does not take part in the conversation, when the message belongs to another conversation, when it has no file, or when the file is missing from the storage; `403` without a session.

## Storage

The files are stored in `PRIVATE_MEDIA_ROOT` (`private_media/` next to `manage.py`, ignored by Git), as `message_attachments/<random identifier>/<name>`. This folder is outside `MEDIA_ROOT`: Django never serves it through `MEDIA_URL`, and the storage cannot build a URL. The only way to read a file is the download above, which checks the participant. In production, do not expose `PRIVATE_MEDIA_ROOT` through the web server either.
