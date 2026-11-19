# Exports CSV

Chaque rôle exporte ses données depuis le bouton « Exporter en CSV » de la page concernée. Les routes sont des `GET` qui répondent un fichier `text/csv; charset=utf-8` en pièce jointe (`<nom>-AAAA-MM-JJ.csv`), en UTF-8 avec BOM et séparé par des points-virgules pour que Excel en français l'ouvre directement. Les dates s'écrivent `JJ/MM/AAAA HH:MM`. Un texte qui commencerait par `=`, `+`, `-` ou `@` est précédé d'une apostrophe : il n'est jamais lu comme une formule.

Un filtre vide est un filtre absent. Une liste s'écrit `a,b,c`. Un filtre inconnu ou invalide (valeur hors liste, paramètre inconnu) répond `400 { "error": "Invalid filters" }`. Autres réponses : `403` pour un autre rôle ; `409 { "error": "No school" }` pour un compte école sans établissement.

Groupes de statuts de candidature (`status`) : `draft` (brouillon), `submitted` (postulée), `review` (lue ou en cours d'étude), `accepted`, `refused`.

## Étudiant — `GET /api/applications/export`

Ses candidatures, brouillons compris, de la plus récente à la plus ancienne.

- Filtre : `status` (liste de groupes).
- Colonnes : Offre, Entreprise, Statut, Envoyée le, Mise à jour le, Contrat (déposé, validé par l'école, signé, ou vide).

## École — `GET /api/school/students/export`

Les étudiants rattachés à l'école (hors comptes suspendus), par nom.

- Filtres : `status` (liste d'avancements `searching`, `applying`, `accepted`, `contract`, `signed`, comme `/api/school/students`), `q` (mots du prénom ou du nom).
- Colonnes : Prénom, Nom, E-mail, Niveau d'études, Avancement, Candidatures envoyées, Entreprise du contrat, Étape du contrat (le contrat le plus avancé).

## Recruteur — `GET /api/recruiter/offers/export`

Seulement ses offres : l'identifiant d'une offre d'un autre recruteur est ignoré. Les brouillons ne sont jamais exportés.

- Filtres : `content` (`offers`, par défaut, ou `candidates`), `offer` (liste d'identifiants d'offres, toutes par défaut ; la page d'une offre exporte la sienne), `offer_status` (`active` ou `closed`), `status` (liste de `submitted`, `review`, `accepted`, `refused`).
- `content=offers`, une ligne par offre : Offre, Statut, Créée le, Type de contrat, Lieu, Candidatures (celles du filtre `status`), Postulées, En cours d'étude, Acceptées, Refusées.
- `content=candidates`, une ligne par candidature reçue : Offre, Prénom, Nom, École, Niveau d'études, Expérience (mois), Compétences, Région, Statut, Envoyée le. Pas d'e-mail : le recruteur ne le voit pas ailleurs.

## Offre — `GET /api/offers/<id>/export`

Étudiant seulement (`403` sinon), pour une offre publiée (`404` sinon). Une ligne avec ce que la plateforme montre de l'offre : Offre, Entreprise, Ville, Secteur, Description, Profil recherché, Publiée le. Aucune donnée du recruteur (candidatures, candidats).

## Administration — `GET /api/administration/users/export`

Les comptes de tous les rôles, par nom.

- Filtres : `q`, `status` (`active`, `suspended`) et `school` comme `/api/administration/users` ; `role` (`student`, `school`, `recruiter`, `admin`) ; `ids` (liste d'au plus 500 identifiants de comptes : la sélection cochée dans la liste, qui respecte les autres filtres).
- Colonnes : Id, Prénom, Nom, E-mail, Rôle, École (celle du profil étudiant ou du compte école), Entreprise, Inscription, Statut, Suspendu le.
