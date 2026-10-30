# BOT-WOW — État courant Factory V3 (2026-10-30)

**Dépôt :** https://github.com/aveca/bot-wow  
**Branche de travail :** `fix/botwow-p05-compliance-pivot` (basée sur `origin/main`)  
**SHA HEAD de `origin/main` :** `2edd74b` (après `git fetch origin --prune`)  
**SHA de la branche P0.5 :** `e86c5a9` (merge de la branche QA précédente non appliqué ; branche propre recréee depuis main)  
**PR #54 :** **MERGED** sur main (dans `7d6cc4e` → `2edd74b`)  
**Dernière mise à jour de ce document :** 2026-10-30 (mission P0.5)

---

## 1. État des vérifications (directement observées)

| Élément | Valeur | Preuve |
|---------|--------|--------|
| SHA de `origin/main` | `2edd74b` | `git fetch origin --prune`, `git log origin/main -1` |
| PR #54 | MERGED | Dans l'historique de main (`7d6cc4e` → `2edd74b`) |
| `node scripts/validate.mjs` | PASS | Exécuté localement sur la branche P0.5 |
| `node tests/release-availability.test.mjs` | OK | Garde-fou présent sur buy.html et fr/buy.html (contradiction hero__facts corrigée) |
| `node tests/payment-flow.test.mjs` | OK | Y compris le test 13 (vente suspendue → 409, aucun paiement Mollie) |
| `node tests/checkout-security.test.mjs` | OK | Rate limit, locale, fuites, entrées invalides |
| `node tests/link-check.test.mjs` | OK | 44 pages, aucun lien mort, aucune ancre morte |
| `npm test` (suite complète) | Toutes les suites OK sauf `conversion-path` (stamp mismatch préexistant sur main, sans lien avec P0.5) | 17 suites |
| Captures Playwright E2E | 66 tests passés (branche QA précédente) | `artifacts/ui/` (non versionnés, .gitignore) |

---

## 2. Corrections apportées dans la mission P0.5 (branche `fix/botwow-p05-compliance-pivot`)

### P0 — Sécuriser le parcours de paiement

| Fichier | Modification |
|---------|--------------|
| `worker/index.js` | Ajout d'un garde-fou serveur `isSalesOpen2(env2)` : le checkout refuse toute nouvelle commande quand `RELEASE_STATUS` n'est pas explicitement `"open"` (fail-closed par défaut). Réponse 409 `sales_suspended`, aucun appel Mollie, aucune commande/licence créée, aucune donnée personnelle journalisée (IP uniquement). |
| `tests/payment-flow.test.mjs` | `RELEASE_STATUS: 'open'` ajouté aux env de test (mode vente ouverte). Ajout du test 13 : vente suspendue (pas de `RELEASE_STATUS`) refuse le checkout en 409, aucun paiement Mollie, aucune commande, aucune licence. |
| `tests/checkout-security.test.mjs` | `RELEASE_STATUS: 'open'` ajouté aux env de test. |

**Résultat :** le checkout est bloqué côté serveur (fail-closed), ne dépend plus uniquement du bouton HTML, et ne crée aucun paiement lorsque la vente est suspendue. Aucun paiement réel n'a été effectué.

### P1 — Assainir les affirmations marketing

| Fichier | Modification |
|---------|--------------|
| `worker/index.js` (bundle i18n) | Suppression de `tb4` ("4,9/5 · 2 847 reviews", preuve sociale non prouvée) dans les 6 langues. Suppression de `pml2`/`pl3` ("Anti-detection pixel-based", promesse d'indétectabilité) dans les 6 langues. Suppression de toutes les lignes "100% free/kostenlos/gratis" (40 lignes) et remplacement des affirmations "completely free"/"FREE"/"Get free" par des équivalents payants (5 langues, FR déjà correct). Correction du dictionnaire minimal (`getMinimalDict`). Nom de fichier de téléchargement : suppression du repli `Casinobabe-v1.0.38.zip`, le paquet livré est `casinobabe-fishing-1.2.0.zip`. |
| `buy.html` / `fr/buy.html` | Correction de la contradiction commerciale : les `hero__facts` annonçaient encore "delivery to be confirmed" / "livraison à confirmer" alors que la `release-availability-notice` indique "current release / version actuelle, paquet vérifié". Alignés sur "current release / version actuelle, paquet vérifié, SHA-256". Nettoyage des restes "ne pouvons pas confirmer" / "livraison à confirmer" (notice, checkout-blocked, bouton, mbar). |
| `tests/release-availability.test.mjs` | Mise à jour des checks : plus de "v1.2.0 non présenté comme confirmé" ni "do not purchase" ; nouveaux checks "aucun reste 'delivery to be confirmed' / 'livraison à confirmer'" et "héros cohérent 'version actuelle vérifiée'". |
| `reports/compliance/marketing-claims.json` | 21 affirmations commerciales inventoriées : 13 VERIFIED, 7 UNVERIFIED, 1 CONTRADICTED (compatibilité Retail/SoD annoncée mais seul Classic 1.13 testé). Aucun chiffre client inventé. |

### P1 — Conformité de la plateforme

| Fichier | Contenu |
|---------|---------|
| `reports/compliance/PLATFORM-COMPLIANCE-REPORT.md` | Analyse des ToS/EULA Blizzard (consultées en lecture seule, pas de reverse engineering). Classement : l'automatisation de gameplay de BOT-WOW (lecture d'écran + clics automatisés + addon en jeu + distribution commerciale) est **CONTRARIE AUX CONDITIONS PUBLIÉES**. Aucune autorisation Blizzard trouvée. La distinction pixel-based vs mémoire n'a aucun effet sur la licéité. |

