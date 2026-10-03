# Bot-Wow — MVP

Site compagnon de l'addon **Bot-Wow**.

## Architecture actuelle

Le projet est volontairement **100 % GitHub pour le MVP** :

- frontend statique dans ce dépôt ;
- GitHub Pages pour l'hébergement ;
- GitHub Actions pour le déploiement automatique ;
- aucune dépendance FTP ;
- aucun hébergement Namecheap ;
- aucun domaine personnalisé requis ;
- aucun backend ou secret serveur dans le MVP.

**URL MVP :** https://aveca.github.io/bot-wow/

## Déploiement

Chaque push sur `main` déclenche `.github/workflows/pages.yml`.

GitHub → **Settings → Pages → Source: GitHub Actions**.

## Produit

Le site présente :

- accueil / positionnement Bot-Wow ;
- parcours `RECEIVE → INVITE → LAUNCH → PLAY` ;
- lobby et gestion des joueurs ;
- sessions et rand ;
- annonces / emotes / showtime ;
- gestion explicite des `ACTION_REQUIRED` ;
- playground interactif ;
- FAQ produit.

## Règle fondamentale

Une action dépendant réellement du client WoW ne doit jamais être affichée comme réussie sans confirmation réelle.

État attendu :

`ACTION_REQUIRED` → le site indique l'action à effectuer → le joueur agit dans WoW → un événement réel confirme → le parcours reprend.

## Backend et paiement — plus tard

Ils sont volontairement hors périmètre du MVP.

La future architecture pourra ajouter une API séparée pour :

- comptes / sessions ;
- persistance ;
- intégration addon ;
- Mollie et webhooks.

Aucune clé Mollie, credential, mot de passe ou secret ne doit être placé dans GitHub Pages.

## Prochaine étape

Valider le parcours visuel sur GitHub Pages, puis développer l'intégration réelle de l'addon sans casser le frontend statique.