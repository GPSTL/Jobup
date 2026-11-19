# Notifications API (JOB-042, ETU-28 · JOB-046, REC-32)

Contract between the shared notification layer and the front end: the bell of the navigation bar (`front/components/NotificationBell.tsx`), the page “Notifications” (`front/pages/NotificationsPage.tsx`) and the “Notifications” block of “Mon espace” (`front/components/NotificationSettings.tsx`). The front end calls it through `front/services/notifications.ts`, whose types mirror the bodies below. What changes from a role to another (pages, switches shown) is in `ROLE_NOTIFICATIONS` (`front/utils/notifications.ts`).

The layer is shared by every role: the models (`Notification`, `NotificationPreference` in `jobup/models.py`), `notify()` (`jobup/notifications.py`) and these routes are the same for the students (JOB-042), the recruiters (JOB-046) and, later, the schools (ECO-21).

| Role | Bell and page | Preferences |
|---|---|---|
| Student | `StudentNavbar`, `/notifications` | “Mon espace” `/student#notifications` |
| Recruiter | `RecruiterNavbar`, `/recruiter/notifications` | “Mon espace”, tab “Compte et abonnement” `/recruiter/account#notifications` |

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
| Application sent (status “submitted”, JOB-046) | The recruiter who published the offer | “Nouvelle candidature”, “Lucas Martin a postulé à « Développeur Java en alternance ».” Link `/recruiter/candidates/<student>?offer=<offer>`, the profile of the candidate for this offer (as “Voir” in the applicants of an offer, JOB-040) |
| New message of the student (JOB-046) | The recruiter of the conversation | “Nouveau message de Sarah Benali”, the start of the text or “Pièce jointe : <name>”. Link `/recruiter/messages/<conversation>` |

- The events are connected to the models (`post_save` of `Message` and `JobApplication`, in `jobup/models.py`), so every screen and API that saves a message or a status triggers them, the recruiter decision of JOB-044 included. A status changed with `QuerySet.update()` does not go through `save()` and is not notified.
- They run once the save is committed: a failure of the notification never cancels the message or the status.
- No duplicate: every notification records its event (`message:<id>`, `application:<id>:submitted`, `application:<id>:review`, `application:<id>:accepted`…), unique per recipient. “Read” then “in review” are the same event for the student (both show “En cours d’étude”), so they give one notification.
- Rights: only the person who can open the resource is notified. An application goes to the author of the offer only, never to the other recruiters of the company (JOB-040 shows them the applications of their own offers only); a message goes to the other participant of the conversation only. A deactivated account is never notified.
- An application created as a draft notifies nobody: it counts once sent, when its status becomes “submitted” (or when it is created directly as “submitted”).
- Not notified: the own messages and actions of everyone (the student sending an application, the recruiter writing or deciding). A message of the student to a school notifies the school employee (link `/school/messages/<conversation>`).

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

Newest first. `kind` is `message`, `application_update`, `application_accepted`, `application_refused`, `new_application`, `school_request` or `contract_update` (the front end shows a generic icon for an unknown kind). `link` is a page of the application, `""` when there is none. A wrong `before` or `limit` responds `400`.

| Route | Effect | Success |
|---|---|---|
| `GET /api/notifications/unread-count` | Number of unread notifications, for the badge of the bell | `{ "unread_count": 3 }` |
| `POST /api/notifications/<id>/read` | Marks one notification as read. Doing it again changes nothing | `{ "notification": {…}, "unread_count": 2 }` |
| `POST /api/notifications/read-all` | Marks all of the user's notifications as read | `{ "unread_count": 0 }` |

The read state is stored on the server (`read_at`): the count stays the same after a reload or on another device.

## Preferences

`GET /api/notifications/preferences` and `PUT /api/notifications/preferences`:

```json
{ "messages": true, "application_status": true, "new_applications": true, "school_updates": true, "email": false }
```

- `school_updates`: school attachment requests and contract steps (`school_request`, `contract_update`). Shown to the student and to the school employee.
- `messages`, `application_status` and `new_applications`: receive the notifications of this kind in the application. Every key is returned to every role; each “Mon espace” shows its own switches: `messages` and `application_status` for the student, `new_applications` and `messages` for the recruiter.
- `email`: receive an e-mail too, for the notifications that are created. Turning it off never removes the notifications of the application.
- `PUT` only changes the fields it sends. A value that is not a boolean responds `400` with `errors`.
- Initial values, those of the mockups “Mon espace – Compte et abonnement”: every kind on; e-mail off for the student, on for the recruiter. The preferences are created on the first read or the first notification.

## E-mail

When `email` is on, `notify()` sends “JobUp — <title>” to the user's address, with the text and the absolute link (`SITE_URL`). A failed sending is logged and the notification stays. Without SMTP credentials (`THE_EMAIL_ADDRESS`, `THE_PASSWORD`), the default mailer prints the e-mails in the console instead of failing (`jobup/settings.py`).

## To be validated (open questions of ETU-28 and REC-32)

- The panel of the bell (latest 20, “Voir toutes les notifications”), the marking as read when a notification is opened, and the link it opens.
- The initial value of the e-mail preference (off for the student, on for the recruiter, as in their mockups), the wording of the e-mails and the provider (none chosen: Gmail SMTP when its credentials are set, the console otherwise).
- Several recruiters of a company: only the author of the offer is notified of its applications, and only the recruiter of a conversation of its messages, as the screens of JOB-040 and JOB-039 show them nothing else.
- The link of a new application: the profile of the candidate for the offer. The list of the applicants of the offer (`/recruiter/offers/<id>/applicants`, JOB-040) would be the other choice.
- The mockup “Notifications recruteur” also shows reminders (“4 candidatures en attente de décision”) and answers to a complaint: out of REC-32, not built.
- The e-mail is sent during the request that triggers it; with a slow provider, a queue would be needed.
