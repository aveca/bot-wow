# BOT-WOW P0.11 — Post-Deployment Verification, Hero CTA

**Date :** 27 octobre 2026  
**Dépôt :** `C:\factory\worktrees\bot-wow-repo` → `aveca/bot-wow` (GitHub)  
**Branche de vérification :** `docs/p0.11-production-verification-report-2026-10-27`  
**PR documentaire :** #47 — `https://github.com/aveca/bot-wow/pull/47`  
**PR liée :** #46 — `https://github.com/aveca/bot-wow/pull/46` (EN hero CTA, merged)  
**PR liée :** #48 — `https://github.com/aveca/bot-wow/pull/48` (FR hero CTA, open)

---

## 1. Contexte et objectif

La mission P0.10 a corrigé le CTA hero "See the offer" / "Voir l'offre" en le passant de `btn-ghost` (secondaire) à `btn-gold` (primaire) sur `index.html` (anglais). La PR #46 a été fusionnée et déployée en production.

Cette mission P0.11 vérifie, dans un vrai navigateur contre la production (`https://bot-wow.com/`), que :
1. Le CTA hero principal est bien `btn-gold` et pointe vers `#buy`
2. Le CTA "Try the demo" / "Essayer la démo navigateur" reste `btn-ghost` (secondaire)
3. Le clic sur "See the offer" / "Voir l'offre" navigue vers la section d'achat
4. Le formulaire d'achat est accessible
5. Aucune erreur JavaScript, réseau, ou débordement horizontal
6. La version française (`fr/index.html`) a le même comportement

## 2. État Git vérifié

| Élément | Valeur |
|---|---|
| Dépôt | `aveca/bot-wow` |
| Branche de travail | `docs/p0.11-production-verification-report-2026-10-27` |
| Base | `main` (`7388988`) |
| HEAD distant | `7388988 ui(cro): hero primary CTA now gold for purchase intent (#46)` |
| Working tree | Propre |
| `git diff --check` | Propre |

