# Rapport de mission — correction du rendu étroit de la comparaison BOT-WOW

**Date :** 28 octobre 2026  
**Projet :** BOT-WOW — dépôt `aveca/bot-wow`  
**Statut :** Correctif fusionné et déployé en production ; rapport de clôture publié sur une PR documentaire séparée.

## Résumé exécutif

La section « BOT-WOW vs. all-in-one bots » de la page d’accueil s’affichait dans une colonne anormalement étroite, avec des cartes et le verdict comprimés. La cause était un conflit de classes CSS : la section entière réutilisait `.compare`, une classe historique de grille à deux colonnes limitée à 880 px, conçue pour un autre composant.

Le correctif renomme uniquement la classe de la section d’accueil en `.compare-section`, en anglais et en français. Les cartes internes conservent leur CSS dédié ; aucun changement de style global n’a été nécessaire.

## Cause racine confirmée

Dans `assets/site.css`, la règle historique `.compare` applique notamment `display: grid`, deux colonnes et `max-width: 880px`. Or les deux pages d’accueil utilisaient cette même classe sur leur élément `<section>` englobant le contenu comparatif. La grille et la largeur maximale s’appliquaient donc à la section entière et contraignaient le conteneur intérieur `.w` au lieu de laisser la section occuper la largeur disponible.

## Modifications apportées

| Fichier | Modification |
|---|---|
| `index.html` | `class="pad compare"` devient `class="pad compare-section"` sur la section comparative de l’accueil EN. |
| `fr/index.html` | Même correction sur la page d’accueil FR. |
| `tests/site-artifact.test.mjs` | Ajout de contrôles statiques pour interdire la réapparition de la classe de grille legacy sur les deux sections. |
| `tests/e2e/visual-inspection.spec.mjs` | Nouveau test Playwright à 1 440 px qui vérifie la largeur de la section, du conteneur, de la grille de cartes et d’une carte. |

Le nouveau contrôle navigateur impose une section de plus de 1 300 px, un conteneur intérieur de plus de 1 100 px, une grille de cartes de plus de 1 000 px et une carte de plus de 300 px au viewport desktop de 1 440 px. La mesure observée pour la grille était de 1 080 px. Le premier seuil supérieur à 1 100 px était donc trop strict ; il a été corrigé à 1 000 px et la suite complète a ensuite réussi.

## Validation et preuves

| Contrôle | Résultat | Preuve |
|---|---|---|
| Validation du projet | PASS | [Run Validate — PR #63](https://github.com/aveca/bot-wow/actions/runs/40788245539) |
| Tests unitaires et intégration (`npm test`) | PASS | Inclus dans le workflow UI ci-dessous |
| Audit des sélecteurs et tokens CSS | PASS | Inclus dans le workflow UI ci-dessous |
| Construction de l’artefact de site statique | PASS | Inclus dans le workflow UI ci-dessous |
| Tests UI Playwright avec Chromium | **158 passés** | [Run UI quality — PR #63](https://github.com/aveca/bot-wow/actions/runs/40788245563) |
| GitGuardian | PASS | Contrôle de sécurité sur le commit de PR |
| Validation après fusion sur `main` | PASS | [Run Validate — main](https://github.com/aveca/bot-wow/actions/runs/40788542658) |
| Déploiement GitHub Pages | SUCCESS | [Run Deploy — main](https://github.com/aveca/bot-wow/actions/runs/40788542470) |

Le workflow Playwright affiche `158 passed (1.6m)`, dont le nouveau test de largeur sur les projets desktop et mobile. Les artefacts de preuve visuelle ont été archivés par GitHub Actions sous [bot-wow-ui-quality-evidence](https://github.com/aveca/bot-wow/actions/runs/40788245563/artifacts/12860147542).

## Fusion et déploiement de production

- **PR du correctif :** [#63 — restore full-width comparison section](https://github.com/aveca/bot-wow/pull/63) — fusionnée.
- **Commit de production :** [`c71e91338f477516905871ba933dadbd2ddc9ca5`](https://github.com/aveca/bot-wow/commit/c71e91338f477516905871ba933dadbd2ddc9ca5).
- **Cloudflare Pages :** déploiement de production `99f19d96-74f3-4c64-a20d-460fb7493669`, étape `deploy = success` le 28 octobre 2026 à 23:36:57 UTC.
- **Déclencheur :** push GitHub sur `main`, commit exact `c71e91338f477516905871ba933dadbd2ddc9ca5`.
- **Domaines reliés au projet :** `bot-wow.com` et `www.bot-wow.com` (ainsi que `bot-wow.pages.dev`).

La page publique EN est accessible et le contenu comparatif y figure dans le flux normal de l’accueil. **Limite de vérification :** l’outil de lecture web a renvoyé pour la page FR une copie indexée ancienne (datée de plusieurs jours), tandis que la tentative de rendu navigateur sans cache via l’API Cloudflare a reçu HTTP 429 (limitation de débit). Le statut de déploiement Cloudflare prouve que le commit contenant les deux pages a été publié ; le DOM FR servi en temps réel n’a pas pu être vérifié indépendamment dans cette session. Les tests du dépôt et la construction publiée couvrent néanmoins la version FR.

## Périmètre et sécurité

Aucun changement effectué sur le checkout, les prix, les paiements, les secrets, les Workers, les objets R2 ou la configuration Cloudflare. La protection existante qui bloque l’achat tant que la livraison n’est pas confirmée reste en place. Aucun changement irréversible n’a été introduit par cette correction visuelle.

## Conclusion

Le défaut de largeur est corrigé dans les deux pages d’accueil, couvert par deux assertions statiques et un test navigateur de régression, fusionné sur `main`, puis déployé sur Cloudflare Pages et GitHub Pages. La seule réserve restante est l’absence de vérification DOM fraîche indépendante sur la route FR après publication, due au cache de lecture et à la limitation de débit constatés ; aucune erreur de déploiement n’est observée.

**Prochaine action :** garder cette correction comme référence et ne rouvrir ce sujet qu’en cas de défaut visuel reproduit ou de nouvelle preuve de régression.
