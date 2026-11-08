# Décisions

| date | décision | statut |
|---|---|---|
| 2026-11-06 | L'hôte canonique est `https://bot-wow.com`. | tenue, canonical + Redirect Rule observée |
| 2026-11-06 | Ne pas rouvrir le CTA ni le checkout dans le cycle d'état partagé. La page « purchase unavailable » est la posture publiée. | tenue par ce cycle |
| 2026-11-06 | Ne pas ajouter une redirection `www` dans `_redirects` ni une Pages Function tant que la Redirect Rule de zone répond 301. | tenue |
| 2026-11-06 | La preuve de livraison de ce cycle est un sandbox (Mollie, Resend, D1, R2 simulés). Elle ne déclare pas un paiement de production. | tenue |
| 2026-11-04 | ONE CORE OFFER : un seul prix historique 20 EUR, pas d'abonnement. | toujours dans `PRICE_TABLE` et `/api/config` ; ce n'est pas une offre ouverte |
| antérieur | Ne pas réutiliser le profil Mollie d'un autre produit. | toujours en vigueur |
| 2026-11-08 | Fiche produit PixelBuddy-style `product.html` + `fr/product.html` : statuts du registre `assets/modules.json` reproduits sans embellissement ; pilier rouge "non distribué" sur chaque module ; prix 20,00 € présenté uniquement comme cible historique ; aucun formulaire, POST, champ e-mail ni Mollie/Bitcoin ; aucune prétention d'indétectabilité ni d'anti-ban ; licence et non-reproductibilité de l'artefact R2 publiés. CTA uniquement vers `./buy.html`. | tenue par ce cycle |
| 2026-11-08 | Aucun changement CSS/asset pour la fiche : classes existantes uniquement (`.hero`, `.price-card`, `.modrow`, `.st-*`, `.feats/.feat`, `.qa`, `.mbar`), l'estampille d'assets `?v=560cff9a` reste valide. | tenue par ce cycle |
