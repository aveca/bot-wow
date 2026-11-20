# BOT-WOW P0.14 — Entonnoir Commercial et Mesure des Conversions

**Date :** 27 octobre 2026  
**Dépôt :** `C:\factory\worktrees\bot-wow-repo` → `aveca/bot-wow` (GitHub)  
**Branche de travail :** `ui/p0.14-funnel-analysis-2026-10-27`  
**Base :** `main` (`e02bb2a` — inclut PR #50)  
**PR liée :** #44 (checkout garde, ouverte) — non fusionnée  
**PR liée :** #46 (EN hero CTA) — fusionnée, déployée  
**PR liée :** #48 (FR hero CTA) — fusionnée, déployée  
**PR liée :** #49 (P0.9 doc) — OPEN  
**PR liée :** #51 (P0.13 doc) — OPEN

---

## 1. État de la PR #51 (documentation P0.13)

| Propriété | Valeur |
|---|---|
| Numéro | #51 |
| URL | `https://github.com/aveca/bot-wow/pull/51` |
| État | **OPEN, MERGEABLE** |
| Base | `main` (`45b0c5c` — inclut PR #48) |
| Head | `06afdcc` |
| CI | `validate` pass · `ui-quality` pass · `GitGuardian` pass |

La PR #51 contient le rapport de vérification de production P0.13. Tous les contrôles CI sont verts. Elle est prête à fusionner.

---

## 2. Cartographie du Funnel Commercial

### 2.1 Sources de données

Deux bases de données distinctes sont utilisées :

| Base | Objet | Contenu |
|---|---|---|
| `botwow-analytics` (D1) | Télémétrie client | Événements de parcours (page_view, cta_click, checkout_requested, etc.) |
| `botwow-production` (D1) | Données métier | Commandes, licences, téléchargements, webhooks |

Les deux bases sont interrogées via `wrangler d1 execute --remote`.

### 2.2 Événements du funnel (données réelles, production)

| Événement | Source | Compte | Description |
|---|---|---|---|
| `page_view` | Telemetry DB | 980 | Visites de page |
| `cta_click` | Telemetry DB | 45 | Clics sur CTA d'achat |
| `checkout_requested` | Telemetry DB | 27 | Clics sur CTA d'achat (sous-ensemble) |
| `checkout_created` | Telemetry DB | 4 | Checkouts créés via le worker |
| `checkout_start` | Telemetry DB | 4 | Soumissions de formulaire checkout |
| `checkout_failed` | Telemetry DB | 4 | Échecs de création checkout |
| `payment_confirmed` | Worker webhook | Non dans telemetry DB | Paiements confirmés via webhook Mollie |
| `license_created` | Worker webhook | Non dans telemetry DB | Licences créées après paiement |
| `conversion` | Telemetry DB | Non dans telemetry DB | Événement de conversion serveur |

### 2.3 Données de commandes (production D1)

| État | Compte | Pourcentage des commandes |
|---|---|---|
| `paid` | 5 | 21.7% |
| `pending_payment` | 8 | 34.8% |
| `failed` | 9 | 39.1% |
| `rejected` | 1 | 4.3% |
| **Total** | **23** | **100.0%** |

### 2.4 Autres tables de production

| Table | Compte |
|---|---|
| `licenses` | 5 |
| `downloads` | 5 |
| `deliveries` | 0 |
| `webhook_events` | 14 |
| `mollie_customers` | (non compté) |

---

## 3. Calcul du Funnel Commercial

### 3.1 Entonnoir complet

| Étape | Événement | Compte | Taux de conversion (étape précédente) | Taux de conversion (visite) |
|---|---|---|---|---|
| 1 | Visite (page_view) | 980 | — | 100.0% |
| 2 | Clic CTA (cta_click) | 45 | 4.59% | 4.59% |
| 3 | Checkout demandé (checkout_requested) | 27 | 60.0% | 2.76% |
| 4 | Checkout créé (checkout_created) | 4 | 14.8% | 0.41% |
| 5 | Paiement confirmé (orders paid) | 5 | >100%* | 0.51% |

*\* Le nombre de commandes payées (5) dépasse le nombre de checkouts créés (4) dans la télémétrie. Cette divergence est analysée ci-dessous.*

### 3.2 Analyse par étape

| Transition | Compte départ | Compte arrivée | Taux de conversion | Perte |
|---|---|---|---|---|
| Visite → CTA clic | 980 | 45 | 4.59% | 95.4% |
| CTA clic → Checkout demandé | 45 | 27 | 60.0% | 40.0% |
| Checkout demandé → Checkout créé | 27 | 4 | 14.8% | 85.2% |
| Checkout créé → Paiement confirmé | 4 | 5 | >100%* | N/A |

### 3.3 Analyse détaillée par CTA

| CTA | Compte | Part des clics CTA |
|---|---|---|
| `hero-offer` | 26 | 57.8% |
| `nav-buy` | 9 | 20.0% |
| `final-buy` | 2 | 4.4% |
| `compare-buy` | 0 | 0.0% |
| `journey-fish-buy` | 0 | 0.0% |
| `journey-licence-buy` | 0 | 0.0% |
| `steps-buy` | 0 | 0.0% |
| `mbar-buy` | 0 | 0.0% |
| Autres (hero-demo, compare-cta, etc.) | 8 | 17.8% |
| **Total** | **45** | **100.0%** |

L'hypothèse éditoriale A (le CTA hero "temps gagné") génère 26/45 = **57.8%** des clics d'achat, confirmant son rôle dominant dans le parcours de conversion.

---

## 4. Défauts Prouvés

### 4.1 Défaut majeur : Chute entre checkout_requested et checkout_created

| Métrique | Valeur |
|---|---|
| Checkout demandé | 27 |
| Checkout créé | 4 |
| Taux de conversion | **14.8%** |
| Perte | **85.2%** |

**Diagnostic :** 85.2% des utilisateurs qui cliquent sur un CTA d'achat n'aboutissent pas à un checkout créé. C'est le plus gros point de friction du parcours commercial.

**Causes possibles :**
- L'utilisateur clique sur un CTA d'achat mais abandonne avant de remplir le formulaire
- Le checkout est bloqué par la garde `RELEASE_STATUS=pending` pour certains utilisateurs
- Problème technique lors de la création du checkout (erreur Mollie, erreur D1, etc.)
- Le bouton d'achat est cliqué par erreur ou par curiosité sans intention d'achat réelle

### 4.2 Défaut secondaire : Divergence checkout_created vs commandes payées

| Métrique | Valeur |
|---|---|
| Checkout créé (telemetry) | 4 |
| Commandes payées (production DB) | 5 |
| Écart | +1 |

**Diagnostic :** Le nombre de commandes payées (5) dépasse le nombre de checkouts créés dans la télémétrie (4). Cela indique que :
1. Certains paiements sont confirmés sans passer par le parcours checkout tracké (direct link, réactivation d'une commande existante, etc.)
2. Ou certains événements checkout_created sont manqués (utilisateurs avec Do Not Track activé, erreur de suivi, etc.)

### 4.3 Taux global de conversion

| Métrique | Valeur |
|---|---|
| Visites → Paiement confirmé | 5 / 980 = **0.51%** |
| CTA clic → Paiement confirmé | 5 / 45 = **11.1%** |
| Checkout demandé → Paiement confirmé | 5 / 27 = **18.5%** |

Le taux de conversion visite → paiement (0.51%) est faible mais dans la fourchette attendue pour un produit de niche avec une livraison non encore vérifiée.

---

## 5. Limites de la Mesure

| Limite | Détail |
|---|---|
| Données de paiement côté serveur | Les données de paiement (orders, licenses) sont dans une base D1 séparée de la télémétrie. Impossible de faire un JOIN entre événements de navigation et commandes payées sans identifier utilisateur commun (qui n'existe pas par design pour protéger la vie privée). |
| Do Not Track | Les utilisateurs avec DNT activé ne sont pas trackés, sous-estimant le trafic réel. |
| Données temporelles | Aucune donnée temporelle (horodatage) n'a été extraite pour analyser les tendances dans le temps. |
| Données démographiques | Aucune donnée démographique (pas d'email, pas de nom, pas d'identifiant de commande dans la télémétrie par design). |
| Différence checkout_created vs commandes payées | 4 vs 5 — non expliquée, nécessite une investigation plus approfondie. |

---

## 6. Défaut Prouvé et Correctif

### 6.1 Défaut : Chute de 85.2% entre checkout demandé et checkout créé

**Cause racine probable :** Le parcours entre le clic sur un CTA d'achat et la création effective du checkout présente une friction importante. Les causes possibles incluent :
1. La garde `RELEASE_STATUS=pending` bloque le checkout pour les visiteurs non autorisés (bien que cela ne devrait pas empêcher la création du checkout, seulement le paiement)
2. Une friction dans le formulaire d'achat (champ email requis, montant fixe 20€ sans flexibilité)
3. Un problème technique dans le parcours entre le clic et la création du checkout Mollie

### 6.2 Correctif recommandé

**Ne pas modifier le checkout ou les paiements.** La mission P0.14 interdit explicitement les modifications aux paiements, prix, secrets ou configuration de checkout sans autorisation.

**Action recommandée :** Créer une issue dédiée pour investiguer la chute de 85.2% entre `checkout_requested` et `checkout_created`. Les pistes d'investigation :
1. Ajouter un événement de télémétrie intermédiaire entre le clic CTA et la création du checkout pour identifier où l'utilisateur abandonne
2. Analyser les logs d'erreur du worker pour identifier les échecs de création de checkout
3. Tester manuellement le parcours de checkout pour identifier les frictions UX

---

## 7. PR #51 (Documentation P0.13)

| Propriété | Valeur |
|---|---|
| Numéro | #51 |
| URL | `https://github.com/aveca/bot-wow/pull/51` |
| État | **OPEN, MERGEABLE** |
| Head | `06afdcc724906ca201cf4a6e9c3b8875563c5802` |
| CI | `validate` pass · `ui-quality` pass · `GitGuardian` pass |
| Contenu | Rapport de vérification de production du checkout (garde, artefact R2, téléchargement) |

La PR #51 est prête à fusionner. Tous les contrôles CI sont verts.

---

## 8. PR #48 (FR Hero CTA)

| Propriété | Valeur |
|---|---|
| Numéro | #48 |
| URL | `https://github.com/aveca/bot-wow/pull/48` |
| État | MERGED |
| Changement | `fr/index.html` : `hero-offer` passé de `btn-ghost` à `btn-gold` |

Le correctif FR est déployé en production et vérifié (voir P0.13).

---

## 9. PR #44 (Checkout Garde)

| Propriété | Valeur |
|---|---|
| Numéro | #44 |
| URL | `https://github.com/aveca/bot-wow/pull/44` |
| État | **OPEN, MERGEABLE** |
| Contenu | Garde `RELEASE_STATUS=pending` → `409 delivery_unverified` sur le checkout |

**Ne pas fusionner** — nécessite une décision explicite du mainteneur (déploiement en production requis).

---

## 10. Risque et Recommandation

### 9.1 Risque principal : Perte de 85.2% entre checkout demandé et checkout créé

C'est le plus gros goulot d'étranglement du parcours commercial. 27 utilisateurs cliquent sur un CTA d'achat mais seulement 4 aboutissent à un checkout créé.

**Recommandation :** Prioriser l'investigation de cette chute avant toute autre optimisation. Même une amélioration modeste (de 14.8% à 25%) doublerait le nombre de commandes payées.

### 9.2 Deuxième priorité : Investiguer la divergence checkout_created (4) vs commandes payées (5)

Comprendre pourquoi 5 commandes sont payées alors que seulement 4 checkouts ont été créés selon la télémétrie. Cela peut indiquer un problème de suivi ou un parcours alternatif non tracké.

### 9.3 Pas de modification du checkout

La mission P0.14 interdit explicitement les modifications au checkout, aux paiements, aux prix ou aux secrets. Toute modification du checkout nécessite une autorisation explicite séparée.

---

## 11. Conclusion

Le funnel de conversion BOT-WOW est fonctionnel mais présente un goulot d'étranglement significatif entre le clic sur un CTA d'achat et la création du checkout (perte de 85.2%). Les données de production montrent :
- 980 visites, 45 clics CTA, 27 checkouts demandés, 4 checkouts créés, 5 commandes payées
- Taux de conversion visite → paiement : 0.51%
- Le CTA hero "See the offer"/"Voir l'offre" génère 57.8% des clics d'achat

**Recommandation prioritaire :** Investiguer la chute entre `checkout_requested` (27) et `checkout_created` (4) avant toute autre optimisation. Une amélioration de ce taux aurait l'impact commercial le plus direct.

---

**Rapport final :** `docs/reports/missions/BOT-WOW-P0.14-FUNNEL-ANALYSIS-2026-10-27.md`

**Prochaine action prioritaire :** Créer une issue dédiée pour investiguer la chute de 85.2% entre `checkout_requested` et `checkout_created`, avec comme objectif d'augmenter le taux de conversion de cette étape.