Le commit déployé en production (`7388988`) contient le correctif EN (PR #46) mais PAS encore le correctif FR (PR #48, en attente de fusion).

---

## 3. Méthode de test

### 3.1 Outils

- **Playwright** avec Chromium (navigateur réel, pas d'émulation)
- **Viewports testés** :
  - Desktop : 1440 × 900
  - Tablette : 768 × 1024
  - Mobile : 375 × 812
- **Pages testées** :
  - `https://bot-wow.com/` (EN)
  - `https://bot-wow.com/fr/` (FR)
- **Total** : 6 combinaisons (2 langues × 3 viewports)

### 3.2 Contrôles effectués

Pour chaque combinaison langue × viewport :
1. `GET /` retourne HTTP 200
2. Le CTA "See the offer" / "Voir l'offre" est visible
3. Le CTA a la classe `btn-gold` (primaire) ou `btn-ghost` (secondaire)
4. Le CTA a `href="#buy"`
5. Le CTA démo reste `btn-ghost` (secondaire)
6. Cliquer sur "See the offer" navigue vers `#buy`
7. Le formulaire d'achat (`#buyForm`) est visible
8. Aucune erreur JavaScript (console)
9. Aucune erreur réseau
10. Aucun débordement horizontal (`scrollWidth ≤ clientWidth + 1`)
11. Capture d'écran plein écran sauvegardée

---

## 4. Résultats des tests

### 4.1 Anglais (`https://bot-wow.com/`)

| Viewport | HTTP | hero-offer | hero-demo | Click → #buy | Buy form | Erreurs |
|---|---|---|---|---|---|---|
| Desktop 1440×900 | 200 | **btn-gold** | btn-ghost | ✅ | ✅ | 0 |
| Tablette 768×1024 | 200 | **btn-gold** | btn-ghost | ✅ | ✅ | 0 |
| Mobile 375×812 | 200 | **btn-gold** | btn-ghost | ✅ | ✅ | 0 |

### 4.2 Français (`https://bot-wow.com/fr/`)

| Viewport | HTTP | hero-offer | hero-demo | Click → #buy | Buy form | Erreurs |
|---|---|---|---|---|---|---|
| Desktop 1440×900 | 200 | **btn-ghost** ❌ | btn-ghost | ✅ | ✅ | 0 |
| Tablette 768×1024 | 200 | **btn-ghost** ❌ | btn-ghost | ✅ | ✅ | 0 |
| Mobile 375×812 | 200 | **btn-ghost** ❌ | btn-ghost | ✅ | ✅ | 0 |

### 4.3 Captures d'écran

Les captures sont stockées dans `artifacts/ui/` :
- `desktop/home-en-desktop.png`, `desktop/home-fr-desktop.png`
- `tablet/home-en-tablet.png`, `tablet/home-fr-tablet.png`
- `mobile/home-en-mobile.png`, `mobile/home-fr-mobile.png`

---

## 5. Défaut trouvé

**Le CTA hero "Voir l'offre" (`hero-offer`) sur la version française (`fr/index.html`) reste en `btn-ghost` (secondaire) au lieu d'être `btn-gold` (primaire).**

### Cause racine

La PR #46 (EN hero CTA) a modifié uniquement `index.html` (version anglaise). Le fichier `fr/index.html` (version française) n'a pas été mis à jour, laissant le CTA français en `btn-ghost`.

### Conséquence

Les visiteurs francophones voient les deux CTAs hero avec le même poids visuel (ghost), réduisant la visibilité de l'action d'achat principale pour le marché francophone.

### Correctif

Le fichier `fr/index.html` a été modifié dans la branche `ui/cro-french-hero-cta-20261027` (PR #48) pour passer `hero-offer` de `btn-ghost` à `btn-gold`. La PR #48 est ouverte et attend examination.

---

## 6. Tests exécutés

| Commande | Résultat |
|---|---|
| `npm run validate` | PASS |
| `npm run test:gate` | PASS (35 vérifications) |
| `npm test` | 18/18 suites PASS |
| `npx playwright test` | 54/54 tests e2e PASS |
| Production verification (EN × 3 viewports) | 18/18 checks PASS |
| Production verification (FR × 3 viewports) | hero-offer = btn-ghost (défaut confirmé) |

### Tests négatifs de la garde de livraison (checkout)

Tous confirmés : `409 delivery_unverified` sur 6 scénarios (absent, pending, invalide, + 3 injections navigateur), **zéro appel Mollie**.

### Intégrité du montant Mollie

Le montant envoyé à Mollie est vérifié comme `20.00 EUR` (provenant de `PRICE_TABLE` dans `worker/index.js`), invariable même si le navigateur tente d'injecter un montant différent.

---

## 7. État de la production

| Contrôle | Résultat (lecture seule) |
|---|---|
| `GET https://bot-wow.com/health` | `200 {"status":"ok","version":"1.0.0"}` |
| `GET https://bot-wow.com/` (EN) | `200`, hero-offer = `btn-gold` |
| `GET https://bot-wow.com/fr/` (FR) | `200`, hero-offer = `btn-ghost` (défaut) |
| Déploiement dans cette mission | **Aucun** |
| Modification de prix/secrets/paiement | **Aucune** |

---

## 8. PR et commits

| PR | État | URL | SHA |
|---|---|---|---|
| #44 (checkout garde) | OPEN, MERGEABLE | `https://github.com/aveca/bot-wow/pull/44` | `9aa589f` |
| #45 (rapport P0.9 doc) | OPEN, MERGEABLE | `https://github.com/aveca/bot-wow/pull/45` | `fe3cf88` |
| #46 (EN hero CTA) | MERGED | `https://github.com/aveca/bot-wow/pull/46` | `7388988` (déployé) |
| #48 (FR hero CTA) | OPEN, MERGEABLE | `https://github.com/aveca/bot-wow/pull/48` | `dd3a58b` (en attente) |

---

## 9. Verdict

### **VERIFIED — DÉFAUT CONFIRMÉ SUR PRODUCTION FRANÇAISE**

La mission P0.11 a vérifié que :
- ✅ La correction EN (PR #46) est bien déployée en production : `hero-offer` est `btn-gold` sur `https://bot-wow.com/`
- ❌ La correction FR (PR #48) n'est pas encore déployée : `hero-offer` est `btn-ghost` sur `https://bot-wow.com/fr/`
- ✅ Tous les autres contrôles passent sur les deux langues (clic → #buy, formulaire accessible, pas d'erreurs, pas de débordement)

**Recommandation : fusionner la PR #48** pour appliquer le même correctif au français, alignant l'expérience utilisateur des deux langues.

### **Aucune fusion automatique** n'a été effectuée dans cette mission. La décision de fusion de la PR #48 reste au mainteneur.

---

## 10. Limites de vérification

| Limite | Détail |
|---|---|
| Parcours paiement réel | Aucun paiement Mollie réel n'a été effectué. La preuve porte sur le contrat de la requête (corps, montant, statuts), pas sur une transaction bout-en-bout. |
| Tests d'accessibilité clavier | Non exécutés dans cette mission (couvert par les tests e2e existants) |
| Mesures de conversion réelles | Aucune donnée commerciale n'a été collectée. L'impact sur le taux de conversion ne peut pas être quantifié sans données d'analytics réelles. |

---

**Rapport final :** `docs/reports/missions/BOT-WOW-P0.11-PRODUCTION-VERIFICATION-2026-10-27.md`

**Action humaine requise :** examiner et décider de la fusion de la PR #48 (FR hero CTA).
