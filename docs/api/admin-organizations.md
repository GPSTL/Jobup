# Entreprises et écoles (administration)

Pages React : `/administration/companies` (« Entreprises ») et
`/administration/schools` (« Écoles »). Comme le reste de l'administration,
elles passent par la connexion `/administration` (voir `admin-users.md`) ; l'API
vérifie le rôle administrateur (403 sinon, y compris pour un superutilisateur
d'un autre rôle).

## Validation

Chaque entreprise et chaque école a un statut de validation, `status` :

| Valeur de l'API | Stocké | Libellé |
| --- | --- | --- |
| `pending` | `0` | En attente (valeur à la création) |
| `validated` | `1` | Validée |
| `refused` | `2` | Refusée |

Un administrateur valide ou refuse, et peut revenir sur son choix : tout statut
peut en remplacer un autre, y compris pour revenir « en attente ». Les boutons de
chaque ligne proposent les deux autres statuts : « Valider » / « Refuser » pour
une ligne en attente, « Refuser » / « Remettre en attente » pour une ligne
validée, « Valider » / « Remettre en attente » pour une ligne refusée. Aucun
motif n'est enregistré.

Pour l'instant le statut ne change rien côté public : une entreprise ou une école
refusée reste visible et utilisable. Seule l'administration le lit.

Migration : `School.status` et `Company.status` (défaut `0`). Exécuter
`make migrate` ; les entités existantes passent « en attente ».

## API

`GET /api/administration/companies` et `GET /api/administration/schools` utilisent
la session Django. Paramètres, tous facultatifs ; une valeur vide équivaut à un
paramètre absent :

| Paramètre | Valeurs | Défaut |
| --- | --- | --- |
| `q` | 100 caractères au plus. Chaque mot doit se trouver dans le nom, le SIRET ou la ville (entreprises), ou dans le nom (écoles), sans distinction de casse | — |
| `status` | `pending`, `validated` ou `refused` | tous |
| `sort` | entreprises : `name`, `city`, `recruiters`, `status` ; écoles : `name`, `students`, `managers`, `status` ; précédé de `-` pour l'ordre décroissant | `name` |
| `page` | entier à partir de 1 | `1` |
| `page_size` | `10`, `25` ou `50` | `10` |

Réponse (entreprises) :

```json
{
  "count": 1, "page": 1, "page_size": 10, "total_pages": 1,
  "results": [{
    "id": 4,
    "name": "Acme",
    "siret": "12345678901234",
    "city": "Paris",
    "website": "https://acme.example",
    "status": "pending",
    "recruiters": 2
  }]
}
```

Une ligne d'école : `{"id", "name", "status", "students", "managers"}`, avec le
nombre de comptes étudiants et de managers rattachés. Le tri est stable (l'id
départage) et ignore la casse. Paramètre invalide, y compris un tri de l'autre
liste : 400 `{"error": "Invalid filters"}` ; page au-delà de la dernière : 404 ;
liste vide : page 1, zéro résultat et une page.

`PATCH /api/administration/companies/:id/status` et
`PATCH /api/administration/schools/:id/status` (jeton CSRF) changent le statut :

```json
{ "status": "validated" }
```

Ils répondent la ligne à jour, au format de la liste. Corps invalide (statut
inconnu, champ en plus) : 400 `{"error": "Invalid payload"}` ; identifiant
inconnu : 404. Rappeler avec le même statut ne change rien de plus.

La liste se recharge après chaque décision : une ligne qui ne correspond plus
au filtre de statut en sort.
