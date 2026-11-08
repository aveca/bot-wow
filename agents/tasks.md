# Tâches

| id | scope | status | preuve |
|---|---|---|---|
| 20261106-commercial-truth | agent-state, delivery-sandbox, api-route-map | done | https://github.com/aveca/bot-wow/pull/129 |
| owner-reopen-checkout | checkout public, prix, profil Mollie | blocked | Brouillon à flag seulement. Le checkout public et le prix ne changent pas. |
| pr-90-mollie-profileid | credential Mollie | open-elsewhere | PR brouillon #90, ne pas dupliquer |
| 20261106-api-head | api-head-readonly | done | https://github.com/aveca/bot-wow/pull/129 — en production, déploiement `6ca34fa3-198a-44b8-a6ed-300e7db37f99` |
| 20261107-legal-draft | legal-draft | active | champs A COMPLETER, achat toujours fermé |
| 20261107-r2-provenance | r2-provenance | active | PR #124, hash live revérifié |
| 20261107-mollie-prep | mollie-profile-prep | active | PR #90, profileId encore absent |
| 20261107-checkout-flag | checkout-flag-draft | active | brouillon seulement |
| BOTWOW-PIXELBUDDY-STYLE-STOREFRONT-READINESS-20261107 | storefront-product-sheet | done | Fiche produit PixelBuddy-style EN+FR, registre de modules parite, provenance publiee, pas de checkout ; PR #154, CI verte sur SHA 8fcf6c5 ; preuve sur #142 |
| BOTWOW-P0-REAL-PAYMENT-TEST-PREP-20261107 | p0-real-payment-test-prep | in-progress | Mission #144 : ACK started publie, produits/licence verifies, PR #150 durcie, PR #154 rebase + empreintes, Mollie non re-verifiable (rapporte) |
| BOTWOW-P0-PACKAGE-INTEGRITY-PR150-20261108 | package-integrity | done | 3 defauts corriges dans la PR #150 (symlinks, digest fail-closed, provenance CLI) + tests negatifs ; CI verte sur e28626d ; https://github.com/aveca/bot-wow/issues/151#issuecomment-6720399057 |
