# STATE — Sprint BOT-WOW 10 missions autonomes (2026-10-27)

**Dépôt :** aveca/bot-wow (https://github.com/aveca/bot-wow.git)  
**Branche de travail :** `botwow-10-missions-sprint-2026-10-27` (créée depuis detached HEAD `8eaad0e`)  
**SHA de base :** `8eaad0e` — `fix(sale): correct the false delivery warning now that v1.2.0 is verified`  
**Date :** 2026-10-27  
**Contrat :** BOT-WOW-10-MISSIONS-AUTONOMES.md (contrat commun sections 0.1 à 0.5 + prompts 1-10)

## Capacités vérifiées au démarrage (0.2)

| Catégorie | Outil trouvé | Statut | Détail |
|---|---|---|---|
| Modèle / contexte | Nemotron 3.5 Super VL 120B A12B (nvidia) | OK | Vision/image supportée via browser.preview ; contexte conservé dans STATE.md/state.json |
| Terminal / shell | PowerShell (Win32) | OK | `&&` non supporté (séparateur `;` ou commandes séparées) ; `dir` alias Get-ChildItem (un seul path) |
| Git / dépôt | git 2.x, remote origin `https://github.com/aveca/bot-wow.git` | OK | push autorisé ; branches existantes nombreuses (voir ci-dessous) |
| Node / npm | Node v24.14.0, npm 11.9.0 | OK | `npm test`, `npm run validate`, `npm run package`, `npm run audit:css`, `npm run test:e2e` disponibles |
| Tests | Playwright `@playwright/test` ^1.64.1 + suites Node maison | OK | 13 suites + migrations SQLite (`--experimental-sqlite`) |
| Build package | `scripts/build-package.cjs` (--source, --version, --out, --notes) | OK | ZIP pur Node, MANIFEST.json + VERSION, pas de dépendance externe |
| Build site | `scripts/build-site.mjs _site` | OK | Statique, stamp des assets |
| Serveur local | `scripts/serve.mjs` | OK | Statique, `/api/track` renvoie 404 en local (ignoré dans tests) |
| Navigateur | Playwright Chromium, captures, CDP | OK | desktop 1440x900, mobile 390x844, tablette 768x1024 |
| GitHub | `gh` non vérifié encore ; remote accessible | À vérifier | PR/issues existantes #18, #19, #26, #28, #30, #31, #44, #52 |
| Cloudflare / Wrangler | wrangler.toml présent ; `wrangler` non vérifié installé | À vérifier | déploie Worker + Pages manuel |
| R2 / D1 / KV | référencés dans GO-LIVE-CHECKLIST.md | Lecture seule possible | pas de mutation production |
| Navigateur web / HTTP | browser.tabs.open, fetch | OK | lecture seule en production |
| Recherche web | websearch / webfetch | OK | docs officielles |

## État du dépôt à la base (8eaad0e)

- Working tree clean, detached HEAD avant création de branche.
- README : site compagnon Casinobabe (WoW Classic), licence à vie 20 €, démo simulée, version produit 1.2.0.
- PRODUCT.md : prix 20,00 € EUR, Mollie carte + Bitcoin manuel, livraison e-mail clé + lien, version 1.2.0.
- worker/index.js : PRICE_TABLE `bot-wow-lifetime` = { amount: 2000, currency: EUR }, PRICE_EUR_STR = "20.00".
- `scripts/build-package.cjs` construit `casinobabe-fishing-1.2.0.zip` + MANIFEST.json (SHA-256) + VERSION depuis `--source`.
- Rapport existant `reports/growth/2026-10-27-bot-wow-sale-readiness.md` : v1.2.0 vérifié en R2 (1 387 543 o, SHA-256 `1c132f36...`), checkout HTTP 200, 5 commandes payées / 5 licences / 5 jetons, idempotence OK.
- Incohérences repérées (mission 1) : `ab/a/fr/buy.html`, `ab/b/fr/buy.html` et `compare.html` disent encore "livraison non vérifiée" alors que le paquet est vérifié.

## Machine à état des missions

| Mission | Intitulé | Statut | SHA | Tests | Suivant |
|---|---|---|---|---|---|
| 1 | Contrat commercial réel (harmoniser offres EN/FR) | DONE | — | validate PASS, release-availability OK (acheté compare/fr/compare), link-check OK, site-artifact OK | 2 |
| 2 | Release v1.2.0 : build, intégrité, réconcilier PR #19/#44 | IN_PROGRESS | — | distribution-package, release-availability, build-package local | 3 |
| 3 | Webhooks Mollie idempotents + reprise de livraison | PENDING | — | payment-flow, migrations (DB temp) | 4 |
| 4 | Diagnostic chute checkout + durcir contrat checkout | PENDING | — | payment-flow, checkout-security, funnel | 5 |
| 5 | Route démo `/demo` en production | PENDING | — | site-artifact, e2e démo, navigateur | 6 |
| 6 | Demandes d'aide après échec checkout → dossier support | PENDING | — | subscribe, D1, idempotence | 7 |
| 7 | Funnel first-party attribuable jusqu'au paiement | PENDING | — | telemetry, allowlist, conversion-path | 8 |
| 8 | Test CRO A/B réversible et mesurable | PENDING | — | ab-variants | 9 |
| 9 | Acquisition gratuite, SEO, UX | PENDING | — | link-check, audit:css, validate | 10 |
| 10 | Certification finale, déploiement autorisé, rapport | PENDING | — | npm test complet, CI SHA exact | FIN |

Règles : aucun prix/devise/checkout modifié sans autorisation ; aucune mutation R2/D1/production ; aucun e-mail réel ; rapports versionnés sur GitHub.
