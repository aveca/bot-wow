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
| `node tests/canonical-package-digest.test.mjs` | sandbox local, 2026-11-07T22:52Z | exit 0, `CANONICAL DIGEST : OK` (20 contrôles : empreinte stable, intégrité du manifeste, fichier hors manifeste, fichier déclaré absent, codes de sortie) |
| `node tests/distribution-package.test.mjs` | sandbox local, 2026-11-07T22:53Z | exit 0, `DISTRIBUTION : OK` (28 contrôles, dont 2 builds = même SHA-256, CRLF = même SHA-256, empreinte canonique identique) |
| `node scripts/build-package.cjs --source <aveca/Casinobabe@257418c> --version 1.2.0 --out <dir>` | build local, 2026-11-07T22:55Z, répété 4× (LF, LF, CRLF, LF restauré) | SHA-256 **identique** `F8138F3C52EB2498114AD5BCD3988DB39A105BD4B757646BF1C2B7548DA79781`, 1 344 366 o, 17 entrées ZIP, 16 entrées de manifeste ; `treeDigest` `f69be8b3…` ; `integrite : ok` |
| `python scripts/build_desktop_package.py --version 1.2.0 --out <dir>` | dépôt source en lecture seule, 2026-11-07T22:57Z, 2 builds espacés de 4 s | **SHA-256 différents** (`D225E63F…` vs `9FC19FEE…`) : le build d'origine n'est pas reproductible (champ `builtAt`) |
| `node scripts/canonical-package-digest.mjs <objet R2 live extrait>` | copie locale déjà téléchargée via `wrangler r2 object get --remote`, 2026-11-07T22:59Z | `treeDigest` `fc9a1e0a…`, 30 fichiers, 3 174 481 o ; 0 écart de manifeste mais **3 fichiers livrés hors manifeste** (`Lancer-…bat`, `restaurer_previous.ps1`, `VERSION`) |
| `npm run validate` | local, 2026-11-07T23:03Z | exit 0, `BOT-WOW validation PASS` |
| `npm test` | local, 2026-11-07T23:03Z (inclut le nouveau test de digest canonique) | exit 0 |
| `CHECK_OPEN_PR_LOCKS=1 node scripts/check-agent-state.mjs` | local, 2026-11-07T23:02Z | exit 0, `AGENT STATE : OK` |

La CI GitHub de cette branche est enregistrée dans la PR, pas inventée ici. `npm run test:e2e` n'a pas été relancé : aucun changement de mise en page.
