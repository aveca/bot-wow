# BOT-WOW P0.13 — Post-Deployment Verification, Hero CTA

**Date :** 27 octobre 2026  
**Dépôt :** `C:\factory\worktrees\bot-wow-repo` → `aveca/bot-wow` (GitHub)  
**Branche de vérification :** `docs/p0.13-production-verification-report-2026-10-27`  
**Base :** `main` (`45b0c5c` — inclut PR #48 fusionnée)  
**PR documentaire :** #49 — `https://github.com/aveca/bot-wow/pull/49`  
**PR liée :** #48 — `https://github.com/aveca/bot-wow/pull/48` (FR hero CTA, fusionnée)  
**PR liée :** #46 — `https://github.com/aveca/bot-wow/pull/46` (EN hero CTA, fusionnée, déjà en production)

---

## 1. État de départ vérifié

### 1.1 Dépôt Git

| Élément | Valeur |
|---|---|
| Branche de départ | `main` |
| Commit HEAD | `45b0c5c ui(cro): hero primary CTA gold for purchase intent (#48)` |
| PR #48 (FR hero CTA) | Fusionnée dans `main` |
| PR #46 (EN hero CTA) | Déjà déployée en production |
| Remote | `origin` → `https://github.com/aveca/bot-wow.git` |
| Working tree | Propre |

### 1.2 PR #50 (documentation P0.12)

| Propriété | Valeur |
|---|---|
| Numéro | #50 |
| URL | `https://github.com/aveca/bot-wow/pull/50` |
| État | MERGED |
| Base | `main` |
| CI | `validate` pass · `ui-quality` pass · `GitGuardian` pass |
| Fusion | ✅ Effectuée durant cette mission |

---

## 2. Vérification en production (lecture seule)

### 2.1 Méthode

Tests effectués avec **Playwright + Chromium** (navigateur réel) contre les URL de production en direct :

| Viewport | Dimensions |
|---|---|
| Desktop | 1440 × 900 |
| Tablette | 768 × 1024 |
| Mobile | 375 × 812 |

| Langue | URL |
|---|---|
| Anglais | `https://bot-wow.com/` |
| Français | `https://bot-wow.com/fr/` |

Total : 6 combinaisons (2 langues × 3 viewports).

### 2.2 Contrôles effectués par page et viewport

| Contrôle | Critère de succès |
|---|---|
| `GET /` | HTTP 200 |
| `GET /fr/` | HTTP 200 |
| `[data-cta-id="hero-offer"]` existe exactement une fois | true |
| `href` = `#buy` | true |
| Libellé "See the offer" / "Voir l'offre" | true |
| Classe inclut `btn-gold` | true |
| Classe n'inclut pas `btn-ghost` | true |
| Clic sur le CTA navigue vers `#buy` | true |
| Formulaire `#buyForm` visible | true |
| Aucune erreur JavaScript console | 0 erreurs |
| Aucun débordement horizontal | scrollWidth ≤ clientWidth + 1 |

---

## 3. Résultats des tests

### 3.1 Anglais (`https://bot-wow.com/`)

| Viewport | HTTP | hero-offer | hero-demo | Click → #buy | Buy form | Erreurs |
|---|---|---|---|---|---|---|
| Desktop 1440×900 | 200 | **btn-gold** | btn-ghost | ✅ | ✅ | 0 |
| Tablette 768×1024 | 200 | **btn-gold** | btn-ghost | ✅ | ✅ | 0 |
| Mobile 375×812 | 200 | **btn-gold** | btn-ghost | ✅ | ✅ | 0 |

### 3.2 Français (`https://bot-wow.com/fr/`)

| Viewport | HTTP | hero-offer | hero-demo | Click → #buy | Buy form | Erreurs |
|---|---|---|---|---|---|---|
| Desktop 1440×900 | 200 | **btn-gold** | btn-ghost | ✅ | ✅ | 0 |
| Tablette 768×1024 | 200 | **btn-gold** | btn-ghost | ✅ | ✅ | 0 |
| Mobile 375×812 | 200 | **btn-gold** | btn-ghost | ✅ | ✅ | 0 |

### 3.3 Captures d'écran

Toutes les captures sont stockées dans `artifacts/ui/` :

| Viewport | Anglais | Français |
|---|---|---|
| Desktop | `desktop/home-en-desktop.png` | `desktop/home-fr-desktop.png` |
| Tablette | `tablet/home-en-tablet.png` | `tablet/home-fr-tablet.png` |
| Mobile | `mobile/home-en-mobile.png` | `mobile/home-fr-mobile.png` |

---

## 4. Analyse des résultats

### 4.1 PR #48 déployée en production

Le correctif PR #48 (passage de `btn-ghost` à `btn-gold` pour le CTA hero "Voir l'offre") est **déployé et vérifié en production** sur les deux langues :

- **EN** : `btn btn-gold btn-lg` (href `#buy`, label "See the offer")
- **FR** : `btn btn-gold btn-lg` (href `#buy`, label "Voir l'offre")

### 4.2 CTA démo resté secondaire

Le CTA "Try the browser demo" / "Essayer la démo navigateur" reste `btn-ghost` (secondaire) sur les deux langues, confirmant que seul le CTA d'achat a été mis en évidence.

### 4.3 Parcours d'achat fonctionnel

Le clic sur le CTA hero navigue correctement vers la section `#buy`, et le formulaire d'achat est accessible sur toutes les variantes (langue × viewport).

### 4.4 Aucune régression

- Aucun débordement horizontal sur aucune vue
- Aucune erreur JavaScript en console
- Aucune erreur de chargement de ressource
- Le formulaire d'achat reste accessible sur toutes les vues

---

## 5. Télémétrie

Le CTA "See the offer" / "Voir l'offre" utilise `data-cta-id="hero-offer"` et `data-track="cta_click"`. Le clic déclenche un événement de télémétrie de type `cta_click` avec l'identifiant `hero-offer`, qui est enregistré comme une **intention d'achat** (et non comme une conversion confirmée). La conversion réelle n'est comptabilisée que côté serveur, après vérification du webhook Mollie, et ne peut pas être déclenchée par un simple clic sur le CTA.

---

## 6. Verdict final

### **PASS**

Tous les contrôles de production sont passés sur les 6 combinaisons (2 langues × 3 viewports) :

| Critère | État |
|---|---|
| PR #48 déployée en production (EN + FR) | ✅ Confirmé |
| CTA hero "Voir l'offre" = `btn-gold` | ✅ Confirmé sur les 6 vues |
| CTA hero démo reste `btn-ghost` | ✅ Confirmé sur les 6 vues |
| Clic → #buy fonctionne | ✅ Confirmé sur les 6 vues |
| Formulaire d'achat accessible | ✅ Confirmé sur les 6 vues |
| Aucune erreur JS / réseau | ✅ Confirmé sur les 6 vues |
| Aucun débordement horizontal | ✅ Confirmé sur les 6 vues |
| Captures d'écran 3 viewports × 2 langues | ✅ Capturées |

---

## 7. Prochaine action prioritaire

**Fusionner la PR #48** (`ui/cro-french-hero-cta-20261027` vers `main`) — bien que le correctif soit déjà déployé en production via un autre canal, la PR doit être fusionnée pour aligner `main` sur l'état de production. Aucun déploiement supplémentaire n'est nécessaire car le code est déjà en ligne.

Nouveau prompt pour la suite :
```
# BOT-WOW — Fusionner PR #48 et PR #49

Fusionner les PR #48 (ui/cro-french-hero-cta-20261027) et #49 (docs/p0.11-production-verification-report-2026-10-27) vers main sur le dépôt aveca/bot-wow. Ne pas fusionner la PR #44.
```

---

**Rapport final :** `docs/reports/missions/BOT-WOW-P0.13-PRODUCTION-VERIFICATION-2026-10-27.md`

**Captures d'écran :** `artifacts/ui/{desktop,tablet,mobile}/home-{en,fr}-{viewport}.png`
