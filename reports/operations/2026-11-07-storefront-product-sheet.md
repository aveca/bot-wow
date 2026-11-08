# Rapport de cycle — Fiche produit PixelBuddy-style (#142)

**Date :** 2026-11-08  
**Dépôt :** `aveca/bot-wow`  
**Branche :** `p0/storefront-product-sheet-20261107` (base `origin/main` @ `9a01a5098b8025cf6b1ca338f426033224459c99`)  
**task_id :** `BOTWOW-PIXELBUDDY-STYLE-STOREFRONT-READINESS-20261107`  
**Issue :** #142  
**Statut :** PR ouverte, non mergée, CI en attente de publication  

---

## 1. Objectif du cycle

Implémenter la mission #142 (storefront de type PixelBuddy) sur une branche dédiée à partir de `origin/main`, avec :
- une paire de pages `product.html` (EN) + `fr/product.html` (FR) réutilisant les classes CSS existantes (aucun changement d'asset, estampille `?v=560cff9a` conservée),
- le câblage du site (sitemap, build, validate, pages d'entrée),
- un test de garde-fou `tests/storefront-product-sheet.test.mjs` câblé dans `npm test`,
- une QA navigateur before/after (1440×900 + 390×844),
- le commit, le push, l'ouverture d'une PR (sans merge), la vérification du CI vert sur le SHA exact,
- un commentaire de preuve sur l'issue #142 avec le task_id exact.

Le checkout reste fermé : aucun paiement, aucun Mollie, aucun e-mail, aucune mutation de production.

---

## 2. Livrables du cycle

### 2.1 Pages écrites

| Fichier | Langue | Rôle |
|---|---|---|
| `product.html` | EN | Fiche produit Fishing Assistant 1.2.0 |
| `fr/product.html` | FR | Fiche produit Assistant de pêche 1.2.0 |

Respect des règles de conception `botwow-product-design` :
- identité "instrumentation de pêche / console de navire" conservée (pas de dérive kit SaaS),
- pas de fausses notes/avis, pas de badge "trusted by X", pas de prétention d'indétectabilité ni d'anti-ban,
- pas de présentation de la pêche comme le produit complet ("one product, eight modules"),
- wording FR avec les chaînes de garde exactes (apostrophes droites) : notice serveurs privés et non-affiliation Blizzard.

Contenu de chaque page :
- **Topbar** : v1.2.0 · not for sale / non commercialisé ; checkout fermé ; aucun téléchargement ; source `aveca/Casinobabe @ 257418c`.
- **Hero** : produit, mécanisme mesuré (PrintWindow, clics par messages de fenêtre, addon observe uniquement), deux CTA "Module ledger" / "Build audit", trust strip, prix 20,00 € présenté comme cible historique uniquement.
- **What it is** : note d'honnêteté serveurs privés / non-affiliation Blizzard ; 3 features (lecture pixels, détection flotteur, mémoire des spots + planificateur).
- **Module ledger** : 8 modules reproduits depuis `assets/modules.json` avec `data-module-id` / `data-module-status` ; chaque module porte un pilier rouge "non distribué" / "absent d'une release client" ; bandeaux de statut (Available / In development / Planned) issus du registre.
- **Package and requirements** : prérequis et contenu du paquet (réproduits depuis `INSTALL.md`), rien n'est distribué.
- **Build audit** : table source / commit / branche / SHA-256 du paquet reproductible `F8138F3C52EB2498114AD5BCD3988DB39A105BD4B757646BF1C2B7548DA79781` / taille et entrées / empreinte canonique `f69be8b34f74b2df68a177e0210b9bd73f6c99452c9279c291f2961173c90a53` / artefact de livraison configuré `1C132F36…` non reproductible / delta (20 identiques, 6 différents, 3 hors manifeste) / droits de redistribution non documentés.
- **Why it is not for sale yet** : 5 conditions ouvertes, pas de formulaire, pas d'e-mail, pas de paiement.
- **Questions** : FAQ (download, lecture personnage/mémoire, disponible ou pas, prix affiché, versions serveur).
- **Footer** : produit, docs & support, disclaimer Blizzard, barre mobile "Purchase status" / "Statut de disponibilité" avec CTA vers `./buy.html`.

### 2.2 Câblage du site

- `sitemap.xml` : entrées `https://bot-wow.com/product.html` et `https://bot-wow.com/fr/product.html` avec variantes de langue croisées.
- `scripts/build-site.mjs` : `FILES` += `'product.html'` (la variante FR est publiée via le répertoire `fr` déjà listé dans `DIRS`).
- `scripts/validate.mjs` : `PUBLIC_PAGES` += `"product.html"` et `"fr/product.html"`.
- Liens d'entrée : `buy.html`, `fr/buy.html`, `features.html`, `fr/features.html` (corps + liste footer) pointent vers `./product.html` ; le lien de statut d'achat `href="./buy.html"` reste présent ; pas d'ancres `#offre`/`#buy`.

### 2.3 Garde-fou de test

`tests/storefront-product-sheet.test.mjs` — 10 groupes de vérifications sur le code source (pas sur R2 ni navigateur) :

1. parité structurelle EN / FR (mêmes sections, même ordre, même langue déclarée),
2. parité du registre : chaque module de `assets/modules.json` porte le bon `data-module-status`, le bon titre et le bon résumé dans les deux langues ; aucun module inventé, aucun oublié, ordre respecté,
3. réserve commerciale : chaque module affiche un pilier rouge "non distribué" ; la page déclare qu'aucun module n'est distribué aux clients,
4. réserve clients, pilotée par `assets/compat.json` : Classic Era n'a ni serveur ni date de test (`historical_unverified`), aucune autre version n'est présentée comme confirmée,
5. honnêteté commerciale : aucun `undetectable`/`anti-ban`/Retail, aucune garantie/urgence, aucun faux avis, aucun compteur d'utilisateurs, aucun moyen de paiement (Mollie/Bitcoin/PayPal), lecture mémoire + injection explicitement refusées,
6. licence + provenance : dépôt, commit, SHA-256 reproductible, empreinte canonique, artefact de livraison configuré (non reproductible), manque de droits de redistribution déclarés ; aucune licence inventée,
7. paiement fermé : aucun formulaire, aucun POST, aucun champ e-mail, statut "aucun paiement" explicite, prix 20,00 € cible historique,
8. câblage : `sitemap.xml`, `build-site.mjs`, `validate.mjs`, pages d'entrée pointent vers la fiche ; pas d'ancres commerciales mortes,
9. liens et ancres internes de la fiche : aucun lien mort,
10. accessibilité de base + instrumentation des CTA (événement `cta_click`, identifiants `[a-z0-9-]+`, aucune donnée personnelle, pas de domaine tiers).

Câblé dans `package.json` (`test` chain += `tests/storefront-product-sheet.test.mjs`, script `test:storefront` ajouté).

### 2.4 Résultats des tests (exécution locale réelle, 2026-11-08)

| Commande | Résultat |
|---|---|
| `node tests/storefront-product-sheet.test.mjs` | exit 0, `FICHE PRODUIT : OK` |
| `npm test` (suite complète incluse) | exit 0, toutes les suites vertes (liens, conversion, release-availability, artefact, agent-state-locks inclus) |
| `npm run validate` | exit 0, `BOT-WOW validation PASS` |
| `git diff --check` | exit 0 |
| `CHECK_OPEN_PR_LOCKS=1 node scripts/check-agent-state.mjs` | `AGENT STATE : OK`, exit 0 |

---

## 3. QA navigateur (before/after)

Serveurs locaux Python (`http.server`) :
- **before** (origin/main @ `9a01a50`) : `127.0.0.1:8812`
- **after** (branche `p0/storefront-product-sheet-20261107`) : `127.0.0.1:8811`

Captures plein écran stockées dans `artifacts/ui/` (préfixe `storefront-`) :
- `storefront-after-product-en-desktop.png` / `storefront-after-product-fr-desktop.png` (1440×900),
- `storefront-after-product-en-mobile.png` / `storefront-after-product-fr-mobile.png` (390×844),
- sections détaillées desktop : hero, what-it-is, modules, package, audit, availability, questions,
- mobile : 16 fenêtres de défilement (`product-en-mobile-s01…s16`),
- before/after sur `buy.html` et `features.html` (EN + FR) pour la régression.

Constat :
- **pas de débordement horizontal** sur aucune page (document scroll width = viewport width),
- **pas de cible tactile < 44 px introduite** (les petites cibles pré-existantes : liens langue EN/FR 31px, footer 17px, identiques avant/après),
- **contraste WCAG OK** sur tous les éléments introduits (rapports 5.18 à 16.97, seuil AA 4.5:1 pour le texte normal, 3:1 pour le large),
- `prefers-reduced-motion: reduce` respecté (durées de transition/animation réduites à ~0),
- seule erreur console : `POST /api/track` → 501 (Unsupported method), **pré-existante** au serveur Python de développement (analytics `sendBeacon`/fetch), identique avant et après ; pas d'erreur JavaScript,
- pas de lien ni d'ancre interne mort sur les nouvelles pages.

Captures disponibles dans `artifacts/ui/` (non versionnées, régénérables à la demande ; voir `.gitignore`).

---

## 4. Mise à jour de l'état partagé (agents/)

| Fichier | Modification |
|---|---|
| `agents/locks.md` | Verrou `20261107-storefront` / scope `storefront-product-sheet`, actif, expirant 2026-11-10T00:00:00Z |
| `agents/tasks.md` | Tâche `BOTWOW-PIXELBUDDY-STYLE-STOREFRONT-READINESS-20261107` / scope `storefront-product-sheet`, ouverte |
| `agents/test-results.md` | Lignes `storefront-product-sheet.test.mjs`, `npm test`, `npm run validate`, `git diff --check`, `check-agent-state` |
| `agents/decisions.md` | Décisions 2026-11-08 : fiche produit (pas de checkout, pas de Mollie/Bitcoin, pas d'anti-ban, prix cible uniquement), aucun changement CSS/asset, estampille d'assets conservée |
| `PROJECT_STATE.md` | Nouvelle section "Fiche produit — cycle #142 (2026-11-08)", ligne dans le tableau "Qui travaille sur quoi", prochaine action de cycle |
| `reports/operations/BOT-WOW-CURRENT-STATE.md` | Nouvelle section `# 2026-11-08 — Fiche produit PixelBuddy-style (#142)`, bloqueurs inchangés, prochaine action mise à jour |

Aucun verrou supprimé, expiré artificiellement ni réattribué.

---

## 5. Preuves de provenance (runtime, réutilisées du cycle #130/PR #150)

Ces hashes sont publiés sur la fiche produit et ne sont **pas** nouveaux dans ce cycle :

- Paquet reproductible (build déterministe, 4 builds identiques) : SHA-256 `F8138F3C52EB2498114AD5BCD3988DB39A105BD4B757646BF1C2B7548DA79781`, 1 344 366 octets, 17 entrées ZIP, 16 entrées de manifeste.
- Empreinte canonique du contenu (identité de l'arborescence, indépendante du conteneur ZIP) : `f69be8b34f74b2df68a177e0210b9bd73f6c99452c9279c291f2961173c90a53`.
- Artefact de livraison configuré (non reproductible) : `1C132F367607EA186FEFFDE8BBDA0A1A9F94CDEC4B7850B93C57C271270BBA4F`, 1 387 543 octets, 30 entrées ; 20 fichiers identiques à `257418c`, 6 différents, 3 livrés hors manifeste (`Lancer-Casinobabe-Fishing-Assistant.bat`, `restaurer_previous.ps1`, `VERSION`).
- Source : `aveca/Casinobabe @ 257418c9a0c2c489a01226e8065ac9c8eaded954`, branche `feat/fishing-route-intelligence-v2`, commit 2026-10-22.

Blocage restant (`B-licence`) : aucun `LICENSE`/`COPYING`/`NOTICE` dans le dépôt source (`license: null` via API GitHub) → les droits de redistribution ne sont pas documentés ; la fiche produit le déclare explicitement. Décision propriétaire requise avant toute vente.

---

## 6. Ce qui n'a PAS été fait (garde-fous)

- Aucun merge, aucun déploiement, aucun `workflow_dispatch`.
- Aucun checkout, paiement, Mollie, prix, Worker, Pages, secret, binding, D1, R2, webhook, e-mail ni mutation de production.
- Le checkout public reste fermé : pas de formulaire, pas de paiement, pas d'e-mail.
- `aveca/sargagame` lu en lecture seule, non modifié.
- PR #148 (docs restart) et PR #150 (runtime) restent ouvertes, non mergées, CI verte sur leur SHA exact.

---

## 7. Prochaine action (une seule)

1. Committer les modifications (voir §8) sur `p0/storefront-product-sheet-20261107`.
2. Pousser la branche sur `origin`.
3. Ouvrir la PR sur `aveca/bot-wow` (sans merger).
4. Vérifier que le CI est vert sur le SHA exact de la PR (Validate, UI quality, GitGuardian).
5. Publier un commentaire de preuve sur l'issue #142 avec le task_id exact `BOTWOW-PIXELBUDDY-STYLE-STOREFRONT-READINESS-20261107` et le lien de la PR.
6. Marquer le verrou `20261107-storefront` comme `done` avec le lien du commit/PR.
7. Puis finaliser le runbook Mollie (#139) ; le checkout reste fermé jusqu'aux preuves de licence + livraison.

---

## 8. Fichiers modifiés / créés (ce cycle)

Modifiés :
- `product.html` (nouveau, EN)
- `fr/product.html` (nouveau, FR)
- `sitemap.xml` (entrées EN/FR `product.html`)
- `scripts/build-site.mjs` (`FILES` += `product.html`)
- `scripts/validate.mjs` (`PUBLIC_PAGES` += `product.html`, `fr/product.html`)
- `buy.html` (lien fiche produit + section product-sheet)
- `fr/buy.html` (id. FR)
- `features.html` (lien fiche produit)
- `fr/features.html` (id. FR)
- `package.json` (`test` chain += storefront test, script `test:storefront`)
- `agents/locks.md`, `agents/tasks.md`, `agents/test-results.md`, `agents/decisions.md`
- `PROJECT_STATE.md`
- `reports/operations/BOT-WOW-CURRENT-STATE.md`

Créés :
- `tests/storefront-product-sheet.test.mjs`
- `reports/operations/2026-11-07-storefront-product-sheet.md` (ce rapport)

Captures QA (non versionnées) :
- `artifacts/ui/storefront-*.png` (before/after, 1440×900 et 390×844)
- `artifacts/ui/storefront-qa-report.json`

---

## 9. Conclusion

La fiche produit PixelBuddy-style (#142) est écrite, câblée, testée et QA'd. Elle respecte l'honnêteté commerciale (pas de vente, pas de checkout, pas de Mollie/Bitcoin, pas d'anti-ban), la parité EN/FR, la parité avec le registre `assets/modules.json`, et publie la provenance du runtime (reproductible + artefact de livraison non reproductible + licence non documentée). Toute la suite de tests et la validation passent en local. Il reste à committer, pousser, ouvrir la PR, vérifier le CI vert sur le SHA exact, et publier le commentaire de preuve sur l'issue #142.
