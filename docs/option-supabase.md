# Option B : données dans Supabase

Le site reste sur GitHub Pages. Les données vont dans une base **PostgreSQL** gérée par Supabase, hébergée en Europe. La connexion se fait avec le compte de l'établissement (fournisseur Azure / Entra ID de Supabase, limité au seul annuaire de l'établissement).

Le schéma complet est dans [`supabase/schema.sql`](../supabase/schema.sql). Il a été testé sur PostgreSQL 16 avec des données fictives : lecture interdite sans compte, écriture du fil réservée à la vie scolaire, prise et reprise prioritaire d'un relais, refus après l'échéance, échange proposé puis accepté, statistiques par discipline refusées à un enseignant.

## Ce qui change par rapport à SharePoint

| | SharePoint + Power Automate | Supabase |
|---|---|---|
| **L'arbitre** (relais, reprise, échanges) | Flux asynchrone : réponse en quelques secondes à une minute | **Fonction SQL** exécutée en une transaction : « C'est à vous » s'affiche immédiatement, deux clics simultanés ne font jamais deux gagnants |
| **Cloisonnement** | Liste « Demandes » + flux | **Règles RLS** dans la base, testables |
| **Écran salle des profs** | Actualisation périodique | **Temps réel** possible (Supabase Realtime) |
| **Développement** | Plus de réglages (Entra, `Sites.Selected`, flux) | Plus simple : un seul endroit, tout en SQL |
| **RGPD** | Contrat Microsoft existant | **Nouveau sous-traitant** : contrat de traitement (DPA) à accepter, inscription au registre, avis du DPO |
| **Hébergement** | Microsoft 365 de l'établissement | Région à choisir : **Paris** (eu-west-3) ; Supabase est une entreprise américaine hébergée chez AWS |
| **Offre gratuite** | Incluse | 2 projets, 500 Mo, 50 000 utilisateurs actifs par mois ; **mise en pause après 7 jours sans activité** |
| **Maintenance** | Microsoft | Vous (mises à jour du schéma, sauvegardes, surveillance) |

## Le point de vigilance : la mise en pause

Un projet gratuit s'arrête après une semaine sans activité, et doit être relancé depuis le tableau de bord. Pendant des vacances de deux semaines, Relais serait donc en pause le jour de la rentrée. Trois parades possibles :

1. La vie scolaire relance le projet le dernier jour des vacances (deux clics), ou on programme un rappel.
2. On passe à l'offre payante pour l'établissement : elle supprime la pause.
3. Une tâche automatique qui « réveille » la base régulièrement. C'est techniquement possible, mais c'est contourner l'esprit de l'offre gratuite : à éviter pour un outil d'établissement.

## Architecture

```
Navigateur ──► GitHub Pages (site vide, public)
     │
     └─► Supabase Auth ──► connexion Entra ID (annuaire de l'établissement uniquement)
     └─► Supabase API ──► PostgreSQL + RLS
                            ├─ tables : staff, classes, lessons, absences, events, lines,
                            │           exchanges, room_requests, notifications, settings
                            └─ fonctions « arbitre » : take_relais, withdraw_relais,
                                 propose_exchange, answer_exchange, stats_by_subject
     notifications (table) ──► Edge Function ──► Teams (webhook « Workflows ») ou mail
```

## Réglages indispensables

1. Projet créé en région **Paris**, idéalement au nom de l'établissement, avec DPA accepté.
2. **Connexion Entra ID uniquement** : dans Supabase, champ *Azure Tenant URL* = `https://login.microsoftonline.com/<identifiant-annuaire>` ; application Entra monolocataire ; claim facultative `xms_edov` ajoutée, comme le recommande la documentation Supabase. **Inscription par e-mail désactivée.**
3. Table `staff` remplie à l'import de l'EDT : un compte qui se connecte mais dont l'adresse n'y figure pas **ne voit rien**.
4. RLS activée sur toutes les tables (c'est le cas dans le schéma) ; seule la clé publique (`anon`) dans le site, **jamais** la clé `service_role`.
5. Purge de fin d'année : `purge_annee()`, après export des statistiques.

## Notifications vers Teams

Les connecteurs Office 365 historiques de Teams sont en cours de retrait ; Microsoft oriente vers les **Workflows** (Power Automate), avec un déclencheur « Quand une requête webhook Teams est reçue ». Une Edge Function Supabase peut appeler ce webhook à chaque nouvelle notification. Vérifier sur votre tenant que ce déclencheur est disponible avec vos licences.

## Avis

Pour Relais, qui ne contient **aucune donnée d'élève** (seulement des noms de collègues, des classes et des créneaux), les deux options sont défendables. **Supabase offre la meilleure expérience** : arbitrage instantané, écran en temps réel, développement plus simple. **SharePoint reste la voie la plus simple administrativement**, sans nouveau sous-traitant ni question de mise en pause. Le choix revient à la direction et au DPO ; le code de la maquette est prévu pour accueillir l'un ou l'autre.

## Sources

- [Supabase : connexion avec Azure (Microsoft Entra ID)](https://supabase.com/docs/guides/auth/social-login/auth-azure)
- [Supabase : Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Limites de l'offre gratuite Supabase en 2026](https://automationatlas.io/answers/supabase-free-tier-limits-2026/)
- [Webhooks Teams : passage aux Workflows](https://webhookrelay.com/blog/microsoft-teams-webhook/)
