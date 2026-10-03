# Bot-Wow

Plateforme web de **Bot-Wow**, destinée à fonctionner avec l'écosystème de l'addon WoW.

## Objectifs

- Fournir un site web production-ready pour Bot-Wow.
- Connecter proprement le site à l'addon et à son backend/API.
- Migrer progressivement l'infrastructure de Namecheap vers Cloudflare.
- Remplacer Stripe par **Mollie** pour les paiements.
- Conserver un chemin de rollback tant que la nouvelle architecture n'est pas validée.
- Centraliser le code source, les tests et les déploiements dans GitHub.

## Architecture cible

```
Utilisateur
   |
   v
bot-wow.com
   |
   +--> Cloudflare DNS / SSL / CDN / WAF
   |
   +--> Frontend
   |
   +--> API / Workers
             |
             +--> Database
             |
             +--> Mollie
             |
             +--> Services Bot-Wow
```

Le domaine reste enregistré chez **Namecheap**. La migration prévue consiste à utiliser Cloudflare pour le DNS et les services compatibles, sans transférer immédiatement le registrar.

## Paiement

Le fournisseur cible est **Mollie**.

Le flux attendu est :

```
Client
  -> création de commande
  -> création du paiement Mollie côté serveur
  -> Checkout Mollie
  -> webhook Mollie
  -> vérification du paiement côté serveur
  -> commande PAID
  -> activation / livraison
```

Le retour navigateur seul ne doit jamais être considéré comme une preuve de paiement.

Stripe peut rester temporairement disponible pendant la migration afin de permettre un rollback, puis être retiré après validation complète de Mollie.

## Environnements

- **Production** : branche `main`
- **Staging** : environnement de validation avant production
- **Local** : développement et tests

Aucun secret ne doit être commité dans Git.

## Secrets

Les credentials doivent être fournis par l'environnement de déploiement ou un secret manager.

Exemples de variables :

```text
MOLLIE_API_KEY=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_ZONE_ID=
DATABASE_URL=
ADMIN_SECRET=
```

Les valeurs réelles ne doivent jamais apparaître dans :
- le code source ;
- Git ;
- les logs ;
- la documentation ;
- les captures d'écran.

## Migration Cloudflare

La migration se fait en plusieurs étapes :

1. Backup complet de l'hébergement actuel.
2. Import du code réel dans ce dépôt.
3. Audit de l'architecture existante.
4. Reproduction des DNS nécessaires dans Cloudflare.
5. Déploiement staging.
6. Validation frontend/API/admin/database.
7. Validation du paiement Mollie et de son webhook.
8. Validation email et DNS.
9. Déploiement production.
10. Changement manuel des nameservers chez Namecheap.
11. Surveillance et validation post-bascule.
12. Retrait progressif de l'ancienne infrastructure uniquement après confirmation du rollback.

Les records email (MX, SPF, DKIM, DMARC) doivent être préservés.

## Sécurité

Avant toute mise en production :

- rechercher les secrets exposés ;
- vérifier les endpoints d'administration ;
- vérifier l'authentification ;
- vérifier les webhooks ;
- vérifier les permissions ;
- vérifier les injections SQL/XSS/CSRF selon la stack ;
- vérifier que les fichiers `.env`, backups et répertoires Git ne sont pas publiquement accessibles.

Les mots de passe et tokens trouvés accidentellement doivent être révoqués/rotatés, pas documentés dans le dépôt.

## Déploiement

Aucun déploiement production ne doit être effectué à l'aveugle.

Chaque changement important doit être :

```
branche
  -> tests
  -> review/validation
  -> main
  -> déploiement
  -> smoke tests
```

## Rollback

Tant que la migration n'est pas validée :

- conserver le backup Namecheap ;
- conserver une version Git connue comme stable ;
- conserver la configuration DNS précédente ;
- ne pas supprimer l'ancien backend ;
- pouvoir revenir à l'ancienne architecture en cas d'échec.

## État initial du projet

Ce dépôt constitue le point de départ GitHub de Bot-Wow.

Les prochaines étapes doivent d'abord consister à importer/auditer le code réel actuellement hébergé sur Namecheap avant de considérer la migration comme terminée.

---

**Statut : infrastructure de migration en préparation.**

Le site production actuel reste la référence jusqu'à validation complète de la nouvelle architecture.
