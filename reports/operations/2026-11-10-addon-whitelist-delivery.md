# 2026-11-10 — Addon livrable : liste blanche, TOC BOT-WOW, tests d'installation réelle

**Mission :** rendre l'addon réellement distribuable, installable et livrable,
sans ouvrir de paiement ni toucher au checkout fermé.

**Branche :** `p0/package-whitelist-toc-20261110` (base `main` `5861b03`)
**Dépôt :** https://github.com/aveca/bot-wow

## 1. Contexte mesuré avant modification

Le builder `scripts/build-package.cjs` copiait **tout** le contenu de
`runtime-addon/Casinobabe/`. Le paquet de pêche embarquait donc l'interface
casino historique (`Casinobabe.lua`, 373 Ko, 15 590 lignes), ses deux
bibliothèques minimap et une police tierce de 757 Ko, dont le module de pêche ne
se sert pas.

Analyse de dépendances faite sur le checkout source
`aveca/Casinobabe` (lecture seule, aucun checkout ouvert) :

| Fichier de la source | Utilisé par le module de pêche livré ? | Preuve |
|---|---|---|
| `Casinobabe.lua` (casino) | non | 0 occurrence de `CasinobabeFishing`, `Fishing` ou `fishing` ; 0 symbole exporté susceptible d'être appelé par le module. Preuve exécutable côté source : `tests/run-fishing-harness.mjs` charge `CasinobabeFishing.lua` **seul** et obtient `Casinobabe.Fishing`. |
| `CasinobabeFishing.lua` | oui (livrable) | crée lui-même sa table globale (`local CB = Casinobabe or {}`), ses variables sauvegardées (`CasinobabeDB.fishing.totals`), 0 `LibStub`, 0 `LibDBIcon`, 0 `SetFont`, 0 `ttf`. |
| `LiveErrorCapture.lua` | oui (livrable) | autonome (API WoW + `CasinobabeErrorBus`) ; doit précéder le module de pêche, qui chaîne son gestionnaire d'erreurs sur le précédent. |
| `Libs/LibStub/LibStub.lua` | non | 4 références dans `Casinobabe.lua`, 0 dans le module de pêche. |
| `Libs/LibDBIcon-1.0/LibDBIcon-1.0.lua` | non | 15 références dans `Casinobabe.lua`, 0 dans le module de pêche. |
| `media/background.tga` | non | fond dessiné à `SetColorTexture` ; droits non établis. |
| `media/casino_uni.ttf` | non | police DejaVu Sans : 0 `SetFont`, 0 `ttf` dans le module livré. |

Conclusion retenue : `Casinobabe.lua` et les trois composants ci-dessus ne sont
**pas indispensables** au mode pêche, et leur titularité/droits ne sont pas tous
établis. Ils ne doivent pas entrer dans un paquet de vente.

## 2. Ce qui a changé

### `scripts/build-package.cjs`

- **Liste blanche `ADDON_WHITELIST` = `LiveErrorCapture.lua`, `CasinobabeFishing.lua`** (fail-closed) : seuls ces deux fichiers sont copiés.
- **`ADDON_EXCLUDED`** : table fichier → raison exacte, utilisée pour documenter chaque exclusion au manifeste. Un fichier de la source absent de cette table est exclu lui aussi, compté **non inventorié**, et fait échouer un build `--release`.
- **Contrôle de complétude** : un fichier de la liste blanche absent de la source fait échouer le build (`fichier de la liste blanche absent de la source`).
- **`assertNoUnverifiedAddonComponents`** ne porte plus sur toute la source mais sur la **liste blanche** : le vrai dépôt source restait constructible (il contient les composants non certifiés), et un composant non certifié ne peut plus entrer dans la liste blanche.
- **TOC `Casinobabe.toc` générée** par le builder (titre/auteur/notes/`## Version`/`## SavedVariables` BOT-WOW), ASCII et déterministe, avec auto-contrôle de cohérence (aucun fichier déclaré absent du paquet).
- **`manifest.distribution.addon`** : `folder`, `toc`, `savedVariables`, `whitelist`, `excluded` (fichier + raison), `unlisted`.
- Console de build enrichie : nombre de fichiers de la liste blanche, nombre d'exclus dont non inventoriés.

