# Diagnostic commercial et proposition d'offre — BOT-WOW

**Mission :** transformer le constat en produit commercial réellement réalisable, sans inventer de fonctionnalités  
**Dépôt :** aveca/bot-wow (exclusif)  
**Branche :** `p0/commercial-offer-feasibility-20261107` (depuis `main` = `ba720c0`)  
**Date :** 2026-11-07 (UTC)  
**PR associée :** à ouvrir vers `main` (non mergée, pas de déploiement)

---

## 1. État de référence (preuves directes)

### Ce qui est réellement dans le dépôt

| Élément | État | Preuve |
|---|---|---|
| Site public (bot-wow.com) | HTML/CSS/JS statique, demo simulée | `index.html`, `buy.html`, `features.html`, `demo.html` |
| Worker de paiement | Code présent, mais checkout fermé (`RELEASE_STATUS = "pending"`) | `worker/index.js:424`, `buy.html` |
| Enregistrements de modules (`assets/modules.json`) | Seul `fish` est `available` ; `inventory`/`navigate`/`recovery` = `development` ; `clients`/`follower`/`grind`/`scripting` = `planned` | `assets/modules.json` |
| Données de compatibilité | Aucune version datée (tout `not_tested` / `historical_unverified`) | `assets/compat.json` |
| Code runtime du bot | **Aucun fichier `.py/.lua` dans le dépôt** (jamais ajouté dans l'historique : `git log --all --diff-filter=A` vide sur ces extensions) | Mission #127 (PR #128) |
| Paquet client v1.2.0 | Non vérifiable (R2 `casinobabe-fishing-1.2.0.zip` introuvable, HTTP 404) | Mission #127, issue #134 |
| Commandes en production | 25 commandes, 0 livraison, 0 activation, 0 vente Mollie confirmée | D1 `botwow-production` (lecture seule) |

### Conclusion de l'état de référence

**Aucun produit n'est actuellement livrable depuis ce dépôt seul.** Le checkout est fermé, aucune livraison n'a été effectuée, aucune compatibilité serveur n'est datée, et le seul module déclaré `available` (pêche) n'a pas de code source dans ce dépôt.

---

## 2. Évaluation des trois pistes

### Piste 1 — Assistant de pêche (automatisation du gameplay)

| Critère | Évaluation |
|---|---|
| Demande client identifiable | Oui (historiquement documentée), mais non vérifiée commercialement (0 vente) |
| Conformité Blizzard | **Non démontrée, probablement non conforme** : automatise le gameplay (détection flotteur, clics, lecture d'écran). Les ToS Blizzard interdisent les logiciels d'automatisation/botting. Un serveur privé autorisant n'est pas une preuve de conformité aux ToS Blizzard. |
| Fonctionnalités présentes | Déclarées dans `modules.json` (fish `available`), mais **le code source n'est pas dans ce dépôt** (`scripts/fishing_bot.py`, `scripts/fishing_memory.py` absents, prouvé #127) |
| Effort de réalisation | Élevé : il faudrait d'abord rapatrier les sources depuis `aveca/Casinababe` (dépôt externe, hors périmètre de cette mission), puis les auditer |
| Délai avant première livraison vérifiable | Non déterminable sans les sources |
| Modèle commercial envisageable | Licence à vie 20 € (prix cible documenté), mais **non commercialisable tant que la conformité et la livraison ne sont pas démontrées** |
| Risques de support / remboursement | Élevés : bannissement de compte, non-fonctionnement sur un serveur donné, litige de remboursement |

**Verdict :** NON réalisable pour une commercialisation immédiate depuis ce dépôt. Ne pas réactiver l'ancienne promesse Gold/PvP/XP.

### Piste 2 — Compagnon WoW externe (préparation, suivi, analyse — SANS automatisation du gameplay)

| Critère | Évaluation |
|---|---|
| Demande client identifiable | Oui : préparation de sessions de pêche, suivi des spots, planification de parcours, analyse de données de jeu publiquement disponibles |
| Conformité Blizzard | **La plus vraisemblable** : outil indépendant, ne modifie pas le client, n'automatise pas le gameplay, n'apporte aucun avantage interdit dans le jeu. À confirmer directement auprès de Blizzard (non vérifié dans cette mission — recherche web indisponible) |
| Fonctionnalités présentes | Aucune dans ce dépôt (à construire). Le dépôt sait produire du HTML/JS statique (site, démo simulée) |
| Effort de réalisation | Faible à moyenne : construction d'un outil web statique de préparation/analyse, réutilisant l'infrastructure existante |
| Délai avant première livraison vérifiable | Courte (quelques semaines) si les sources du propriétaire sont disponibles |
| Modèle commercial envisageable | Accès gratuit ou modique à un outil d'aide à la préparation (pas de licence à vie liée à l'automatisation de gameplay) |
| Risques de support / remboursement | Faibles : pas d'automatisation, pas de bannissement lié à l'outil |

**Verdict :** **PISTE PRIORITAIRE.** C'est la seule offre réellement commercialisable à court terme depuis ce dépôt, sous réserve de confirmation de conformité auprès de Blizzard.

### Piste 3 — Produit logiciel autonome

| Critère | Évaluation |
|---|---|
| Produit existant ou réalisable rapidement | **Aucun** dans ce dépôt |
| Valeur commerciale | Non démontrée |

**Verdict :** Aucun candidat immédiat.

---

## 3. Offre prioritaire proposée : Compagnon de préparation WoW (pêche)

**Produit :** Outil web statique d'aide à la préparation et au suivi des sessions de pêche WoW Classic (planification de parcours, suivi des spots, journal de session), clairement étiqueté comme n'automatisant aucun gameplay et ne modifiant aucun client de jeu.

**Cible :** Joueurs de WoW Classic sur serveurs privés autorisant les outils d'aide (sous réserve des règles de chaque serveur et de la conformité Blizzard).

**Valeur concrète :** Gain de temps de préparation, suivi des observations, planification de trajets — sans botting, sans automatisation, sans avantage interdit dans le jeu.

**Preuves disponibles :** Le dépôt sait déjà produire un site statique avec démo simulée (`demo.html`, `demo-map.json`). L'infrastructure de build (`scripts/build-site.mjs`) et de test existe.

**Preuves manquantes (à fournir par le propriétaire) :**
- Code source effectif de l'outil compagnon (à construire ou à rapatrier)
- Confirmation de conformité Blizzard (à obtenir directement auprès de Blizzard)
- Preuve d'exécution réelle de l'outil

---

## 4. Conformité et risques

| Domaine | État | Action requise |
|---|---|---|
| Règles Blizzard (ToS botting/automatisation) | Non vérifié (recherche web indisponible dans cette mission) | Vérifier directement auprès de Blizzard avant toute commercialisation |
| Serveurs privés | Mention obligatoire présente sur les pages (`buy.html`, `features.html`, etc.) | Conserver |
| Affiliation Blizzard | Disclaimer présent ("ni affilié, ni approuvé") | Conserver |
| Paiement / checkout | Fermé, aucune vente effectuée | Ne pas ouvrir sans autorisation explicite |
| Identité du vendeur | Absente des pages légales (pas de raison sociale, adresse, SIREN, TVA) | Compléter (issue #101) |
| Conditions de vente / remboursement | Sous revue propriétaire (issue #101) | Attendre la validation propriétaire/juridique |

**Règle absolue :** Ne pas déclarer BOT-WOW commercialisable tant que le produit, sa livraison et sa conformité ne sont pas démontrés.

---

## 5. Modifications non financières proposées (PR ciblée)

Aucune modification de prix, checkout, secrets, bindings, D1, R2 ou Worker de production.

Proposition de clarification de l'offre (textes/documentation uniquement) :
1. **Clarifier l'offre prioritaire** sur les pages publiques : distinguer ce qui est "disponible dans le registre" (pêche, sans code dans ce dépôt) de ce qui est "réalisable" (compagnon externe, à construire)
2. **Renforcer l'étiquetage "simulation"** sur la démo navigateur (déjà présent, à maintenir)
3. **Améliorer le SEO/FR-EN** sans promesses non démontrées (pas de prétention de compatibilité, pas de promesse de fonctionnalité)
4. **Ajouter un test automatisé non financier** verrouillant l'absence de promesse de vente sur les pages publiques

Ces modifications sont réversibles et n'ont aucun impact financier.

---

## 6. Tests et CI

- `npm test` doit rester vert (24 suites, dont `release-availability`, `link-check`, `checkout-gate`, `checkout-security`, `worker-fulfillment-reconciliation`)
- `npm run validate` doit rester vert
- Aucun test financier ni aucun paiement simulé présenté comme réel

---

## 7. Obstacles

1. **Aucun code runtime dans ce dépôt** — le module pêche (seul `available`) n'a pas de source ici (dans `aveca/Casinababe`, hors périmètre)
2. **Aucune conformité Blizzard démontrée** — à vérifier directement auprès de Blizzard
3. **Aucune identité du vendeur** — pages légales sous revue (issue #101)
4. **Checkout fermé** — pas de livraison, pas d'activation, 0 vente confirmée

---

## 8. Prochaine action

Si le propriétaire valide la piste "compagnon externe sans automatisation" :
1. Construire l'outil web statique de préparation/analyse (hors périmètre de cette PR)
2. Obtenir la confirmation de conformité Blizzard
3. Compléter l'identité du vendeur dans les pages légales
4. Seulement alors, envisager l'ouverture du checkout (avec autorisation explicite)

Sans ces éléments, **aucun produit n'est commercialisable aujourd'hui.**

---

## Règles respectées

- Aucun merge de PR existante (#123, #124, #126, #128 laissées ouvertes)
- Aucun déploiement, aucun paiement, aucun secret modifié
- Aucune réactivation des anciennes promesses Gold/PvP/XP
- Aucun produit déclaré commercialisable sans preuve
