# Résultats de tests

Les lignes « à remplir » sont complétées par la commande réelle du cycle. Ne pas recopier un ancien PASS.

| commande | contexte | résultat |
|---|---|---|
| sondes HTTP `bot-wow.com`, `www`, `api.bot-wow.com` | production, 2026-11-06T14:15Z puis 14:17Z | voir `PROJECT_STATE.md` |
| D1 SELECT agrégats | `changed_db=false`, `rows_written=0` | 0 payé hors example.com ; 0 livraison ; 0 activation |
| `node tests/delivery-replay.test.mjs` | sandbox local, 2026-11-06T14:20Z | exit 0, `LIVRAISON REPRISE : OK`, y compris webhook paid → octets ZIP simulés |
| `node tests/api-route-map.test.mjs` | sandbox local, 2026-11-06T14:20Z | exit 0, `CARTE DES ROUTES : OK`, 0 appel Mollie |
| `npm run validate` | local, 2026-11-06T14:20Z | exit 0, `BOT-WOW validation PASS` |
| `git diff --check` | local, 2026-11-06T14:20Z | exit 0 |
| `npm test` | local, 2026-11-06T14:20Z | exit 0. Python du planificateur absent (`spawnSync python ENOENT`) : ce contrôle est ignoré par le test, les autres suites passent |

La CI GitHub de cette branche est enregistrée dans la PR, pas inventée ici. `npm run test:e2e` n'a pas été relancé : aucun changement de mise en page.
