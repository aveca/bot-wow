# Décisions

| date | décision | statut |
|---|---|---|
| 2026-11-06 | L'hôte canonique est `https://bot-wow.com`. | tenue, canonical + Redirect Rule observée |
| 2026-11-06 | Ne pas rouvrir le CTA ni le checkout dans le cycle d'état partagé. La page « purchase unavailable » est la posture publiée. | tenue par ce cycle |
| 2026-11-06 | Ne pas ajouter une redirection `www` dans `_redirects` ni une Pages Function tant que la Redirect Rule de zone répond 301. | tenue |
| 2026-11-06 | La preuve de livraison de ce cycle est un sandbox (Mollie, Resend, D1, R2 simulés). Elle ne déclare pas un paiement de production. | tenue |
| 2026-11-04 | ONE CORE OFFER : un seul prix historique 20 EUR, pas d'abonnement. | toujours dans `PRICE_TABLE` et `/api/config` ; ce n'est pas une offre ouverte |
| 2026-11-07 | Le paquet de distribution se construit côté BOT-WOW (`scripts/build-package.cjs`) de façon déterministe : `builtAt` = `SOURCE_DATE_EPOCH` ou date du commit source, tri byte-stable, clés de manifeste triées, fins de ligne texte en LF, provenance inscrite au manifeste. Le build python du dépôt source n'est pas reproductible et ne sert plus de référence de provenance. | tenue (PR de reproductibilité, en cours) |
| 2026-11-07 | L'identité d'un paquet livré se compare par son **empreinte canonique de contenu** (`scripts/canonical-package-digest.mjs`), pas par le SHA-256 du conteneur ZIP : deux ZIP peuvent porter le même contenu et des SHA différents. | tenue |
| 2026-11-07 | Sans licence documentée dans `aveca/Casinobabe`, la redistribution du runtime n'est pas justifiée : le checkout reste fermé et aucune vente du runtime ne peut être annoncée. | à lever par le propriétaire (B-licence) |
| antérieur | Ne pas réutiliser le profil Mollie d'un autre produit. | toujours en vigueur |
