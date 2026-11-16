# Recruiter conversations API

Contract between the back end of JOB-039 (REC-05) and the « Messages » tab of the recruiter (`front/pages/RecruiterMessagesPage.tsx`): the list of the conversations of the recruiter, with the presence of each candidate. The front end calls it through `front/services/recruiterConversations.ts`.

The thread and the sending are not here: they are the API of JOB-034, common to the student and the recruiter, `GET` and `POST /api/conversations/<id>/messages` (`jobup/conversations.py`, `front/services/messages.ts`). Messages have a single storage, the `Conversation` and `Message` models of JOB-032, so a message sent by the recruiter is the one the student reads, and the other way round. New messages show up by polling: the thread every 10 seconds, the list every 30 seconds, while the tab is visible.

Search on the server and starting a conversation (« + ») belong to JOB-041, which can extend this route.

## Authentication

- The route uses the Django session opened by `POST /api/login`: every front-end request passes `credentials: "same-origin"`.
- It is reserved for recruiters (`role` 3). Without a session, as a student or as an administrator, it responds `403`.
- A recruiter only gets their own conversations, never those of a colleague of the same company.

## The list

`GET /api/recruiter/conversations` responds with an array, the most recently active conversation first (date of the last message, or of the creation for a conversation without message, as for the student, JOB-032):

```json
[
  {
    "id": 3,
    "candidate": { "id": 12, "first_name": "Lucas", "last_name": "Martin" },
    "last_message": { "body": "Bonjour !", "created_at": "2026-11-10T09:12:00.123456Z", "from_me": false },
    "seen_seconds_ago": 42
  }
]
```

| Field | Type | Content |
| --- | --- | --- |
| `id` | number | Id of the conversation, for `/api/conversations/<id>/messages`. |
| `candidate.id` | number | Account id of the student, as in `/api/recruiter/candidates/<id>`, not the id of the `Student` row: the « Message » button of the profile opens the conversation with `/recruiter/messages?candidate=<id>`. |
| `candidate.first_name`, `candidate.last_name` | string | Name of the student. |
| `last_message` | object or `null` | Last message of the conversation; `from_me` is true when the logged-in recruiter sent it. `null` for a conversation without message. |
| `seen_seconds_ago` | number or `null` | Seconds since the last request of the student (presence, below); `null` when the student has not made any request since the presence exists. |

## The presence

- **What the server stores**: `User.last_seen_at`, the time of the last request of the logged-in user, written by `PresenceMiddleware` (`jobup/presence.py`) after each request, at most once every 30 seconds per user. Requests without a session write nothing.
- **What keeps a student present**: any request of their pages. While a page of the student space is visible, `RequireStudent` makes one every minute (`front/services/presence.ts`); the Messages page also checks for new messages every 10 seconds.
- **The rule**: the recruiter sees « En ligne » when the student was seen less than 2 minutes ago (`PRESENCE_TTL`, `front/components/CandidatePresence.tsx`), « Hors ligne » after, and « Présence indisponible » when `seen_seconds_ago` is `null`. The page checks the rule again every 5 seconds and loads the list again every 30 seconds, so a closed tab, a hidden tab or a logout shows « Hors ligne » within 2 minutes; a student is never shown connected indefinitely.
- **Why an age rather than a date**: the server sends how many seconds ago it last saw the student, and the browser turns it into a date of its own clock. The two clocks can differ (e.g. WSL and Windows), and comparing them would show a present student « Hors ligne » or « Présence indisponible ».
- **Who sees it**: only the recruiters who have a conversation with the student, through this list.
- **Database**: `last_seen_at` is a new column of the user table: run `make migrate` after pulling.
