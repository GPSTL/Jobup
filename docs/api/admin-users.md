# ADM-01 — Utilisateurs

Page React : `/administration/users`. Le préfixe `/admin/` reste réservé à
Django Admin. Les administrateurs se connectent sur `/administration` (voir
« Connexion des administrateurs ») et arrivent sur cette liste. Le serveur
protège aussi l'accès direct à la page : un visiteur part vers
`/administration?next=…`, puis revient sur la page demandée après la connexion ;
un compte d'un autre rôle part vers l'accueil (ADM-13). L'API vérifie
indépendamment le rôle. Un superutilisateur d'un autre rôle n'a pas accès.

La liste montre les comptes de tous les rôles (étudiants, managers, recruteurs
et administrateurs) dans un tableau de données (data table) : recherche
pendant la saisie, filtres par type de compte et par statut, tri par colonne,
pagination et nombre de lignes par page. Le filtre par école, trop spécifique
pour tous les rôles, n'existe plus. Ces critères sont gardés dans l'URL de la page, avec les noms
des paramètres de l'API : un rechargement, les flèches du navigateur et
« Retour à la liste » depuis une fiche retrouvent le même tableau.

## API

`GET /api/administration/users` utilise la session Django. Paramètres, tous
facultatifs ; une valeur vide équivaut à un paramètre absent :

| Paramètre | Valeurs | Défaut |
| --- | --- | --- |
| `q` | 100 caractères au plus. Chaque mot doit se trouver dans le prénom, le nom, l'e-mail, l'école (étudiant ou manager) ou l'entreprise (recruteur), sans distinction de casse | — |
| `status` | `active` ou `suspended` (compte inactif) | tous |
| `role` | `student`, `manager`, `recruiter` ou `admin` | tous |
| `sort` | `first_name`, `last_name`, `email`, `role` ou `date_joined`, précédé de `-` pour l'ordre décroissant | `-date_joined` |
| `page` | entier à partir de 1 | `1` |
| `page_size` | `10`, `25` ou `50` | `10` |

Réponse :

```json
{
  "count": 1,
  "page": 1,
  "page_size": 10,
  "total_pages": 1,
  "results": [{
    "id": 7,
    "first_name": "Alice",
    "last_name": "Martin",
    "email": "alice@example.fr",
    "role": 1,
    "date_joined": "2026-10-09T12:00:00Z",
    "is_active": true,
    "suspended_at": null,
    "detail_url": "/administration/users/7"
  }]
}
```

Tous les comptes sont visibles, y compris les comptes inactifs et les
administrateurs. `role` est la valeur numérique du rôle (`1` étudiant, `2`
manager, `3` recruteur, `127` administrateur), affichée « Type de compte ». Le
tri par `role` suit cet ordre. Le tri est stable : l'id départage les comptes
aux valeurs égales, dans le sens du tri. Les noms et e-mails sont triés sans
distinction de casse. SQLite ne compare les majuscules et minuscules que pour
les lettres sans accent : « emilie » ne trouve pas « Émilie », et un nom
commençant par « É » est classé après « Z ».

Liste vide : page 1, zéro résultat et une page. Paramètre invalide : 400
(`{"error": "Invalid filters"}`) ; page au-delà de la dernière : 404 ; absence
de session ou rôle non admin : 403.

Le champ nullable `User.suspended_at` permet l'affichage d'une date réelle.
Il ne déclenche aucune suspension et aucune date n'est déduite pour les comptes
historiques. Les comptes inactifs sans date affichent « date non renseignée ».
Les dates sont affichées au format français dans le fuseau Europe/Paris.

## Installation locale et coordination

Exécuter `make migrate` avant de charger la liste après cette modification
(les écoles et les entreprises ont désormais un statut de validation, voir
`admin-organizations.md`). `GET /api/administration/users/filters` a disparu
avec le filtre par école.
Les migrations restent générées localement et ignorées par Git. Ne pas exécuter
`make init` : cette cible supprime la base.

## ADM-02 — Fiche utilisateur (JOB-064)

La flèche ouvre `/administration/users/:id`, une fiche dédiée aux
administrateurs, pour tous les rôles ; « Retour à la liste » retrouve le tableau tel qu'il était
(recherche, filtres, tri et page).

La fiche affiche le nom, la photo du profil (ou les initiales), le type de
compte, l'école (étudiant, manager) ou l'entreprise (recruteur), le téléphone,
l'e-mail et la date d'inscription. Pour un étudiant, elle ajoute le nombre de
candidatures envoyées et le CV ; les autres rôles n'ont ni candidatures
(`applications_sent` vaut `null`) ni CV. Seules les candidatures ayant un `submitted_at` comptent : un
brouillon n'a jamais été reçu par un recruteur (JOB-033). Un champ absent est
écrit : « École non renseignée », « Entreprise non renseignée », « Téléphone
non renseigné », « CV non déposé », « Aucune candidature envoyée ». Aucun téléphone n'est demandé, ni
à l'inscription (ETU-01) ni dans le profil (ETU-02) : `phone` vaut toujours
`null`. Un compte sans profil reste consultable : ni école ou entreprise, ni photo,
ni CV, et zéro candidature pour un étudiant.

