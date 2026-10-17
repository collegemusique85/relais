# Relais · maquette

Outil de vie scolaire pour le collège : absences des enseignants, **relais** (remplacements), échanges d'heures entre collègues, sorties et temps forts, écran de salle des profs.

> **Maquette avec des données entièrement fictives.** Les noms, les classes et les emplois du temps sont inventés ; seuls les horaires reprennent ceux de l'établissement. Rien n'est envoyé nulle part : vos essais restent dans votre navigateur.

## Essayer

Ouvrez la page publiée (GitHub Pages), ou `index.html` directement dans un navigateur. En haut, choisissez **qui vous êtes** :

| Rôle | Ce qu'on peut faire |
|---|---|
| **Vie scolaire** | Saisir une absence en une phrase (« Rolland jeudi matin »), choisir une solution parmi celles proposées (inversion, Self, relais, étude avec occupation des salles), ajouter sorties et temps forts, valider les demandes de salle, copier le récap du mercredi |
| **Enseignant** | Voir son emploi du temps réel, prendre ou reprendre un relais, trouver un échange avec un collègue qui a la même classe, demander une salle, suivre sa classe (professeur principal) |
| **Direction** | Le fil et les statistiques d'heures manquées pour sorties et temps forts (détail par discipline réservé à la direction) |
| **Écran** | Affichage pour la salle des profs |

L'horloge de démonstration est fixée au **mardi 3 novembre, 10h05**. Le bouton « Recommencer la démo » remet les données de départ.

## Règles de fonctionnement

- **Relais** : premier arrivé, premier servi, jusqu'à **la veille à 17h**. Un enseignant qui **a la classe** est prioritaire : il peut reprendre un relais pris par un collègue qui ne l'a pas ; ce dernier est prévenu. Pour un cours en groupe (langues, options), seuls les profs de la même matière et du même niveau sont prioritaires. La vie scolaire peut tout modifier. Le choix PACTE / RCD se note dans le commentaire, par la vie scolaire.
- **Échanges** : l'accord des deux collègues suffit ; la vie scolaire est informée. Possibles jusqu'aux prochaines vacances.
- **Salles** : un enseignant peut demander une salle précise ; la vie scolaire valide.
- **Temps forts** : la classe sortie « libère » ses professeurs, qui sont prévenus et proposés pour des relais ; les cours des accompagnateurs sont ajoutés au fil.
- **Statistiques** : un créneau = 1 h ; journées pédagogiques exclues. Aucune statistique sur les absences ou les remplacements des enseignants.

## Horaires utilisés

| | M1 | M2 | M3 | M4 | S1 | S2 | S3 | S4 |
|---|---|---|---|---|---|---|---|---|
| Mardi, jeudi | 8h30 | 9h25 | 10h40 | 11h35 | 13h45 | 14h40 | 15h50 | 16h45 |
| Lundi | – | 10h00 | 10h50 | 11h40 | 13h45 | 14h40 | 15h50 | 16h45 |
| Mercredi | 8h30 | 9h25 | 10h40 | 11h35 | – | – | – | – |
| Vendredi | 8h30 | 9h25 | 10h40 | 11h35 | 13h45 | 14h35 | 15h25 | – |

Lundi matin et vendredi après-midi : cours de 50 min. Les cours d'1h20 (SVT…) occupent un créneau et demi : `d1` / `d2` désignent les moitiés de créneau (gérés dans le modèle de données, pas encore dans la maquette).

## Organisation du code

```
index.html          page unique
css/style.css       styles (aucune police ni ressource externe : rien n'est chargé chez un tiers)
js/data.js          données FICTIVES : horaires, classes, profs, emploi du temps généré
js/engine.js        règles : vue effective de la semaine, suggestions, relais, échanges, stats, récap
js/app.js           interface
docs/               architecture SharePoint, option Supabase
supabase/schema.sql schéma de base (tables, sécurité, « arbitre ») pour l'option Supabase
```

`engine.js` range l'état derrière un petit « magasin ». Dans la maquette, c'est le navigateur ; dans la vraie version, ce sera une liste SharePoint ou une base Supabase, sans changer les règles.

## Pour la vraie version

Deux architectures sont décrites :

- [docs/architecture-sharepoint.md](docs/architecture-sharepoint.md) : données dans le Microsoft 365 de l'établissement.
- [docs/option-supabase.md](docs/option-supabase.md) : données dans une base Supabase hébergée en Europe.

**Règle n°1, quelle que soit l'option : aucune donnée réelle dans ce dépôt.**
