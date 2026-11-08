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
| 2026-11-08 | Le builder de paquet refuse desormais les liens symboliques, verifie que chaque realpath reste sous SOURCE, confronte les overrides de provenance CLI au checkout reel (sinon refus) et marque `provenanceVerified` ; le digest canonique est fail-closed (manifeste absent/illisible/incomplet => exit non nul). | tenue par ce cycle |
| 2026-11-08 | La divergence des PR #150 et #154 avec main est resolue par MERGE, jamais par rebase : `AGENTS.md` interdit le force-push et la reecriture d'historique. | tenue par ce cycle |
| 2026-11-08 | Les empreintes publiees suivent le builder reellement livre. Le SHA reproductible publie est `A05FC380…` (builder durci), l'ancien `F8138F3C…` etant explicitement marque comme remplace. | tenue par ce cycle |
| 2026-11-08 | Aucun deploiement de preview pour une PR ouverte : `.github/workflows/pages.yml` ne se declenche que sur `push` vers `main`. Rien n'est deploye depuis #150 ni #154. | verifie dans le workflow |
