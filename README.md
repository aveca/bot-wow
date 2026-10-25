# BOT-WOW — Site compagnon de l'addon Casinobabe (WoW Classic)

Site compagnon du bot de pêche **Casinobabe** pour WoW Classic (serveurs 1.13 et privés inclus).
Vente d'une licence à vie (20 €), démo navigateur (carte simulée), registre honnête des modules.

## État actuel

- **Version :** V13.1 (héros editorial bold, variant C, EN + FR cohérents)
- **Commit de référence :** `8dbf98f` — Factory V3 : documentation persistante + héros FR mis à jour
- **Production :** https://bot-wow.com/ (Cloudflare Pages) + https://aveca.github.io/bot-wow/ (GitHub Pages)
- **Dernière livraison vérifiée :** tests complets passés, aucun débordement, CTA visible sur tous les viewports

## Architecture

Le site est **100 % statique** :

- Frontend statique dans ce dépôt (`index.html`, `demo.html`, `compare.html`, `modules.html`, `features.html`, `fishing.html`, `getting-started.html`, `compatibility.html`, `roadmap.html`, `faq.html`, `success.html`, `cancel.html`, `fr/` pour la traduction française, `docs/` pour les guides)
- GitHub Pages et Cloudflare Pages pour l'hébergement (deux cibles, mêmes contenus)
- GitHub Actions pour le déploiement automatique sur push `main`
- Aucun secret dans le frontend
- `/worker/*`, `package.json`, `package-lock.json` protégés (404 via `_redirects`)

### Pages

| Page | Rôle |
|------|------|
| `index.html` | Accueil : héros, démo du produit, parcours, télémétrie, étapes, registre, comparaison, tarifs, docs, CTA final |
| `demo.html` | Démo navigateur : carte simulée, planificateur de rondes |
| `compare.html` | Comparaison honnête BOT-WOW vs. bots tout-en-un |
| `modules.html` | Registre des modules : statuts (livré / en développement / planifié) |
| `features.html` | Fonctionnalités détaillées |
| `fishing.html` | Page dédiée pêche |
| `getting-started.html` | Guide de démarrage |
| `compatibility.html` | Matrice de compatibilité |
| `roadmap.html` | Feuille de route |
| `faq.html` | FAQ produit |
| `success.html` / `cancel.html` | Résultats de paiement |
| `docs/` | Guide d'installation, notes de version, problèmes connus, récupération de licence |
| `legal/` | Conditions, confidentialité, remboursements |

### Parcours critiques

1. Héros CTA → Démo navigateur
2. Héros CTA → Offre (tarifs)
3. Formulaire de paiement → Mollie checkout → Webhook → Livraison de licence
4. Registre des modules → Statuts honnêtes
5. Démo navigateur → Planificateur de rondes (carte simulée)

## Déploiement

### GitHub Pages (production automatique)

Chaque push sur `main` déclenche `.github/workflows/pages.yml` :

1. `npm run validate` — validation du projet statique
2. `node scripts/build-site.mjs _site` — construction de l'artefact statique
3. `actions/upload-pages-artifact` + `actions/deploy-pages` — déploiement

### Cloudflare Pages (manuel, wrangler)

```bash
node scripts/build-site.mjs _site
wrangler pages deploy _site --project-name=bot-wow --branch=main
```

Le projet Cloudflare Pages `bot-wow` sert le domaine `bot-wow.com`.

## Tests et validation

```bash
npm run validate                    # Validation : fichiers, refs, secrets, syntaxe JS, démo, migrations
npm test                           # Tous les tests : parité JS/Python, distribution, paiement, sécurité, artefact, liens, conversion, télémétrie, migrations
node scripts/build-site.mjs _site  # Construction de l'artefact statique
node scripts/serve.mjs 8099 _site  # Serveur local de test
node scripts/audit-viewports.mjs <url> <label>   # Audit Chrome CDP (4 viewports, pas de débordement, CTA visible, erreurs console)
```

### Critères de qualité (garantis)

- `npm run validate` et `npm test` passent
- Aucun débordement horizontal sur aucun viewport
- Aucune erreur console
- CTA principal visible au-dessus de la ligne de flottaison (mobile et desktop)
- Exactement un `<h1>` par page
- Contenu visible avec `prefers-reduced-motion`
- Aucun secret dans les artefacts publiés
- Budget gzip : ≤ 210 Ko pour les assets de code (actuel ≈ 67 Ko)
- Protection de `/worker/*`, `package.json`, `package-lock.json` (404)
- Télémétrie first-party uniquement, jamais de clic compté comme conversion

## Design system et règles d'animation

### Tokens
Définis dans `assets/style.css` et `assets/site.css` :
- `--bg`, `--txt`, `--mut`, `--mut2` — couleurs
- `--gold` (#c9a227), `--cyan` (#5fb4d8), `--green` (#7bd88f) — couleurs d'accent
- `--mono` — JetBrains Mono

### Héros (variant C — actif)
Structure : `section.hero.variant-c` avec `.hero__wrapper` contenant badge, titre en 3 mots, lead, CTA, prix, garantie, séparateur, preuves.

### Règles d'animation
- Propriétés composites uniquement (transform, opacity)
- Aucun `transition: all`
- Respect de `prefers-reduced-motion`
- Aucun mouvement gratuit
- Aucune dépendance redondante

## Sécurité

- Aucune clé Mollie, credential, mot de passe ou secret dans le frontend
- Validation côté serveur des champs et tailles
- Protection anti-spam / abus (rate limiting)
- Dégradation gracieuse (pas de stockage en mémoire non borné)
- Les clics ne sont jamais comptés comme conversions (télémétrie = intention uniquement)

## Contraintes SEO et accessibilité

- URLs canoniques, hreflang (en/fr)
- Meta descriptions, Open Graph
- Sitemap.xml
- Un seul `<h1>` par page
- Texte alternatif sur les images
- ARIA sur les éléments interactifs
- Navigation clavier supportée

## Contribuer (Factory V3)

Ce dépôt suit le système **Factory V3** d'amélioration continue (voir `FACTORY.md`) :

1. **Auditer** le code existant et les retours de production
2. **Identifier** les problèmes réels et opportunités d'amélioration
3. **Classer** par impact sur l'expérience utilisateur, la conversion, la qualité visuelle, les fonctionnalités, la performance
4. **Modifier** directement le code existant (pas de refonte depuis zéro)
5. **Construire et tester** : `npm run validate`, `npm test`
6. **Vérifier** dans un vrai navigateur (Chrome CDP, mobile + desktop)
7. **Corriger** les défauts, recommencer les tests
8. **Intégrer**, mettre à jour `FACTORY.md`, préparer la prochaine amélioration

### Règles

- Aucune refonte successive pour produire V14, V15, V16… — chaque intervention améliore le même produit
- Aucun changement décoratif sans valeur démontrable
- Si un test échoue, corriger avant publication
- Si la production est dégradée, appliquer la procédure de retour arrière
- Publier uniquement si les garanties de qualité sont respectées

### État de la dernière livraison (voir FACTORY.md)

Voir `FACTORY.md` pour : contrat fonctionnel, design system, composants, règles d'animation, contraintes, commandes, critères de qualité, problèmes connus, backlog priorisé, et état de la dernière livraison vérifiée.
