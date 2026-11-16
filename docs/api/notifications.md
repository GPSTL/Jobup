# Notifications API (JOB-042, ETU-28)

Contract between the shared notification layer and the front end: the bell of the student's navigation bar (`front/components/NotificationBell.tsx`), the page “Notifications” (`front/pages/NotificationsPage.tsx`) and the “Notifications” block of “Mon espace” (`front/components/NotificationSettings.tsx`). The front end calls it through `front/services/notifications.ts`, whose types mirror the bodies below.

The layer is shared with the recruiters (REC-32) and the schools (ECO-21): the models (`Notification`, `NotificationPreference` in `jobup/models.py`), `notify()` (`jobup/notifications.py`) and these routes work for every role. This ticket only connects the student's events.

## Authentication

- The routes use the Django session opened by `POST /api/login`; without a session they respond `403`.
- Every user only reads and changes their own notifications and preferences. A notification of someone else responds `404`, as if it did not exist.
- `POST` and `PUT` need the `X-CSRFToken` header, with the token of `GET /api/csrf`.

## Events

| Event | Recipient | Notification |
|---|---|---|
| New message in a conversation (JOB-034, JOB-039) | The student, when the recruiter or the school wrote it | “Nouveau message de Léa Martin – Acme”, the start of the text between « », or “Pièce jointe : <name>” for a message holding only a file. Link `/messages/<conversation>` |
| Status of an application set to “read” or “in review” | The student | “Candidature mise à jour”, “« Chef de projet digital » chez Acme est passée en « En cours d’étude ».” Link `/applications/<id>` |
| Status set to “accepted” | The student | “Candidature acceptée !”, “Acme a accepté votre candidature « … ».” |
| Status set to “refused” | The student | “Candidature refusée”, “Acme n’a pas retenu votre candidature « … ».” |

- The events are connected to the models (`post_save` of `Message` and `JobApplication`, in `jobup/models.py`), so every screen and API that saves a message or a status triggers them, the recruiter decision of JOB-044 included. A status changed with `QuerySet.update()` does not go through `save()` and is not notified.
- They run once the save is committed: a failure of the notification never cancels the message or the status.
- No duplicate: every notification records its event (`message:<id>`, `application:<id>:review`, `application:<id>:accepted`…), unique per recipient. “Read” then “in review” are the same event for the student (both show “En cours d’étude”), so they give one notification.
- Not notified: the student's own messages and the sending of an application (“submitted”), which are their own actions.

## Notifications

`GET /api/notifications` (optional `before=<id>` and `limit`, 1 to 50, 20 by default):

```json
{
  "notifications": [
    {
      "id": 12,
      "kind": "message",
      "title": "Nouveau message de Léa Martin – Acme",
      "body": "« Seriez-vous disponible mardi ? »",
      "link": "/messages/3",
      "created_at": "2026-11-16T10:00:00Z",
      "read": false
    }
  ],
  "has_more": false,
  "unread_count": 3
}
```

Newest first. `kind` is `message`, `application_update`, `application_accepted` or `application_refused` (other kinds will come with REC-32 and ECO-21: the front end shows a generic icon for an unknown kind). `link` is a page of the application, `""` when there is none. A wrong `before` or `limit` responds `400`.

| Route | Effect | Success |
|---|---|---|
| `GET /api/notifications/unread-count` | Number of unread notifications, for the badge of the bell | `{ "unread_count": 3 }` |
| `POST /api/notifications/<id>/read` | Marks one notification as read. Doing it again changes nothing | `{ "notification": {…}, "unread_count": 2 }` |
| `POST /api/notifications/read-all` | Marks all of the user's notifications as read | `{ "unread_count": 0 }` |

The read state is stored on the server (`read_at`): the count stays the same after a reload or on another device.

## Preferences

`GET /api/notifications/preferences` and `PUT /api/notifications/preferences`:

```json
{ "messages": true, "application_status": true, "email": false }
```

- `messages` and `application_status`: receive the notifications of this kind in the application.
- `email`: receive an e-mail too, for the notifications that are created. Turning it off never removes the notifications of the application.
- `PUT` only changes the fields it sends. A value that is not a boolean responds `400` with `errors`.
- Initial values, those of the mockup “Mon espace – Compte et abonnement”: both kinds on, e-mail off. The preferences are created on the first read.

## E-mail

When `email` is on, `notify()` sends “JobUp — <title>” to the user's address, with the text and the absolute link (`SITE_URL`). A failed sending is logged and the notification stays. Without SMTP credentials (`THE_EMAIL_ADDRESS`, `THE_PASSWORD`), the default mailer prints the e-mails in the console instead of failing (`jobup/settings.py`).

## To be validated (open questions of ETU-28)

- The panel of the bell (latest 20, “Voir toutes les notifications”), the marking as read when a notification is opened, and the link it opens.
- The initial value of the e-mail preference (off, as in the mockup), the wording of the e-mails and the provider (none chosen: Gmail SMTP when its credentials are set, the console otherwise).
- The notification of the school attachment decision ECO-15, not connected: to add with `notify()` once its event exists.
- The e-mail is sent during the request that triggers it; with a slow provider, a queue would be needed.