**Contrainte dure conservée : le nom du dossier et de la TOC reste `Casinobabe`.** WoW
écrit les variables sauvegardées sous le nom du `.toc` moins l'extension
(`SavedVariables/Casinobabe.lua`), et le bot livré lit exactement ce chemin
(`scripts/fishing_bot.py` : `if fn == "Casinobabe.lua"` ; `scripts/fishing_controls.py` :
`os.path.join("SavedVariables", "Casinobabe.lua")`). Renommer aurait rompu la
lecture de l'état persisté. Seul le **contenu** de la TOC est dédié BOT-WOW.

### Tests

- `tests/package-addon-install.test.mjs` (**nouveau**, 35 contrôles) : construit un
  paquet avec le **vrai** builder, extrait le ZIP dans un faux dossier WoW, puis
  charge la TOC et ses fichiers sous **Lua 5.1 réel** (wasmoon) avec un mock WoW
  original. Couvre : installation propre, structure `Interface\AddOns`, chargement
  TOC, dépendances (pas de bibliothèque externe requise, version calée sur la
  TOC), initialisation des variables sauvegardées, capture d'erreurs dans le
  gestionnaire d'événements, absence des fichiers casino, intégrité SHA-256
  (paquet **et** fichiers installés), reprise après interruption (partielle et
  totale).
