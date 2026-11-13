# Catalogue Stripe à créer — 2026-11-13

Compte : `acct_1UZwjERnrMmUAHDt` uniquement. Ne pas utiliser `acct_1UZwjTDCQkzI0NeM` (catalogue test Sargasses).

Le Payment Link historique `https://buy.stripe.com/00wbJ3gHAdHEf78fF863K00` n’est pas modifié et n’est plus affiché.

## Produits créés le 2026-11-13

| Nom | Montant | Devise | Type | metadata `price_key` | Payment Link | Identifiants |
|---|---|---|---|---|---|---|
| BOT-WOW Planner | 900 (9,00) | EUR | paiement unique | `planner` | https://buy.stripe.com/4gM4gB62W4749MO78C63K01 | `plink_1UbIoJRnrMmUAHDtGYXfbz3m`, `price_1UbIoARnrMmUAHDtUOiNMeir` |
| BOT-WOW Studio | 2900 (29,00) | EUR | paiement unique | `studio` | https://buy.stripe.com/eVqdRb8b4dHE6AC50u63K02 | `plink_1UbIoKRnrMmUAHDtQnO7HFRk`, `price_1UbIoBRnrMmUAHDtY4JprzB1` |

Les URL sont dans `assets/payment-links.js`. Succès Stripe : `https://bot-wow.com/thanks.html?session_id={CHECKOUT_SESSION_ID}`. `price_key` est lu sur la session, puis sur `payment_intent.metadata`, puis déduit du `payment_link` si la métadonnée manque. Ne pas réutiliser le prix `price_1UaG0TRnrMmUAHDtO3r6xVq4`.

## Webhook

URL : `https://api.bot-wow.com/api/stripe-webhook`

Événements :

- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_failed`
- `payment_intent.payment_failed`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.funds_withdrawn`

Le corps signé suffit. Le Worker ne rappelle pas l’API Stripe si la session du webhook contient déjà le montant, la devise et `payment_status`.

## Variables

| Nom | Rôle |
|---|---|
| `STRIPE_WEBHOOK_SECRET` | secret de signature du endpoint ci-dessus. Obligatoire. |
| `RESEND_API_KEY` | envoi de l’e-mail d’accès. Déjà présent par nom ; sans valeur valide l’accès est consigné, pas envoyé. |
| `MAIL_FROM` | déjà en clair : `BOT-WOW <licences@bot-wow.com>` |
| `STRIPE_LINK_PLANNER` | URL `https://buy.stripe.com/…` du lien Planner, texte clair optionnel |
| `STRIPE_LINK_STUDIO` | URL `https://buy.stripe.com/…` du lien Studio, texte clair optionnel |

`STRIPE_SECRET_KEY` n’est pas nécessaire pour cette livraison. Ne pas y mettre une clé live pour « faire marcher » l’ancien checkout API.

Les URL LIVE sont déjà dans `assets/payment-links.js`. `STRIPE_LINK_PLANNER` et `STRIPE_LINK_STUDIO` restent optionnelles : si elles sont posées, elles remplacent ces URL côté `/api/config`. Le lien historique est refusé par le site.

## Phrase de description d’activité

BOT-WOW sells a web decision aid for World of Warcraft fishing: the player enters spots and prices, and the tool calculates a route and a margin. It does not control the game, capture the screen, or send input.

## Déploiement

1. Fusionner la PR une fois la CI verte.
2. Cloudflare Pages publie le site depuis `main` (intégration GitHub déjà en place).
3. Déployer le Worker `botwow-api` depuis ce commit (`wrangler deploy`), sans changer les secrets autres que le webhook si un nouvel endpoint est créé.
4. Créer les deux produits et les deux Payment Links, puis renseigner les URL.
5. Ajouter les événements webhook manquants sur l’endpoint existant.
6. Coller la phrase d’activité à la place du texte Sargasses.

Cet agent n’a pas déployé et n’a pas fusionné.
