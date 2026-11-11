# Profil Mollie BOT-WOW — il ne reste que l'identifiant

La PR #90 reste un brouillon. Aucun `profileId` n'est écrit dans git. Aucun secret n'est modifié.

## Déjà dans le code

- Une clé `test_` ou `live_` n'envoie pas `profileId`. Mollie le refuse sur ce type de clé.
- Un jeton d'organisation ou OAuth envoie `profileId` depuis le binding `MOLLIE_PROFILE_ID`.
- Si ce binding est vide et que la clé n'est pas `test_`/`live_`, l'appel Mollie n'est pas fait. Le checkout répond une erreur, sans réseau.
- Le prix reste 20,00 EUR (`bot-wow-lifetime`, 2 000 centimes).
- Le webhook attendu est `https://api.bot-wow.com/api/mollie-webhook`.
- Le checkout public reste fermé tant que `RELEASE_STATUS` n'est pas `confirmed`. La PR brouillon du flag `CHECKOUT_PUBLIC` ajoute un second verrou et n'est pas fusionnée.

## Quand le propriétaire a créé le profil

1. Copier l'identifiant `pfl_…` du profil BOT-WOW uniquement.
2. Le placer dans le secret déjà nommé `MOLLIE_PROFILE_ID`. Pas dans un fichier, pas dans une PR.
3. Ne pas réutiliser un profil d'un autre produit.
4. Enregistrer le webhook ci-dessus sur ce profil.
5. Dire si la clé de production est une clé API `live_` (alors l'identifiant est ignoré par le code) ou un jeton d'organisation (alors l'identifiant est obligatoire).

Tant que cette valeur n'est pas fournie, il n'y a rien d'autre à coder pour le profil.
