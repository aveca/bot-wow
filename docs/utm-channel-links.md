# Liens BOT-WOW avec attribution UTM

Utiliser une URL distincte par canal pour les nouveaux posts et remplacer les liens nus dans les publications existantes. Le collecteur BOT-WOW ne conserve que la source normalisée : aucune URL complète ni donnée personnelle n'est enregistrée dans Analytics.

## Liens à copier

### Page anglaise

| Canal | URL à publier | Valeur enregistrée |
|---|---|---|
| Reddit | https://bot-wow.com/?utm_source=reddit | `reddit` |
| Discord | https://bot-wow.com/?utm_source=discord | `discord` |
| YouTube | https://bot-wow.com/?utm_source=youtube | `yt` |
| Forums | https://bot-wow.com/?utm_source=forum | `forum` |

### Page française

| Canal | URL à publier | Valeur enregistrée |
|---|---|---|
| Reddit | https://bot-wow.com/fr/?utm_source=reddit | `reddit` |
| Discord | https://bot-wow.com/fr/?utm_source=discord | `discord` |
| YouTube | https://bot-wow.com/fr/?utm_source=youtube | `yt` |
| Forums | https://bot-wow.com/fr/?utm_source=forum | `forum` |

## Règles de publication

1. Remplacer le lien nu de BOT-WOW dans chaque publication par l'URL correspondant au canal et à la langue.
2. Garder `utm_source=forum` comme valeur canonique pour les forums. L'alias `utm_source=forums` est accepté, mais les nouveaux posts doivent utiliser `forum`.
3. YouTube est stocké sous la catégorie canonique `yt` ; le lien peut utiliser la valeur lisible `youtube`.
4. Ne pas ajouter d'e-mail, de nom, d'identifiant de commande, de clé de licence ou d'autre donnée personnelle aux UTM.
5. `checkout_requested` indique une intention d'achat, pas une vente. Une vente reste confirmée uniquement par le traitement serveur du paiement.
6. Vérifier que chaque post conserve le paramètre après publication ; un raccourcisseur doit préserver la query string.

## Limite d'accès

L'intégration GitHub permet de préparer et tester ces liens, mais ne donne pas accès à la modification des publications déjà en ligne sur Reddit, Discord, YouTube ou les forums. Les anciens posts doivent être édités dans les comptes concernés ; cette PR ne prétend pas que ces posts ont été mis à jour.
