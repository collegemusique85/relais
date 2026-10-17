# Option A : données dans le Microsoft 365 de l'établissement

Le site (GitHub Pages) n'est qu'une vitrine vide. La personne se connecte avec son compte de l'établissement (Entra ID, bibliothèque MSAL.js) ; le site lit et écrit ensuite dans des **listes SharePoint** via Microsoft Graph, avec les droits de cette personne.

## Listes SharePoint (site « Applis »)

| Liste | Contenu | Vie scolaire | Enseignants |
|---|---|---|---|
| `EDT` | Emploi du temps importé (classe, groupe, matière, prof, jour, créneau, demi-créneau, parité, salle) | Lecture | Lecture |
| `Fil` | Absences, lignes du fil, solutions, commentaires | Lecture + écriture | Lecture |
| `Evenements` | Sorties, temps forts, informations | Lecture + écriture | Lecture |
| `Demandes` | « Je prends le relais », « je reprends », « je me désiste », échanges, salles | Lecture + écriture | **Ajout seulement** |
| `Reglages` | Capacité des salles d'étude, vacances | Lecture + écriture | Lecture |

**Pourquoi une liste « Demandes » ?** Dans SharePoint, on ne peut pas autoriser quelqu'un à modifier une seule colonne. Et rien ne garantit que le réglage « chacun ne modifie que ses éléments » soit respecté par l'API Graph. Les enseignants **déposent donc des demandes** et ne modifient jamais le planning.

## L'arbitre : un flux Power Automate

Déclencheur : « Quand un élément est créé » dans `Demandes`, avec **contrôle de la concurrence réglé sur 1** (une demande à la fois, dans l'ordre d'arrivée).

1. Lire la demande et la ligne du `Fil` concernée.
2. Vérifier l'échéance (la veille à 17h) et la priorité (le prof a-t-il la classe ?).
3. Mettre à jour la ligne du `Fil` (le flux s'exécute avec un compte de service de la vie scolaire).
4. Prévenir : le prof (« c'est à vous » / « déjà pris »), le prof délogé en cas de reprise, la vie scolaire.
5. Marquer la demande comme traitée (le site affiche le résultat).

Pour un échange : le connecteur **Approbations** (standard) envoie au collègue une demande avec deux boutons, Accepter ou Refuser, dans Teams ou Outlook. S'il accepte, la vie scolaire est informée.

Délai : quelques secondes à une minute entre le clic et la confirmation. Le site affiche « demande envoyée » en attendant.

## Inscription Entra ID (une seule fois)

- Application monopage, **monolocataire**, URL de redirection : la page `auth.html` du site.
- Permission déléguée **`Sites.Selected`**, ouverte au seul site « Applis » (rôle `write`).
- En mode délégué, les droits effectifs sont l'intersection entre ceux de l'application et ceux de la personne connectée.

## Points forts et limites

- ✅ Aucun nouveau sous-traitant : tout reste dans le contrat Microsoft existant.
- ✅ Les données sont consultables et exportables directement dans SharePoint.
- ⚠️ Arbitrage asynchrone (Power Automate), moins instantané que l'option Supabase.
- ⚠️ Plus de réglages initiaux : Entra, `Sites.Selected`, flux.
- ⚠️ Écran de salle des profs : actualisation périodique (toutes les 30 à 60 s), pas en temps réel.
