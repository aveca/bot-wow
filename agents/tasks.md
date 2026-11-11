# Tâches

| id | scope | status | preuve |
|---|---|---|---|
| 20261106-commercial-truth | agent-state, delivery-sandbox, api-route-map | done | https://github.com/aveca/bot-wow/pull/129 |
| owner-beta-reservation | réservation bêta Stripe 20 €, transparence et suivi des paiements | done | Décision propriétaire reçue 2026-11-11 : Payment Link Stripe LIVE actif pour une réservation unique, non livrable immédiatement, livraison manuelle après validation finale, remboursement intégral si impossible. PR #188 fusionnée et déployée. Ne pas demander à nouveau l'autorisation de réservation ; ne pas vendre de licence logicielle tant que les droits runtime restent bloquants. |
| pr-90-mollie-profileid | credential Mollie | open-elsewhere | PR brouillon #90, ne pas dupliquer |
| 20261106-api-head | api-head-readonly | done | https://github.com/aveca/bot-wow/pull/129 — en production, déploiement `6ca34fa3-198a-44b8-a6ed-300e7db37f99` |
| 20261107-legal-draft | legal-draft | active | champs A COMPLETER, achat toujours fermé |
| 20261107-r2-provenance | r2-provenance | active | PR #124, hash live revérifié |
| 20261107-mollie-prep | mollie-profile-prep | active | PR #90, profileId encore absent |
| 20261107-checkout-flag | checkout-flag-draft | active | brouillon seulement |

| 20261107-package-reproducibility | runtime-package-reproducibility | active | Paquet de distribution reproductible au bit (`F8138F3C…`, 1 344 366 o) + empreinte canonique du contenu ; écart R2 live chiffré (6 fichiers non commités, 2 exécutables hors manifeste) ; aucune écriture R2 |
| BOTWOW-P0-PACKAGE-INTEGRITY-PR150-20261108 | package-integrity | done | PR #150 durcie et rebasee sur main 158222e ; CI verte sur e28626d ; preuve sur #151 |
| BOTWOW-PIXELBUDDY-STYLE-STOREFRONT-READINESS-20261107 | storefront-product-sheet | done | Fiche produit PixelBuddy-style EN+FR, registre de modules parite, provenance publiee, pas de checkout ; PR #154 fusionnee dans main c1cbb0a (2026-11-08T10:51:25Z) ; preuve sur #142 |
| BOTWOW-P0-REAL-PAYMENT-TEST-PREP-20261107 | p0-real-payment-test-prep | in-progress | Mission #144 : ACK started publie, produits/licence verifies, PR #150 durcie, PR #154 rebase + empreintes, Mollie non re-verifiable (rapporte) |
| BOTWOW-P0-PACKAGE-INTEGRITY-PR150-20261108 | package-integrity | done | 3 defauts corriges dans la PR #150 (symlinks, digest fail-closed, provenance CLI) + tests negatifs ; CI verte sur e28626d ; https://github.com/aveca/bot-wow/issues/151#issuecomment-6720399057 |
| 20261109-pixel-skin | storefront-pixel-skin | done | https://github.com/aveca/bot-wow/pull/172 commit 2900e3004e02235266eff39207498ddf3b801f67 |
| 20261110-purchase-intent-telemetry | purchase-intent-telemetry | done | PR #176 : `nav-buy` remplacé par `nav-status` sur les accueils EN/FR ; `cta_click` conservé, plus de faux `checkout_requested` ; test du vrai Analytics + HTML EN/FR ajouté |
| 20261111-package-merge-resolution | runtime-package-merge,delivery-coverage | done | `main` = `0774272320a0f811d7cba56cd8def120497d7f6d`. #179 `aa02ad3` (00:39:36Z) → #185 `4a3b657` (00:51:39Z) → #186 `0774272` (01:05:37Z) fusionnées en squash. #182 fermée sans fusion, couverture restituée sur branche neuve depuis `main`. Nouveau paquet réel byte-identique ×2 `7d48c2496c83bbdf12e2beac6aab42d5ba66b7fb3bb65725c746b1c10d89f335` (180 805 o). `--release` refusé : droits client non publiés. Rapport : reports/operations/2026-11-11-package-merge-and-delivery-restitution.md |
