# ADM-01 — Liste d’utilisateurs

Page React : `/administration/users`. Le préfixe `/admin/` reste réservé à
Django Admin. Un compte de rôle `127` arrive sur cette liste après connexion
via `/login`. Le serveur protège aussi l'accès direct à la page ; l'API vérifie
indépendamment le rôle. Un superutilisateur d'un autre rôle n'a pas accès.

## API

`GET /api/administration/users?page=1` utilise la session Django. Réponse :

```json
{
  "count": 1,
  "page": 1,
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

Huit comptes étudiants par page, triés par `-date_joined`, puis `-pk`. Seul le
rôle étudiant est visible, y compris les comptes inactifs, conformément au
périmètre confirmé. Liste vide : page 1, zéro résultat et une page. Page invalide : 400 ;
page hors limites : 404 ; absence de session ou rôle non admin : 403.

Le champ nullable `User.suspended_at` permet l'affichage d'une date réelle.
Il ne déclenche aucune suspension et aucune date n'est déduite pour les comptes
historiques. Les comptes inactifs sans date affichent « date non renseignée ».
Les dates sont affichées au format français dans le fuseau Europe/Paris.

## Installation locale et coordination

Exécuter `make migrate` avant de charger la liste après cette modification.
Les migrations restent générées localement et ignorées par Git. Ne pas exécuter
`make init` : cette cible supprime la base.

La flèche ouvre `/administration/users/:id`, une fiche étudiant dédiée aux
administrateurs, et conserve la page de retour de la liste. La fiche affiche
le nom, l'école, l'e-mail, la date d'inscription et le nombre de candidatures
ayant un `submitted_at` (les brouillons sont exclus). Aucun téléphone n'est
actuellement stocké : `phone: null`, affiché « Téléphone non renseigné ».
L'absence de profil étudiant associé ne masque pas le compte : école et CV
sont absents, et le compteur vaut zéro.

`GET /api/administration/users/:id` fournit ces données, le statut du compte
et `cv_url`. `GET /api/administration/users/:id/cv` télécharge le CV comme pièce
jointe, sans exposer de chemin de stockage. Les deux API exigent le rôle admin,
acceptent les étudiants inactifs et répondent 404 pour un compte inconnu ou
d'un autre rôle. Un CV absent ou un fichier supprimé répond aussi 404.
La fiche utilise la navigation partagée. Le bouton de suspension reste
indisponible en attendant confirmation du périmètre des opérations de suspension.

ADM-13 : l'authentification existante est réutilisée. Seule la destination de
connexion du rôle admin est ajoutée. Cette fonctionnalité ne configure ni
Django Admin ni `is_staff`, et ne crée aucun compte automatiquement.

Les autres rubriques de la maquette sont affichées comme indisponibles, sans
liens fictifs ni compteur de notifications de démonstration.
