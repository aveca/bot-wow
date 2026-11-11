# Rapport de mission — BOT-WOW P0.10 : fusion PR #46 et déploiement de production

**Date :** 2026-10-27  
**Verdict :** `MERGED_AND_PAGES_DEPLOYED`  
**Périmètre :** PR #46 uniquement. Les PR #44 et #45 n'ont pas été fusionnées ni modifiées par cette mission.

## 1. Résultat

| Élément | Preuve / état |
|---|---|
| PR source | [#46 — Hero CTA primaire](https://github.com/aveca/bot-wow/pull/46) |
| Branche source | `ui/cro-hero-primary-cta-20261027` |
| SHA source | `639b597cdd7ca0ad2af57bae491e6736e349de0c` |
| Fusion | Réussie, stratégie squash |
| Commit de fusion | [`7388988b605d9f0fb14ddd86fe43e7b17ad7e1f0`](https://github.com/aveca/bot-wow/commit/7388988b605d9f0fb14ddd86fe43e7b17ad7e1f0) |
| Déploiement Cloudflare Pages | Succès, environnement `production` |
| Deployment ID Pages | `9f29c3c7-f6dd-4441-a3a3-cdef5abe6c9d` |
| Commit déployé | `7388988b605d9f0fb14ddd86fe43e7b17ad7e1f0` |
| URL de déploiement | https://9f29c3c7.bot-wow.pages.dev |
| Domaines rattachés au projet Pages | `bot-wow.com`, `www.bot-wow.com`, `bot-wow.pages.dev` |

La fusion a été vérifiée après l'opération : GitHub rapporte la PR #46 fermée et fusionnée avec le SHA ci-dessus. Cloudflare Pages rapporte ensuite le déploiement de production du même SHA avec succès aux étapes `queued`, `initialize`, `clone_repo`, `build` et `deploy`. La phase `deploy` s'est terminée à `2026-10-27T20:21:37.583881Z`.

## 2. Modifications livrées

Deux fichiers ont été modifiés dans la PR :

- `index.html` : le CTA hero « See the offer », qui mène vers `#buy`, passe de `btn-ghost` à `btn-gold`. Le CTA démo reste secondaire.
- `tests/conversion-path.test.mjs` : `hero-offer` est ajouté à la liste des CTA d'achat contrôlés par l'audit de hiérarchie visuelle.

Aucune modification des prix, du parcours de paiement, de Mollie, des secrets ou de la logique du Worker n'est incluse dans ce diff.

## 3. Contrôles CI et limites de vérification

Le contexte de la PR et son rapport de mission indiquent :

- `npm run validate` : PASS ;
- `npm run test:gate` : PASS, 35 checks ;
- `npm test` : PASS, 18/18 suites ;
- Playwright : PASS, 54/54 tests E2E ;
- `git diff --check` : propre ;
- GitGuardian : déclaré PASS dans le compte-rendu source.

Vérification GitHub indépendante par le connecteur : les workflows `Validate Bot-Wow` (run 178, ID `40576464427`) et `UI quality and visual evidence` (run 73, ID `40576464454`) sont terminés avec la conclusion `success`. L'API de statuts utilisée n'a pas exposé de statut séparé pour GitGuardian : son état est donc rapporté depuis le compte-rendu source, et non comme une nouvelle lecture indépendante.

**Limite importante :** l'agent Codex n'a pas terminé sa revue de code, car la limite d'utilisation des revues était atteinte. Le commentaire GitHub indique que la revue n'a pas pu être complétée ; ce n'est pas un finding de code exploitable, mais ce n'est pas non plus une revue Codex réussie.

La métadonnée du déploiement Cloudflare confirme la construction et la publication de production. En revanche, aucune nouvelle session de navigateur Playwright n'a été exécutée contre le domaine public après la publication dans cette mission. La vérification visuelle live du CTA et du comportement de l'ancre `#buy` reste donc à faire.

## 4. Pourquoi le Worker API n'a pas été redéployé

Le déploiement utile à cette correction est celui du site statique :

- le projet Cloudflare Pages `bot-wow` est associé au dépôt `aveca/bot-wow`, à la branche de production `main`, et construit avec `node scripts/build-site.mjs _site` vers le répertoire `_site` ;
- le push de fusion sur `main` a déclenché et terminé automatiquement le déploiement Pages de production ;
- le Worker `botwow-api` est un composant distinct, attaché à `api.bot-wow.com`. La PR #46 ne change ni `worker/index.js` ni sa configuration.

Un redéploiement de `botwow-api` n'aurait pas été nécessaire pour publier la modification HTML et aurait constitué une opération de production sans changement Worker à livrer. Aucun nouveau déploiement de ce Worker n'a donc été déclenché.

## 5. PR séparées et garde-fous

| PR | État après mission |
|---|---|
| [#44 — Checkout / livraison](https://github.com/aveca/bot-wow/pull/44) | OPEN, non fusionnée ; inchangée |
| [#45 — Rapport de revue P0.9](https://github.com/aveca/bot-wow/pull/45) | OPEN, non fusionnée ; inchangée |
| [#46 — Hero CTA](https://github.com/aveca/bot-wow/pull/46) | MERGED |

Aucun contournement de contrôle, changement de secret, changement de prix ou modification du checkout n'a été effectué.

## 6. Prochaine action recommandée

Effectuer une vérification post-déploiement réelle dans Chromium/Playwright sur `https://bot-wow.com/` et `https://bot-wow.com/fr/` :

1. vérifier le CTA hero en vue desktop et mobile, sa classe `btn-gold` et son lien vers `#buy` ;
2. vérifier que le CTA de démo reste visuellement secondaire ;
3. confirmer que l'ancre amène bien à l'offre et que le CTA d'achat reste utilisable, sans soumettre de paiement réel ;
4. contrôler les erreurs console/réseau et la télémétrie du clic `hero-offer` sans le compter comme conversion ;
5. conserver les captures et résultats E2E, puis publier les preuves dans un rapport versionné sur GitHub.

Ne pas fusionner la PR #44 dans le cadre de cette action.