- `tests/helpers/wow-mock.lua` (**nouveau**) : mock WoW original (frames,
  événements, chaîne `seterrorhandler`, `SlashCmdList`, lecture réelle des
  métadonnées d'une TOC via `__WoWMockLoadAddOn`).
- `tests/distribution-package.test.mjs` : fixtures réalistes (la source contient
  aussi casino/bibliothèques/police), section 7 réécrite (« composants non
  certifiés **exclus et déclarés**, pas refusés »), section 8 (« liste blanche
  incomplète → échec »), assertions sur la liste blanche livrée et les exclus.
- `tests/third-party-notices-shipped.test.mjs`, `tests/package-release-rights-gate.test.mjs` :
  fixtures mises à jour ; les composants nommés sont maintenant vérifiés comme
  **non livrés**.
- `package.json` : `test:package-install` + entrée ajoutée à `test` ;
  `wasmoon-lua5.1@1.18.10` en devDependency (MIT, déjà déclaré dans les notices,
  non embarqué dans le ZIP).

### Documents de distribution

- `distribution/THIRD_PARTY_NOTICES.md` : nouvelle section « Portée du paquet
  candidat », tableau de non-livraison, table d'état des droits à jour
  (DejaVu Sans : licence établie mais **non livrée** ; l'historique juridique est
  conservé).
- `distribution/INSTALL.md` : contenu du paquet documenté (liste blanche explicite,
  exclusions déclarées au manifeste).
- `PROJECT_STATE.md` : section datée ajoutée.
- `agents/locks.md` : verrou `20261110-addon-whitelist` ajouté.

## 3. Preuves directes

### Build sur la vraie source (lecture seule, sortie en temporaire)

```
node scripts/build-package.cjs --source <checkout aveca/Casinobabe> \
  --version 1.2.2-rc.1 --out <tmp> --source-repo aveca/Casinobabe \
  --source-ref feat/fishing-route-intelligence-v2 --source-commit 257418c9a0c2

Paquet construit : <tmp>\casinobabe-fishing-1.2.2-rc.1.zip
  addon     : 2 fichier(s) de la liste blanche + TOC Casinobabe.toc generee (Casinobabe/)
  exclus    : 6 fichier(s) du addon source non livres
  bot       : 16 script(s)
  provenance: verifiee contre le checkout reel
```

Contenu réel du dossier addon du paquet : `Casinobabe.toc` (359 o),
`CasinobabeFishing.lua` (57 765 o), `LiveErrorCapture.lua` (2 445 o).
Les 6 exclus déclarés avec leur raison : `Casinobabe.lua`,
`Casinobabe.toc` (remplacée), `Libs/LibDBIcon-1.0/LibDBIcon-1.0.lua`,
`Libs/LibStub/LibStub.lua`, `media/background.tga`, `media/casino_uni.ttf`.

TOC générée (réelle) :

```
## Interface: 20506
## Title: |cffFFD700BOT-WOW|r Fishing Assistant
## Notes: Observation-only fishing assistant for WoW Classic Era (20506). No input simulation, no protected action.
## Author: BOT-WOW (aveca)
## Version: 1.2.2-rc.1
## SavedVariables: CasinobabeDB, CasinobabeErrorBus
## X-Category: Miscellaneous

LiveErrorCapture.lua
CasinobabeFishing.lua
```

### Chargement réel sous Lua 5.1 (fichiers du paquet produit)

```
charge sans erreur : LiveErrorCapture.lua (2445 octets)
charge sans erreur : CasinobabeFishing.lua (57765 octets)
etat apres chargement reel : casinobabe=true fishing=true bus=true frames=0 events=0
                              LibStub=false LibDBIcon=false setFont=false db=true
Casinobabe.Fishing : [33 cles, dont Toggle, Stop, Pause, Resume, GetStatus, OnEvent,
                      ExportCSV, ExportJSON, RecordPoolEvent, ...]
commande slash exposee : /cbfish
```

Constat conforme : les deux fichiers livrés se chargent **sans aucune erreur** sous
Lua 5.1, créent leur table globale et leurs variables sauvegardées, n'exigent ni
LibStub ni LibDBIcon ni aucune police, et exposent leur commande slash. À noter
sans l'exagérer : dans le runtime réel, les événements sont enregistrés à
l'activation et non au chargement — la fixture du test, elle, enregistre au
chargement, ce qui est son contrat propre.

### Tests

```
node tests/package-addon-install.test.mjs   -> LIVRAISON ADDON : OK (35/35)
node tests/distribution-package.test.mjs    -> DISTRIBUTION : OK
node tests/third-party-notices.test.mjs     -> THIRD-PARTY NOTICE SNAPSHOT : OK
node tests/third-party-notices-shipped.test.mjs -> NOTICES LIVREES : OK
node tests/package-release-rights-gate.test.mjs -> PACKAGE RELEASE RIGHTS GATE : OK
node tests/canonical-package-digest.test.mjs -> CANONICAL DIGEST : OK
npm run validate                            -> BOT-WOW validation PASS
npm test                                    -> exit 0 (36 suites)
git diff --check                            -> aucun probleme
```

## 4. Portée respectée (aucun écart)

- Aucune modification de `PRICE_TABLE`, `RELEASE_STATUS`, du checkout public, du
  Worker, des webhooks, des secrets, de D1, de R2, du profil marchand ou des prix.
- Aucun paiement réel, aucun email client, aucune écriture R2.
- Aucun déploiement Worker ni Pages.
- La source `aveca/Casinobabe` a été lue en lecture seule ; aucune PR amont ouverte.
- Aucun composant addon supprimé sans dépendances vérifiées : chaque exclusion
  est argumentée ci-dessus et déclarée au manifeste avec sa raison.

## 5. Blocage restant et non vérifié

- **Blocage commercial restant (inchangé) :** les conditions de licence client ne
  sont pas publiées. Le build `--release` échoue toujours sur
  « Code original Casinobabe » ; le candidat reste en mode QA.
- **Non vérifié :** essai en jeu réel dans un client WoW autorisé. Le Lua 5.1 et le
  mock WoW ne sont pas le client : ils prouvent le contrat de chargement, pas le
  rendu en jeu.
- **Non vérifié :** comportement de la CI sur `wasmoon-lua5.1` (nouvelle
  devDependency) — `npm ci` est bien présent dans le job `validate` de
  `validate.yml`, mais l'exécution réelle sur runner reste à constater.
  **→ depuis vérifié : voir section 6.**

## 6. Résultat CI sur la PR #182

Commit `8315085ec60a4bb95b9359310594af5346615047`, PR <https://github.com/aveca/bot-wow/pull/182>.

| Workflow | Run | Jobs | Statut |
|---|---|---|---|
| Validate Bot-Wow | `42852227058` (code) / `42861878905` (docs) | `validate`, `package-candidate` | **success** (les deux) |
| UI quality and visual evidence | `42852227049` / `42861878985` | `ui-quality` | **failure** (échec e2e, diagnostic ci-dessous, reproductible à l'identique) |
| GitGuardian Security Checks | — | — | pass |

Reproductibilité constatée : sur le commit documentaire `dc7933a`, `validate` et
`package-candidate` repassent en success et `ui-quality` échoue avec **exactement le
même profil** (444 passed, mêmes erreurs `element(s) not found` sur
`#purchase-unavailable`). L'échec est donc déterministe et indépendant du contenu de
cette PR. Diagnostic publié en commentaire sur la PR :
<https://github.com/aveca/bot-wow/pull/182#issuecomment-6774146940>.

Le job `validate` a réellement exécuté `npm ci` (qui installe la nouvelle
devDependency `wasmoon-lua5.1@1.18.10`) puis la suite de distribution du workflow,
incluant `tests/package-addon-install.test.mjs` : `LIVRAISON ADDON : OK`. Le point
« CI de la nouvelle devDependency » est donc **directement vérifié**.

### L'échec `ui-quality` ne vient pas de cette PR

L'échec porte sur 52 tests e2e, tous sur `buy.html` : `#purchase-unavailable`
introuvable (ex. `checkout-flow.spec.mjs:25`, `accessibility.spec.mjs:59`).
Diagnostic établi, avec preuves :

1. Le workflow fait `actions/checkout` de **`refs/pull/182/merge`**, pas de la tête
   de branche. La fusion testée est `6729fcc9c0f46378b0143efbff06e34719400087`.
2. `5145b9d feat(storefront): open €20 manual beta reservation` (poussé sur `main`
   à 15:04Z, **après** la base `5861b03` de cette branche) **est un ancêtre de cette
   fusion** (`git merge-base --is-ancestor 5145b9d 6729fcc` → oui).
3. Dans la fusion, `buy.html` ne contient plus `#purchase-unavailable`
   (`git show 6729fcc:buy.html` → 0 occurrence), alors qu'il est présent dans le
   `buy.html` de la tête de branche (`8315085`).
4. `5145b9d` a modifié `buy.html`, `index.html`, `faq.html`, `legal/*` et des tests
   unitaires (`action-bar`, `conversion-path`, `release-availability`,
   `site-artifact`) mais **pas** `tests/e2e/*.spec.mjs`, qui continuent d'attendre
   l'état « Purchase unavailable ».
5. Preuve contraire : sur la tête de branche locale `8315085`,
   `npx playwright test tests/e2e/checkout-flow.spec.mjs --project=desktop -g
   "email collection (en)"` → **1 passed**.
6. Contrôle comparatif : la fusion de la PR #179 (`02da1f6`, créée à 10:31Z) ne
   contient pas `5145b9d`, son `buy.html` contient encore `#purchase-unavailable`, et
   son `ui-quality` passe.

Conclusion : l'échec est un **défaut préexistant de `main`** (le commit storefront a
changé l'état de la page d'achat sans mettre à jour les specs e2e correspondantes),
révélé parce que la fusion de cette PR est récente. Aucun fichier HTML, e2e ou asset
n'est touché par cette PR. La correction (aligner
`tests/e2e/{checkout-flow,accessibility,responsive,i18n,demo-quality}.spec.mjs` sur
le nouvel état de la page d'achat, ou rétablir l'état fermé) sort du périmètre de
cette mission et demande une décision produit.

## 7. Recouvrement avec la PR #179 et prochaine action

- **Recouvrement de fichiers avec la PR #179** (`feat/package-self-verification-20261110`,
  ouverte) : `scripts/build-package.cjs`, `distribution/INSTALL.md` et
  `package.json` sont touchés des deux côtés. Les périmètres ne se recouvrent pas
  (vérification d'intégrité côté client vs liste blanche/TOC/livraison réelle), mais
  une résolution de conflit sera nécessaire au merge — signalé dans la PR.

## 8. Prochaine action

Trancher le blocage de licence client (conditions destinées au client) — c'est le
seul élément qui empêche encore de transformer un paquet QA en paquet distribuable.
Séparément, et hors périmètre de cette mission : aligner les specs e2e sur le nouvel
état de la page d'achat issu de `main` (défaut préexistant, section 6).
