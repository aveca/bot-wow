# Rapport de préparation finale — Conversion commerciale BOT-WOW

**Date :** 2026-11-19
**Auteur :** OpenCode (agent aveca/bot-wow)
**Statut :** Prêt pour revue — pas de déploiement production

## Résumé

PR #209 (conversion commerciale, régression `release-availability`) et PR #204 (copie offre compagnon ES/FAQ) sont toutes deux fusionnées dans `origin/main`. L'arbre de travail à `55ca9dd` passe les 4 contrôles requis (validate, release-availability, conversion-path, live-offers) en exit 0. Aucun prix, lien Stripe, checkout, paiement, secret, binding ni déploiement n'a été modifié. La vente publique reste fermée.

## PR fusionnées

| PR | Objet | SHA de fusion | Branche | Lien |
|----|-------|---------------|---------|------|
| #209 | Conversion commerciale — retrait des formulaires email signup des 8 buy.html | `2e999b8` | `feat/commercial-conversion-20261119` | https://github.com/aveca/bot-wow/pull/209 |
| #204 | Copie offre compagnon ES/FAQ — correction duplication pied de page es/buy.html | `96e736e` (dans `55ca9dd`) | `fix/companion-offer-copy-es-faq-20261117` | https://github.com/aveca/bot-wow/pull/204 |

`origin/main` a avancé de `2e999b8` à `55ca9dd` (merge commit de la PR #204).

## Contrôles CI (GitHub Actions sur `96e736e`)

| Contrôle | Statut |
|----------|--------|
| Validate Bot-Wow | SUCCESS |
| Package candidate | SUCCESS |
| GitGuardian Security Checks | SUCCESS |
| UI quality | SUCCESS |

## Tests locaux (arbre `origin/main` `55ca9dd`, 2026-11-19)

| Commande | Résultat |
|----------|----------|
| `npm run validate` | exit 0 — `BOT-WOW validation PASS` |
| `node tests/release-availability.test.mjs` | exit 0 — `RELEASE AVAILABILITY : OK` |
| `node tests/conversion-path.test.mjs` | exit 0 — `PARCOURS DE CONVERSION : OK` (incl. 7 assertions de régression) |
| `node tests/live-offers.test.mjs` | exit 0 — `OFFRES LIVE : OK` |
| `git diff --check` | exit 0 |

## État des verrous et tâches

| Élément | Valeur |
|---------|--------|
| Verrou `20261119-commercial-conversion` | `done`, expire 2026-11-20T00:00:00Z |
| PR #209 | MERGED à `2e999b8` |
| PR #204 | MERGED, contenu dans `55ca9dd` |
| Checkout public | Fermé (aucun changement) |
| Prix | Intacts (9 € Planner, 29 € Studio sur Stripe LIVE ; 20 € historique uniquement dans `/api/config`) |
| Déploiement | Aucun (ni Worker, ni Pages) |

## Fichiers d'état mis à jour (ce commit)

- `PROJECT_STATE.md` — ajout de la fusion PR #209 + PR #204, origin/main `2e999b8` → `55ca9dd`
- `agents/tasks.md` — ligne `20261119-commercial-conversion` mise à jour (MERGED)
- `agents/locks.md` — ligne 28 `20261119-commercial-conversion` : PR #209 et PR #204 MERGED
- `agents/test-results.md` — ajout des 4 contrôles du 2026-11-19 sur l'arbre `55ca9dd`
- `reports/operations/BOT-WOW-CURRENT-STATE.md` — état court au 2026-11-19 mis à jour

## Blocs restants (inchangés)

La réouverture de la vente publique reste bloquée en attente de trois décisions, aucune n'étant prise dans ce cycle :

1. **Textes juridiques** — conditions de licence client, EULA/conformité Blizzard (PR #66 en cours).
2. **Provenance R2** — paquet `casinobabe-fishing-1.2.0.zip` marqué "not verified" ; droits de redistribution non documentés.
3. **Profil Mollie dédié BOT-WOW** — aucun profil BOT-WOW visible dans `ListProfiles` ; le seul profil visible est celui de Sargasses (`pfl_t8KCk4Cm2C`) et ne doit pas être réutilisé.

Aucun prix, checkout, paiement, secret, binding, déploiement Worker/Pages ou écriture R2 n'a été effectué ni autorisé dans ce cycle.

## Prochaine action

Publier ce commit sur `chore/state-update-commercial-conversion-20261119`, ouvrir une PR de revue vers `main`, puis merger sur autorisation lorsque la CI est verte. Aucun déploiement production sans autorisation explicite.