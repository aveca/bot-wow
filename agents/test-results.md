# Résultats de tests

Les lignes « à remplir » sont complétées par la commande réelle du cycle. Ne pas recopier un ancien PASS.

| commande | contexte | résultat |
|---|---|---|
| sondes HTTP `bot-wow.com`, `www`, `api.bot-wow.com` | production, 2026-11-06T14:15Z puis 14:17Z | voir `PROJECT_STATE.md` |
| D1 SELECT agrégats | `changed_db=false`, `rows_written=0` | 0 payé hors example.com ; 0 livraison ; 0 activation |
| `node tests/delivery-replay.test.mjs` | sandbox local, 2026-11-06T14:20Z | exit 0, `LIVRAISON REPRISE : OK`, y compris webhook paid → octets ZIP simulés |
| `node tests/api-route-map.test.mjs` | sandbox local, 2026-11-06T14:22Z | exit 0, `CARTE DES ROUTES : OK`, HEAD / = 308, HEAD /health = 200, HEAD /api/config = 200, 0 appel Mollie |
| `npm test` | sandbox local, 2026-11-06T14:23Z, après le correctif HEAD | exit 0. Python du planificateur absent (`spawnSync python ENOENT`) : ce contrôle est ignoré, les autres suites passent |
| `npm run validate` | local, 2026-11-06T14:20Z | exit 0, `BOT-WOW validation PASS` |
| `git diff --check` | local, 2026-11-06T14:23Z | exit 0 |
| `curl` GET et HEAD `https://api.bot-wow.com/`, `/health`, `/api/config` | production, 2026-11-06T14:48:30Z, après le déploiement Worker | `/` 308 vers `https://bot-wow.com/` ; `/health` 200 ; `/api/config` 200 et `priceEur` 20. Corps HEAD vide sur les trois |
| `node tests/storefront-product-sheet.test.mjs` | sandbox local, 2026-11-08, branche `p0/storefront-product-sheet-20261107` | exit 0, `FICHE PRODUIT : OK` (parite EN/FR, registre, honnete commerciale, provenance, paiement ferme, cablage sitemap/build/validate/liens/a11y) |
| `npm test` | sandbox local, 2026-11-08, suite complete incluse `storefront-product-sheet.test.mjs` | exit 0, toutes les suites vertes (liens, conversion, release-availability, artefact, agent-state-locks inclus) |
| `npm run validate` | local, 2026-11-08 | exit 0, `BOT-WOW validation PASS` |
| `git diff --check` | local, 2026-11-08 | exit 0 |
| `CHECK_OPEN_PR_LOCKS=1 node scripts/check-agent-state.mjs` | local, 2026-11-08 | `AGENT STATE : OK`, exit 0 |

La CI GitHub de cette branche est enregistrée dans la PR, pas inventée ici. `npm run test:e2e` n'a pas été relancé : aucun changement de mise en page.
