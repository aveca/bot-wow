# Bot-Wow — MVP

Site compagnon de l'addon WoW **Bot-Wow**.

## État actuel

**MVP statique prêt pour GitHub Pages.**

Le dépôt public contient désormais le site vitrine, une démo interactive légère, une page 404 et le workflow GitHub Actions de publication.

- Source : https://github.com/aveca/bot-wow
- Déploiement : GitHub Pages
- Domaine cible : `bot-wow.com`
- FTP / hébergement Namecheap : **hors périmètre du MVP**
- Cloudflare : **hors périmètre du MVP**
- Paiement Mollie : **à brancher ultérieurement côté backend**
- Secrets : **aucun secret dans le dépôt**

## Structure

```
.
├── index.html
├── 404.html
├── .nojekyll
├── assets/
│   ├── app.js
│   └── style.css
└── .github/
    └── workflows/
        └── pages.yml
```

## Publication

Le workflow `.github/workflows/pages.yml` publie automatiquement le contenu de `main` sur GitHub Pages après chaque push.

Dans GitHub :

1. **Settings → Pages**
2. Source : **GitHub Actions**
3. Vérifier que le workflow `Deploy Bot-Wow to GitHub Pages` termine avec succès.
4. Le site est alors disponible sur l'URL Pages fournie par GitHub.

Le domaine personnalisé `bot-wow.com` sera configuré **après validation du MVP**. Aucun changement DNS Namecheap n'est requis pour tester l'URL GitHub Pages.

## Ce que fait le MVP

- Landing page responsive.
- Présentation des fonctions Bot-Wow.
- Démo interactive du parcours lobby/session.
- États `ACTION_REQUIRED` clairement affichés lorsque l'action dépend du client WoW.
- FAQ expliquant les limites du site statique.
- Aucun paiement ou authentification simulé comme étant réel.

## Architecture prévue ensuite

GitHub Pages reste le frontend statique.

Les fonctions nécessitant un serveur seront séparées :

```
Visiteur
  ↓
GitHub Pages — site Bot-Wow
  ↓
API / backend séparé
  ├── sessions / utilisateurs
  ├── base de données
  ├── addon WoW
  └── Mollie + webhooks
```

GitHub Pages ne doit pas recevoir de clé Mollie, secret admin, credential de base de données ou autre secret serveur.

## Mollie

Mollie n'est **pas encore activé dans ce MVP**.

Lors de l'intégration :

1. le backend crée le paiement ;
2. l'utilisateur est redirigé vers Mollie ;
3. Mollie appelle le webhook ;
4. le backend vérifie l'état réel du paiement ;
5. la commande passe à `PAID` ;
6. la livraison/activation est effectuée.

Le retour navigateur ne constitue jamais à lui seul une preuve de paiement.

## Règle d'autonomie

Le site peut évoluer indépendamment de l'addon.

Une action qui nécessite réellement le client WoW ne doit pas être présentée comme exécutée côté serveur : elle passe en `ACTION_REQUIRED`, indique précisément ce que le joueur doit faire, puis peut être confirmée par un événement réel.

## Sécurité

Ne jamais committer :

- `.env`
- clés API
- mots de passe
- tokens
- cookies/session secrets
- dumps de base de données
- credentials Namecheap/Cloudflare/Mollie

Le dépôt étant public, toute donnée secrète poussée par erreur doit être considérée comme compromise et révoquée.

## Prochaines étapes

1. Valider le MVP sur GitHub Pages.
2. Ajouter le domaine personnalisé `bot-wow.com`.
3. Finaliser l'addon WoW et son contrat d'intégration.
4. Ajouter l'API/backend.
5. Ajouter Mollie côté serveur et les webhooks.
6. Ajouter les fonctions commerciales et le téléchargement contrôlé de l'addon.
7. Envisager Cloudflare lorsque le backend/DNS le justifiera.

**Le MVP actuel ne dépend volontairement ni de FTP ni de Namecheap.**