### P2 — Proposition de pivot non-automatisant

| Fichier | Contenu |
|---------|---------|
| `reports/compliance/PIVOT_NON_AUTOMATISANT.md` | Proposition de repositionnement BOT-WOW sans automatisation du gameplay : planificateur de routes (saisie manuelle), carnet de spots, simulateur hors ligne, guides statiques. Périmètre, valeur commerciale, pages nécessaires, architecture technique, garde-fous, plan de migration. Aucun mécanisme de lecture d'écran, de clic automatisé, d'addon de contrôle. |

### Rapports QA (mission autonome 2026-10-29, réintégrés)

| Fichier | Contenu |
|---------|---------|
| `reports/qa/route-inventory.json` | Inventaire de 40+ URLs (site statique EN/FR, Worker endpoints, ressources, variantes A/B, pages générées par le Worker) |
| `reports/qa/visual-findings.json` | 14 constatats visuels/fonctionnels (0 défaut bloquant, 3 avertissements de contenu) |
| `reports/qa/browser-errors.json` | 0 erreur JS/réseau sur 66 tests E2E ; bug de paiement documenté (migration 0004, datatype mismatch sur schéma production actuel) |
| `reports/qa/accessibility.json` | h1 unique, labels, focus-visible, ARIA, clavier, préférence réduite de mouvement, alt des images |
| `reports/qa/performance.json` | Budget gzip respecté (≈ 67 Ko < 210 Ko) |
| `reports/qa/BOTWOW-AUTONOMOUS-QA-FINAL.md` | Rapport final de la mission autonome |

---

## 3. Archive v1.2.0 — État vérifié (P0.7, inchangé)

| Élément | Valeur | Statut |
|---------|--------|--------|
| Objet R2 | `botwow-binaries/casinobabe-fishing-1.2.0.zip` | ✅ Présent, SHA-256 `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f`, 1 387 543 octets |
| MANIFEST.json | 15 fichiers avec SHA-256 individuels | ✅ Présent localement |

**État R2 :** `PRESENT_VERIFIED`. La présence de l'objet ne prouve pas à elle seule le fulfillment Mollie complet.

---

## 4. Secrets Cloudflare — Inventaire sans exposition

Les noms de binding suivants sont présents comme `secret_text` (valeurs non lues, non exposées) :
`MOLLIE_API_KEY`, `RESEND_API_KEY`, `MOLLIE_WEBHOOK_SECRET`, `ADMIN_JWT_SECRET`, `ADMIN_EMAIL`, `CONTACT_EMAIL`, `LICENSE_SECRET`, `EXPORT_TOKEN`, `ADMIN_PASSWORD_HASH`, `RELEASE_STATUS`, `MOLLIE_PROFILE_ID`.

**Aucune modification de secret n'a été effectuée.** Aucune valeur de secret n'a été affichée ni journalisée.

---

## 5. Garde-fou commercial — État

Le checkout est **bloqué côté serveur** (`RELEASE_STATUS` != `"open"` → 409 `sales_suspended`, aucun appel Mollie) ET le bouton HTML est désactivé (PR #54) sur toutes les pages de vente.

**Aucune ouverture commerciale n'a été effectuée.** L'ouverture commerciale reste une décision distincte nécessitant autorisation explicite. Aucun déploiement de production n'a été effectué dans le cadre de cette mission.

---

## 6. Mémoire persistante obligatoire (AGENTS.md)

- `docs/operations/FACTORY-RELEASE-STATE.md` : mémoire opérationnelle (ci-dessous / à mettre à jour).
- Après chaque mission, ce document doit être publié sur GitHub (pas seulement sur disque local).

---

## 7. Blocages restants et prochaines actions

| Blocage | Raison | Action requise |
|---------|--------|----------------|
| Aucun déploiement de production | Pas d'autorisation explicite pour `wrangler deploy` ni pour mutation de production | Autorisation requise avant tout déploiement |
| Aucune ouverture commerciale | Décision distincte, nécessite autorisation séparée | Pas d'action automatique |
| Secrets `MOLLIE_API_KEY`, `RESEND_API_KEY`, etc. | Présence confirmée via `wrangler secret list`, mais pas de déploiement Worker effectué | Ne pas modifier sans preuve et autorisation |
| Conformité Blizzard | Produit d'automatisation de gameplay contraire aux ToS/EULA, aucune autorisation trouvée | Ne jamais déclarer le produit autorisé ; décider du sort de l'ancien produit (maintenu/suspendu/retiré) |
| Migration D1 0004 | Non appliquée en production (corrige le bug de paiement datatype mismatch) | Appliquer uniquement avec autorisation et après vérification des doublons |

**Prochaine action directement exécutable (sans autorisation) :** committer et pousser la branche `fix/botwow-p05-compliance-pivot`, ouvrir une PR ciblée, publier ce document et les rapports sur GitHub.

**Après autorisation humaine explicite :** merger la PR, déployer le Worker (avec rollback vérifiable), puis (décision séparée) lever le garde-fou commercial.
