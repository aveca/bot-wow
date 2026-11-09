# Verrous

Un scope `active` dont `expires` est dans le futur est pris. Ne pas le reprendre.

| id | scope | agent | branch | status | expires | result |
|---|---|---|---|---|---|---|
| 20261106-commercial-truth | agent-state,delivery-sandbox,api-route-map | cursor-cloud bc-aed68a08 | cursor/commercial-truth-agent-state-0086 | done | 2026-11-08T00:00:00Z | Sandbox PASS. Achat public laissé fermé. https://github.com/aveca/bot-wow/pull/129 |
| 20261106-api-head | api-head-readonly | cursor-cloud bc-aed68a08 | cursor/commercial-truth-agent-state-0086 | done | 2026-11-08T00:00:00Z | HEAD aligne sur GET pour /, /health et /api/config. Production déployée : version `054cd158-4be2-42f8-92a6-ff9c4f059079`, déploiement `6ca34fa3-198a-44b8-a6ed-300e7db37f99`, sondes 14:48:30Z conformes. https://github.com/aveca/bot-wow/pull/129 |
| 20261107-legal-draft | legal-draft | cursor-cloud bc-aed68a08 | cursor/legal-draft-0086 | active | 2026-11-10T00:00:00Z | Textes juridiques brouillon, champs A COMPLETER. Ne pas éditer `legal/` ailleurs. |
| 20261107-r2-provenance | r2-provenance | aveca | p0/runtime-integration-20261106 | active | 2026-11-10T00:00:00Z | PR #124. Hash live revérifié `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f`. Pas de seconde PR. |
| 20261107-mollie-prep | mollie-profile-prep | cursor-cloud bc-aed68a08 | fix/p0.35-mollie-profileid-current-main-20261105 | active | 2026-11-10T00:00:00Z | PR #90 reste brouillon. Aucun profileId dans git. |
| 20261107-checkout-flag | checkout-flag-draft | cursor-cloud bc-aed68a08 | cursor/checkout-reopen-flag-0086 | active | 2026-11-10T00:00:00Z | PR brouillon, non fusionnée. Le checkout public reste fermé. |
| 20261107-offer-diagnostic | commercial-offer | aveca | p0/commercial-offer-feasibility-20261107 | done | 2026-11-10T00:00:00Z | PR #135 fermée comme non retenue après décision propriétaire : pas de pivot compagnon externe ; conserver le BOT-WOW complet comme cible, commercialisation bloquée jusqu'aux preuves de conformité et de livraison. |
| 20261107-homepage-copy | homepage-archive-copy | aveca | fix/homepage-archive-copy-20261107 | active | 2026-11-10T00:00:00Z | PR #133. Ne pas éditer la copie d'accueil. |

| 20261107-package-reproducibility | runtime-package-reproducibility | opencode botwow-pr118 | p0/reproducible-runtime-package-20261107 | active | 2026-11-10T00:00:00Z | Paquet reproductible au bit (`F8138F3C…`) + empreinte canonique du contenu. Scope distinct de `r2-provenance` (PR #124 fusionnée) : aucune écriture R2, aucun checkout ouvert. |
| 20261108-package-integrity | package-integrity | aveca/OpenCode | p0/reproducible-runtime-package-20261107 | done | 2026-11-08T00:00:00Z | PR #150 : symlinks refuses, digest fail-closed, provenance CLI confrontee au checkout reel ; tests negatifs ; CI verte sur e28626d. Aucune ecriture R2. |
| 20261107-storefront | storefront-product-sheet | aveca/OpenCode | p0/storefront-product-sheet-20261107 | done | 2026-11-08T00:00:00Z | Fiche produit #142 écrite, cablee, testee, QA navigateur faite ; PR #154 FUSIONNEE dans main c1cbb0ad22e483823e101e45ddc97e7204cd14bb (2026-11-08T10:51:25Z) ; preuve publiee sur #142 |
| 20261108-p0-payment-prep | p0-real-payment-test-prep | aveca/OpenCode | p0/storefront-product-sheet-20261107 + p0/reproducible-runtime-package-20261107 | active | 2026-11-12T00:00:00Z | Mission #144. PR #150 durcie (e28626d, CI verte) ; PR #154 divergent resolue (366a735, CI verte) ; checkout reste ferme. |
| 20261109-pixel-skin | storefront-pixel-skin | cursor-cloud | cursor/pixel-visual-redesign-0da7 | active | 2026-11-12T00:00:00Z | Redesign visuel. Checkout fermé. Pas d’avis inventé. |
