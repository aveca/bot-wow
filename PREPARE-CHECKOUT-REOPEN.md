# Preparation de la reouverture commerciale — P0 (NON ACTIVEE)

Statut : preparee, NON fusionnee, NON deployee, NON activee.
Branche : p0/prepare-checkout-reopen-20261104
Base : p0/delivery-proof-20261104 (PR #71)

## Condition prealable (non satisfaite a ce jour)

La reouverture exige, en plus du code de cette branche :
1. La PR #71 mergee sur main.
2. Le Worker botwow-api deploye avec la garde toujours a pending, puis un paiement test Mollie reel (mode test) concluant : licence creee, jeton cree, e-mail recu avec la cle et le lien, recu sent dans deliveries, activation reussie (license_activated).
3. Une decision explicite de passer RELEASE_STATUS=confirmed (autorisation humaine distincte).

Tant que ces conditions ne sont pas remplies, aucun bouton d'achat ne doit etre reactive. Cette branche ne fait qu'en preparer le diff.

## Changements a appliquer (EN + FR) — a faire dans la prochaine session

Fichiers : buy.html, fr/buy.html, index.html, fr/index.html, compare.html, fr/compare.html.

1. Reactiver le bouton d'achat : retirer disabled de #buyBtn.
2. Texte du bouton : Pay 20.00 EUR / Payer 20,00 EUR (sans "delivery not confirmed").
3. Remplacer l'encart .checkout-blocked (rouge) par un encart positif : "Checkout available. The v1.2.0 package is delivered by email after payment." / "Achat disponible. Le paquet v1.2.0 est livre par e-mail apres paiement."
4. Conserver les avertissements honnetes : pas de garantie de remboursement inconditionnelle, lien vers la politique de remboursement, condition d'activation mentionnee, prix 20 EUR inchange, CTAs instrumentes.
5. Mettre a jour tests/release-availability.test.mjs pour refleter le nouvel etat (bouton actif, message positif) — sans reintroduire de promesse de livraison immediate ni de "v1.2.0 version actuelle".

## Ce qui ne change pas

- Prix : 20 EUR.
- Aucune promesse de garantie supplementaire.
- RELEASE_STATUS reste pending cote code (la garde serveur reste active).
- Aucun changement de secret, binding, prix, schema.

## Verification attendue apres application

- npm test vert (y compris release-availability adapte).
- npm run validate vert.
- Bouton actif sur /buy et /fr/buy, message positif, formulaire fonctionnel — mais le serveur repondra toujours 409 delivery_unverified tant que RELEASE_STATUS != confirmed, ce qui est le comportement voulu.
