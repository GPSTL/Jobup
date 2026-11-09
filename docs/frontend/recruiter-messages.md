# REC-05 — interface recruteur (frontend)

Routes protégées par RequireRecruiter : `/recruiter/messages` et `/recruiter/messages/:id`.
Le profil transmet `?candidate=<id>` pour sélectionner une conversation existante.
La création d'une conversation reste à coordonner avec JOB-041 ; aucune conversation
n'est créée automatiquement à l'ouverture d'un profil.

Le fil réutilise MessageThread et les GET/POST de JOB-034, sans stockage parallèle.
Envoi refusé si vide ou > 2000 caractères. Brouillon conservé en cas d'erreur.
Horodatages serveur, affichage local fr-FR, regroupement par jour. Polling des
messages toutes les 10 secondes lorsque l'onglet est visible.

## Contrat proposé — à valider avec JOB-041 / backend

GET `/api/recruiter/conversations` (endpoint non présent à cette date) :

```json
[{"id": 1, "candidate": {"id": 12, "first_name": "Sarah", "last_name": "Benali"}, "last_message": {"body": "Bonjour", "created_at": "2026-11-09T10:00:00Z", "from_me": false}, "last_seen_at": null}]
```

`last_message` peut être null. Le serveur doit filtrer les conversations selon
le participant connecté. Le client ne constitue pas un contrôle d'accès.

Présence proposée : `last_seen_at` doit être une activité observée par le serveur
(heartbeat authentifié, pas last_login). « En ligne » pendant 120 secondes,
puis « Hors ligne ». La valeur future, invalide ou absente affiche
« Présence indisponible ». Le navigateur réévalue l'expiration toutes les 5 secondes
et actualise la liste toutes les 30 secondes quand la page est visible.
La règle et le heartbeat restent à implémenter/valider côté backend.

## Démonstration frontend

`/recruiter/messages?demo=1` : deux conversations fictives, dont une en ligne et
une hors ligne. La présence en ligne expire après deux minutes sans renouvellement.
Les envois sont simulés en mémoire et disparaissent au rechargement ; ils ne sont
jamais envoyés au serveur. La page indique explicitement ce mode. Les endpoints
réels et la protection d'accès ne sont pas remplacés dans le mode normal.

La conformité visuelle Figma et la présence effective nécessitent encore une validation.
