# Preuves d'audit — mesures de conversion BOT-WOW

Ce dossier ne contient **aucune donnée client**. Seules les requêtes SQL sont
versionnées, pour que les chiffres cités dans
`reports/growth/2026-10-27-bot-wow-sale-readiness.md` puissent être rejoués et
contrôlés par quiconque a accès à la base.

| Fichier | Objet |
|---|---|
| `orders.sql` | Répartition des commandes par fournisseur et statut (total, montants, première/dernière occurrence, commandes de test Mollie `mode=test`/`mode=live` détectées dans `metadata`). |
| `o2.sql` | Contrôle de qualité des adresses e-mail des commandes : domaines distincts, repérage des adresses de test (`@example.`, `@test`, `@localhost`). |

**Portée :** lecture seule (`SELECT`), aucune écriture, aucune suppression,
aucune modification de ligne. Aucun résultat n'est copié dans ce dossier : les
agrégats cités dans le rapport sont les seuls chiffres publiés, et ils ne
contiennent aucune adresse e-mail.

**Période couverte par le rapport :** relevés du 27/10/2026 (mission de
préparation à la vente). Pour rejouer : `wrangler d1 execute <base> --remote
--file .audit/orders.sql` (adapter le nom de la base ; `botwow-production` pour
les commandes, `botwow-analytics` pour la télémétrie — voir le rapport).
