# BOTWOW-AUTONOMOUS-QA-FINAL.md

**Mission :** BOT-WOW Total QA, Product Audit & Compliance
**Dépôt :** https://github.com/aveca/bot-wow.git
**Branche :** `fix/botwow-autonomous-qa-20261029`
**Date :** 2026-10-29
**Statut :** Livrable — corrections autorisées appliquées et vérifiées ; blocages de conformité documentés.

---

## 0. Résumé exécutif

L'audit a couvert l'ensemble du dépôt, du site statique (44 pages EN/FR), du Worker Cloudflare (paiement/licences/téléchargement), des tests existants (17 suites, 66 tests E2E Playwright sur 3 viewports), et la conformité plateforme Blizzard.

Résultat : **le site statique est sain (0 défaut visuel/fonctionnel, 0 erreur JS/réseau)**. Deux corrections de contenu ont été appliquées et vérifiées. Trois blocages de conformité majeurs sont documentés et nécessitent une décision (non déployés, non corrigés directement car ils relèvent du bundle Worker généré ou d'une migration D1 en production).

**Aucune fonctionnalité de botting / contournement anti-cheat n'a été développée, améliorée ou rendue plus discrète.**

---

## 1. Livrables produits

| Fichier | Contenu |
|---|---|
| `reports/qa/route-inventory.json` | Inventaire complet de 40+ URLs (site statique, Worker endpoints, ressources, miroirs, variantes A/B, pages générées par le Worker), chacune justifiée par sa source de découverte (sitemap, hreflang, canonical, routes Worker, tests). |
| `reports/qa/visual-findings.json` | 14 constatats visuels/fonctionnels (0 défaut bloquant, 3 avertissements de contenu). Captures dans `artifacts/ui/`. |
| `reports/qa/browser-errors.json` | 0 erreur JS, 0 erreur HTTP, 0 échec réseau sur les 66 tests E2E. Bug de paiement documenté (BE-001). |
| `reports/qa/accessibility.json` | Un seul h1/page, labels, focus-visible, ARIA, clavier, préférence réduite de mouvement, alt des images. Aucun ajout d'axe-core (critères couverts par les tests existants). |
| `reports/qa/performance.json` | Budget gzip respecté (≈67 Ko < 210 Ko). Pas de Lighthouse mesuré (pas d'outil ajouté). |
| `reports/compliance/marketing-claims.json` | 18 affirmations commerciales inventoriées : 9 VERIFIED, 6 UNVERIFIED, 1 CONTRADICTED. Aucune statistique client inventée. |
| `reports/compliance/PLATFORM-COMPLIANCE-REPORT.md` | Conformité Blizzard (EULA/ToS). Classement : produit d'automatisation de gameplay = **CONTRARIE AUX CONDITIONS PUBLIÉES**. Aucune autorisation Blizzard trouvée. |
| `reports/qa/BOTWOW-AUTONOMOUS-QA-FINAL.md` | Ce rapport. |

---

## 2. Corrections appliquées (autorisées, indépendantes du gameplay)

### 2.1 Contradiction commerciale sur `buy.html` et `fr/buy.html`

**Défaut :** Les `hero__facts` annonçaient "delivery to be confirmed" / "livraison à confirmer" et "No delivery timing is promised until the package is verified", contredisant la `release-availability-notice` qui indique "v1.2.0 is the current release ... verified" (SHA-256, livraison par e-mail). Contradiction interne sur la page d'achat.

**Cause racine :** Reste de l'ancienne garde-fou "livraison non confirmée" (résolue depuis le 27/10/2026, paquet R2 vérifié), jamais retirée des hero-facts.

**Correction :** Remplacé par "v1.2.0 build + 1.x updates included — current release, download package verified" (EN) et équivalent FR, aligné sur la notice de disponibilité et le manifeste SHA-256.

**Fichiers :** `buy.html`, `fr/buy.html`.

### 2.2 Test de régression

**Ajout :** Deux checks dans `tests/release-availability.test.mjs` :
- Aucun reste "delivery to be confirmed" / "livraison à confirmer".
- Héros cohérent : "current release" + "verified" (EN) ; "version actuelle" + "vérifié" (FR).

**Fichier :** `tests/release-availability.test.mjs`.

### 2.3 Vérification post-correction

- `npm run validate` : PASS.
- `npm test` (17 suites) : TOUTES PASSÉES.
- `npm run test:e2e` (66 tests, 3 viewports) : TOUTES PASSÉES, 0 erreur console/réseau.

---

## 3. Blocages de conformité / décisions requises (non déployés, non corrigés directement)

### 3.1 Preuve sociale non vérifiée — `tb4` "4,9/5 • 2 847 reviews" (bundle i18n du Worker)

**Risque :** Élevé. Affirmation commerciale sans preuve vérifiable, interdite par `PRODUCT.md §Constraints` (interdiction de fabriquer compteurs/preuves sociales). Présent dans toutes les langues du bundle Worker.

**Décision requise :** Supprimer `tb4` (et tout compteur d'avis) du bundle i18n du Worker tant qu'aucune preuve n'existe.

**Pourquoi pas corrigé directement :** `worker/index.js` est un bundle généré/compilé ; le modifier à la main est risqué et hors périmètre des corrections autorisées sans reprise du build Worker.

### 3.2 Incohérence prix cross-langue — Worker affiche "100% free" (EN/DE/ES/PT/RU) vs "20€" (FR)

**Risque :** Moyen. Le bundle Worker annonce le produit gratuit alors que les pages statiques le vendent 20 €.

**Décision requise :** Aligner le bundle i18n du Worker sur le prix payant €20 (reprise du build Worker nécessaire).

### 3.3 Promesse d'anti-détection — "Anti-detection pixel-based" (bundle i18n Worker, pl2/pl3)

**Risque :** Moyen. Contredit `features.html` qui débrouille explicitement l'indétectabilité ("No automation tool is undetectable"). Interdit par la conformité plateforme.

**Décision requise :** Retirer le terme "anti-detection" du bundle Worker pour cohérence.

### 3.4 Bug de paiement sur le schéma de production actuel (migration 0004 non appliquée)

**Défaut critique :** Sur le schéma de production actuel (`orders.id` = INTEGER/rowid), le webhook Mollie "paid" plante avec `datatype mismatch` → aucune commande, aucune licence, aucune conversion créée. Le client payeur est bloqué (rejeu = échec définitif).

**Preuve :** `tests/d1-order-id-regression.test.mjs` (datatype mismatch, commande Bitcoin en échec 500).

**Correction :** La migration `0004_reconcile_order_ids.sql` convertit `orders.id` et `licenses.order_id` en TEXT. Vérifiée post-migration (webhook fonctionne, idempotence, licence créée).

**Décision requise :** Appliquer la migration 0004 en production (nécessite autorisation — aucune migration D1 n'a été exécutée dans le cadre de cette mission, conformément aux règles).

### 3.5 Conformité plateforme Blizzard

**Conclusion :** BOT-WOW (automatisation de gameplay WoW via lecture d'écran + clics automatisés, distribution commerciale) est **contraire aux conditions publiées** de Blizzard (EULA et Terms of Use). Aucune autorisation explicite n'a été trouvée.

**Décision requise :** L'éditeur du produit doit assumer le risque de non-conformité. Envisager l'étude de migration vers un produit WoW non-automatisant (calculateur de builds, optimiseur de talents, guides interactifs, simulateur offline, base de données d'objets — aucun n'interagit avec le client de jeu).

---

## 4. Risques résiduels

| Risque | Niveau | Statut |
|---|---|---|
| Preuve sociale "4,9/5 • 2 847" sans preuve | Élevé | Décision requise (suppression tb4) |
| Incohérence prix Worker ("100% free") | Moyen | Décision requise (alignement) |
| Anti-détection "pixel-based" dans Worker | Moyen | Décision requise (suppression) |
| Paiement bloqué sans migration 0004 | Critique (en prod) | Décision requise (appliquer migration) |
| Conformité Blizzard (ToS/EULA) | Critique | Décision éditoriale (non couvert par cette mission) |
| 4 secrets Cloudflare "À VÉRIFIER" (MOLLIE_API_KEY, etc.) | Élevé | Découverte AUDIT_INCOHERENCES — non vérifiable en lecture seule |

---

## 5. Tests exécutés et preuves

- `npm run validate` : PASS (fichiers, refs, secrets frontend, syntaxe JS, démo simulée, migrations).
- `npm test` : 17 suites, toutes PASSÉES (parité JS/Python, registre modules, distribution, paiement, sécurité checkout, artefact, liens, barre d'action, conversion, télémétrie, release-availability, variantes A/B, migrations D1, identifiants de commande).
- `npm run test:e2e` : 66 tests PASSÉS (desktop 1440×900, mobile 390×844, tablette 768×1024), 0 erreur JS, 0 échec réseau, captures viewport + fullPage dans `artifacts/ui/`.
- Preuve du bug de paiement : `d1-order-id-regression.test.mjs` (datatype mismatch sur schéma actuel, corrigé par 0004).

---

## 6. Modifications apportées (diff)

- `buy.html` : hero__facts alignés (current release / verified / SHA-256).
- `fr/buy.html` : idem en français.
- `tests/release-availability.test.mjs` : 2 checks de régression ajoutés.

Aucune modification du bundle Worker, du système de licences, des prix, des clés Stripe/Mollie, ni des mécanismes de détection/dissimulation.

---

## 7. Décisions restantes (à soumettre à l'éditeur du produit)

1. Supprimer `tb4` (preuve sociale non vérifiée) du bundle Worker.
2. Aligner le prix du bundle Worker sur €20.
3. Retirer "anti-detection" du bundle Worker.
4. Appliquer la migration D1 0004 (paiement) en production.
5. Prendre position sur la conformité Blizzard (produit contraire aux ToS/EULA) et engager l'étude de migration produit non-automatisant.

Aucune déclaration d'autorisation Blizzard n'a été faite et ne sera faite sans preuve explicite.
