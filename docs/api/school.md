# Espace école (ECO) — suivi des étudiants et des contrats

Un compte `Role.MANAGER` (« employé d'école ») suit les étudiants rattachés à son école jusqu'à la signature de leur contrat. L'étudiant voit l'avancement de son contrat dans le détail de sa candidature.

Toutes les routes `/api/school*` sont réservées au rôle manager (`403` sinon). Sauf `GET`/`POST /api/school`, elles exigent que le compte ait une école (`409 { "error": "No school" }` sinon). Les écritures requièrent un jeton CSRF `X-CSRFToken` (via `/api/csrf`).

## Compte de l'école

- `GET /api/school` : `{ "school": null }` tant que l'école n'est pas choisie, sinon `{ school: { id, name }, stats: { students, searching, signed, pending_requests, contracts_to_validate } }`.
- `POST /api/school` : corps `{ "name": "..." }` (1 à 128 caractères), une seule fois par compte. `201 { school }`. `400 { errors: { name } }` si invalide, `409 { errors: { name } }` si l'établissement a déjà un compte école, `409 { error }` si le compte a déjà une école. Un établissement existant sans compte école peut être repris (les étudiants déjà rattachés y apparaissent). Aucune vérification de l'établissement par l'administration pour l'instant.

## Rattachement des étudiants

L'étudiant demande son école depuis « Mon espace » ; il n'est rattaché (`Student.school`) qu'une fois la demande acceptée.

- `GET /api/student/school` (étudiant) : `{ school, request, schools }`. `request` vaut `null` ou `{ school, status: "pending" | "refused" }` ; `schools` liste les écoles ayant un compte, vide si l'étudiant est rattaché ou a une demande en attente.
- `POST /api/student/school-request` : `{ "school_id": <id> }` → `201` même format. `409` si déjà rattaché ou demande en attente, `404` si l'école est inconnue ou sans compte. Après un refus, une nouvelle demande remplace l'ancienne.
- `DELETE /api/student/school-request` : annule une demande en attente (`404` sinon).
- `GET /api/school/requests` : demandes en attente `[{ id, student, created_at }]`, les plus anciennes d'abord.
- `PATCH /api/school/requests/<id>` : `{ "status": "accepted" | "refused" }` → `{ id, status }`. `409` si déjà décidée, `404` si hors de l'école.

## Suivi des étudiants

`status` est l'étape la plus avancée de l'étudiant : `searching` (aucune candidature envoyée), `applying`, `accepted`, `contract` (contrat déposé ou validé), `signed`. Un brouillon n'est pas une candidature envoyée. `student.id` est l'identifiant du compte, comme pour `/api/recruiter/candidates/<id>`.

- `GET /api/school/students` : `[{ id, first_name, last_name, photo_url, status, application_count }]`, par nom. Les comptes suspendus n'apparaissent pas.
- `GET /api/school/students/<id>` : le même résumé plus `applications: [{ id, offer_title, company, status, submitted_at }]`, `contracts` (format ci-dessous) et `conversation_id` (`null` si aucune). `404` pour un étudiant inconnu ou d'une autre école.

## Contrats

Étapes (`stage`) : `0` candidature acceptée (implicite, pas de contrat), `1` déposé, `2` validé par l'école, `3` signé. Le contrat est déposé par le recruteur (voir `recruiter-decisions.md`) ; l'école le fait avancer, une étape à la fois, sans retour en arrière.

Format d'un contrat côté école : `{ id, stage, deposited_at, validated_at, signed_at, student, company, offer_title, application_id }`. Côté étudiant (`contract` dans `GET /api/applications/<id>`) et côté recruteur : `{ id, stage, deposited_at, validated_at, signed_at }` ou `null`.

- `GET /api/school/contracts` : contrats de l'école, les plus récents d'abord.
- `PATCH /api/school/contracts/<id>` : `{ "stage": 2 | 3 }` → contrat à jour. `400` si l'étape est invalide, `409` si ce n'est pas l'étape suivante, `404` hors de l'école.
- `POST /api/recruiter/applications/<id>/contract` : le recruteur propriétaire dépose le contrat d'une candidature **acceptée** dont l'étudiant a une école. `201` à la création, `200` si déjà déposé (idempotent) ; `409` si la candidature n'est pas acceptée ou si l'étudiant n'a pas d'école.

## Messagerie

Les conversations école ↔ étudiant utilisent les routes communes `/api/conversations/<id>/messages` ; l'école en a la liste et peut en ouvrir.

- `GET /api/school/conversations` : même format que la liste recruteur.
- `POST /api/school/conversations` : `{ "student_id": <id> }` → `201 { id, created, student }` (`200` si elle existe). `404` si l'étudiant n'est pas de l'école.

## Notifications

Types ajoutés : `school_request` (aux managers de l'école : nouvelle demande, lien `/school/students` ; à l'étudiant : décision, lien `/student#school`) et `contract_update` (dépôt : managers et étudiant ; validation et signature : étudiant, lien `/applications/<id>`). Un message de l'étudiant à l'école notifie le manager (lien `/school/messages/<id>`). Réglage : `school_updates` (voir `notifications.md`).
