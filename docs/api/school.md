# Espace école (ECO) — suivi des étudiants et des contrats

Un compte `Role.MANAGER` (« employé d'école ») suit les étudiants rattachés à son école jusqu'à la signature de leur contrat. L'étudiant voit l'avancement de son contrat dans le détail de sa candidature.

Toutes les routes `/api/school*` sont réservées au rôle manager (`403` sinon). Sauf `GET`/`POST /api/school`, elles exigent que le compte ait une école (`409 { "error": "No school" }` sinon). Les écritures requièrent un jeton CSRF `X-CSRFToken` (via `/api/csrf`).

## Compte de l'école

- `GET /api/school` : `{ "school": null }` tant que l'école n'est pas choisie, sinon `{ school: { id, name }, stats: { students, searching, signed, found, pending_requests, contracts_to_validate } }`. `found` (JOB-047) : étudiants ayant trouvé leur alternance, c'est-à-dire une candidature acceptée (avancement `accepted`, `contract` ou `signed`).
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

- `GET /api/school/students` : `[{ id, first_name, last_name, photo_url, status, application_count, last_application_at }]`, par nom. `last_application_at` (JOB-047) : date d'envoi de la dernière candidature, `null` sans candidature. Les comptes suspendus n'apparaissent pas.
- `GET /api/school/students/<id>` : le même résumé plus `applications: [{ id, offer_title, company, status, submitted_at }]`, `contracts` (format ci-dessous) et `conversation_id` (`null` si aucune). `404` pour un étudiant inconnu ou d'une autre école.
- `DELETE /api/school/students/<id>` (JOB-049) : retire l'étudiant de l'effectif suivi, par exemple en fin de formation → `204`. L'école perd l'accès à sa fiche, à son suivi et à ses contrats (liste, validation, tableau de bord) ; son compte, ses candidatures et ses contrats sont gardés. Sa demande acceptée est effacée : il peut en refaire une. Il est notifié (`school_request`, lien `/student#school`). `404` si l'étudiant n'est pas rattaché à cette école.

## Contrats

Étapes (`stage`) : `0` candidature acceptée (implicite, pas de contrat), `1` déposé, `2` validé par l'école, `3` signé. Le contrat est déposé par le recruteur (voir `recruiter-decisions.md`) ; l'école le fait avancer, une étape à la fois, sans retour en arrière.

Format d'un contrat côté école : `{ id, stage, deposited_at, validated_at, signed_at, start_date, end_date, file_name, file_url, period, student, company, offer_title, application_id }`. `period` (JOB-048) : `upcoming` avant la date de début, `ongoing` du début à la fin comprise, `finished` ensuite, au jour de Paris ; `null` sans dates. Côté étudiant (`contract` dans `GET /api/applications/<id>`) et côté recruteur : `{ id, stage, deposited_at, validated_at, signed_at, start_date, end_date, file_name, file_url }` ou `null`. `start_date`/`end_date` (`AAAA-MM-JJ`), `file_name` et `file_url` valent `null` pour un contrat déposé avant JOB-045, sans PDF.

- `GET /api/school/contracts` : contrats de l'école, les plus récents d'abord.
- `PATCH /api/school/contracts/<id>` : `{ "stage": 2 | 3 }` → contrat à jour. `400` si l'étape est invalide, `409` si ce n'est pas l'étape suivante, `404` hors de l'école.
- `POST /api/recruiter/applications/<id>/contract` (JOB-045, REC-26) : le recruteur propriétaire dépose le contrat d'une candidature **acceptée** dont l'étudiant a une école. Corps `multipart/form-data` : `file` (PDF reconnu au contenu, 10 Mo au plus), `start_date` et `end_date` (`AAAA-MM-JJ`, fin après début). Réponse : le détail de la candidature, `201` à la création, `200` pour un remplacement. `400 { errors: { file | start_date | end_date: [message] } }` si le fichier ou les dates sont invalides ; `409` si la candidature n'est pas acceptée ou si l'étudiant n'a pas d'école ; `409 { errors: { file } }` si le contrat ne peut plus être remplacé ; `503 { errors: { file } }` si le fichier n'a pas pu être stocké.
- Remplacement : renvoyer un contrat remplace le PDF et les dates, jusqu'à la veille de la date de début (heure de Paris) et tant qu'il n'est pas signé. Le contrat revient à l'étape `1` (déposé) et l'école doit le valider de nouveau ; l'école et l'étudiant sont notifiés (« Contrat remplacé »). Seule la dernière version est gardée ; un remplacement refusé ou échoué laisse le contrat précédent intact.
- `GET /api/contracts/<id>/file` : télécharge le PDF (`application/pdf`, en pièce jointe, `Cache-Control: private, no-store`). Accès : le recruteur de l'offre, l'étudiant du contrat et les comptes de son école tant qu'il y est rattaché. `404` pour tous les autres, et pour un contrat sans PDF.
- `GET /api/student/contracts` (étudiant, « Mon espace ») : ses contrats, les plus récents d'abord, au format étudiant plus `company`, `school`, `offer_title` et `application_id`. `403` pour un autre rôle.

## Messagerie

Les conversations école ↔ étudiant utilisent les routes communes `/api/conversations/<id>/messages` ; l'école en a la liste et peut en ouvrir.

- `GET /api/school/conversations` : même format que la liste recruteur.
- `POST /api/school/conversations` : `{ "student_id": <id> }` → `201 { id, created, student }` (`200` si elle existe). `404` si l'étudiant n'est pas de l'école.

## Notifications

Types ajoutés : `school_request` (aux managers de l'école : nouvelle demande, lien `/school/students` ; à l'étudiant : décision, lien `/student#school`) et `contract_update` (dépôt : managers et étudiant ; validation et signature : étudiant, lien `/applications/<id>`). Un message de l'étudiant à l'école notifie le manager (lien `/school/messages/<id>`). Réglage : `school_updates` (voir `notifications.md`).