« Télécharger le CV » est un lien de téléchargement, comme côté recruteur : le
serveur donne le nom du fichier.

## ADM-03 / ADM-04 — Suspension et rétablissement (faits dans JOB-064)

Sur un compte actif, « Suspendre le compte » ouvre une fenêtre de
confirmation ; « Annuler » (ou Échap) la ferme sans rien changer. Après
confirmation, la fiche et la liste affichent « Suspendu le … » en rouge. Sur
un compte suspendu, « Rétablir le compte » remplace ce bouton, sans
confirmation : la mention disparaît de la fiche et de la liste. Pas de motif
enregistré.

`POST /api/administration/users/:id/suspension` suspend le compte
(`is_active` faux, `suspended_at` à la date du jour) ; `DELETE` le rétablit.
Les deux répondent la fiche à jour (format ci-dessous) et exigent le rôle admin
(403). Tout compte non administrateur peut être suspendu : étudiant, manager ou
recruteur (404 pour un compte inconnu). **Un compte administrateur ne peut
jamais être suspendu**, pas même par un autre administrateur : 403
`{"error": "An administrator cannot be suspended"}`, et la fiche n'affiche
aucun bouton de suspension (`can_suspend` faux). Les rappeler ne change rien de plus :
une deuxième suspension garde la première date.

Effets d'une suspension :
- le compte ne peut plus se connecter : `/api/login` répond 403
  `{"error": "Account suspended"}` et la page affiche « Votre compte est
  suspendu. », seulement si le mot de passe est bon (sinon 401, comme toujours) ;
- sa session en cours se ferme à sa requête suivante (Django refuse un
  utilisateur inactif) ;
- il disparaît des cartes candidats et de la présélection des recruteurs, et ne
  reçoit plus de notifications ;
- ses conversations restent lisibles mais grisées chez le recruteur, avec
  « Compte suspendu » (`suspended` dans `docs/api/recruiter-conversations.md`) ;
  un nouveau message vers lui est refusé (409 `{"error": "Account suspended"}`).

`GET /api/administration/users/:id` :

```json
{
  "id": 7,
  "first_name": "Alice",
  "last_name": "Martin",
  "email": "alice@example.fr",
  "role": 1,
  "date_joined": "2026-10-09T12:00:00Z",
  "is_active": true,
  "suspended_at": null,
  "school": "Université Paris",
  "company": null,
  "photo_url": "/media/photos/alice.png",
  "phone": null,
  "applications_sent": 3,
  "cv_url": "/api/administration/users/7/cv",
  "can_suspend": true
}
```

`school` vaut `null` pour un recruteur et `company` pour les autres rôles.

`GET /api/administration/users/:id/cv` télécharge le CV comme pièce jointe,
sans exposer de chemin de stockage. Les deux API exigent le rôle admin (403
sinon), acceptent les comptes suspendus et répondent 404 pour un compte
inconnu. Le CV n'existe que pour un étudiant : 404 pour les autres rôles. Un CV absent ou un fichier supprimé répond aussi
404. Une session expirée sur la fiche propose de se reconnecter sur
`/administration`, qui ramène ensuite à la fiche.

## Connexion des administrateurs (ADM-13)

`/administration` affiche le formulaire de connexion des administrateurs, sans
lien d'inscription ni « Mot de passe oublié ». Un administrateur déjà connecté
passe directement à la liste (ou à la page `next`). « Déconnexion », dans le
menu du compte, ramène à ce formulaire.

`POST /api/administration/login` (`{"email", "password"}`, jeton CSRF comme
`/api/login`) n'ouvre une session que pour un compte de rôle `127` et répond
comme `/api/login` : 200 avec l'utilisateur, 400 si le corps est invalide. Un
mauvais mot de passe, un compte inconnu, inactif ou d'un autre rôle reçoivent
tous la même réponse, 401 `{"error": "Invalid credentials"}`, sans ouvrir de
session : le formulaire ne révèle pas le rôle d'un compte.

Aucun compte administrateur n'est créé par l'inscription publique :
`/api/signup` refuse le rôle `127` (400 sur `role`). Le compte partagé par
l'équipe est créé, ou son mot de passe mis à jour, par
`python manage.py create_admin`, qui lit `JOBUP_ADMIN_EMAIL` et
`JOBUP_ADMIN_PASSWORD` dans l'environnement (le `.env` local, jamais versionné)
ou les options `--email` et `--password`. Rien ne configure Django Admin ni
`is_staff`. Reste à faire pour ADM-13 : la fermeture de session après
30 minutes d'inactivité.

## Navigation de l'administration

Les rubriques sont : « Mon espace » (`/administration/account`),
« Utilisateurs », « Entreprises » (`/administration/companies`), « Écoles »
(`/administration/schools`), « Signalements » (`/administration/reports`) et
« Réclamations » (`/administration/claims`). « Mon espace », « Signalements » et
« Réclamations » sont des pages vides pour l'instant, avec un message
(« Aucun signalement pour le moment. », etc.). Aucun compteur de notifications
de démonstration n'est affiché.
