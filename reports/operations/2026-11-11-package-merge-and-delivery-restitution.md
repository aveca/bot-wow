# 2026-11-11 — Mission P0 « packaging BOT-WOW livrable » : fusions #179 / #185 / #186, restitution de la couverture, nouveau paquet réel mesuré

MISSION : finaliser le packaging BOT-WOW et préparer une livraison commerciale réellement utilisable (aucun paiement ouvert, aucun checkout touché)
REPOSITORY : aveca/bot-wow (source runtime : aveca/Casinobabe@b625ccec5fd61225dd92c5c54fa8721da76c3876, lecture seule)
FINAL MAIN SHA : `0774272320a0f811d7cba56cd8def120497d7f6d`
DATE : 2026-11-11 (cycle 00:39Z → 01:10Z UTC)

## 1. PR fusionnées

| PR | Objet | Commit de fusion (squash) | Fusionné à | CI |
|---|---|---|---|---|
| [#179](https://github.com/aveca/bot-wow/pull/179) | Vérificateur d'intégrité côté client (`distribution/verify-package.py`), embarqué par le builder dans `package/` ; SHA-256, inventaire ZIP, refus des chemins dangereux et des symlinks, refus d'un paquet QA par défaut, `--allow-qa` qui n'autorise jamais une release | `aa02ad3caf8423b1ab32b1392b07aa3e82c377b0` | 2026-11-11T00:39:36Z | verte |
| [#185](https://github.com/aveca/bot-wow/pull/185) | Guide d'installation réconcilié avec le builder et le vérificateur | `4a3b657a8d059abc378762cd9f87daa5de30e93c` | 2026-11-11T00:51:39Z | 4 contrôles verts |
| [#186](https://github.com/aveca/bot-wow/pull/186) | Restitution de la couverture de livraison réelle et du contrôle des fichiers addon inconnus | `0774272320a0f811d7cba56cd8def120497d7f6d` | 2026-11-11T01:05:37Z | 4 contrôles verts |
| [#184](https://github.com/aveca/bot-wow/pull/184) | (fusionnée la veille) Liste blanche addon, TOC générée, tests installation/activation | `fca79c2…` | 2026-11-10 | verte |
| [#182](https://github.com/aveca/bot-wow/pull/182) | **fermée sans fusion** par le propriétaire — voir §2 | — | — | — |

Ordre de fusion imposé par la cohérence documentaire : **#179 (code + vérificateur) AVANT #185 (guide)**, car le guide décrit `package/verify-package.py`, fichier qui n'existait pas avant #179. Fusionner #185 d'abord aurait publié un guide décrivant un fichier absent de l'arbre.

## 2. Fermeture de la PR #182 et restitution de la couverture

La PR #182 a été fermée sans fusion. Son contenu utile n'a pas été perdu :

| provenance #182 | repris par |
|---|---|
| liste blanche addon, TOC `Casinobabe.toc` déterministe, exclusions déclarées, refus release des fichiers inconnus, tests Lua 5.1, droits/provenance | **#184** (`fca79c2`) |
| documents (`INSTALL.md`, `THIRD_PARTY_NOTICES.md`) | **#185** (`4a3b657`) |
| vérificateur d'intégrité client | **#179** (`aa02ad3`) |
| `tests/package-addon-delivery.test.mjs` (35 contrôles) + contrôle `Unexpected.lua` du droits-gate | **#186** (`0774272`) — ne venait d'aucune autre PR |

Vérification directe de la couverture effectivement perdue par la fermeture de #182 (sur `main` `4a3b657`, avant #186) :

```
ABSENT   tests/package-addon-delivery.test.mjs
PRESENT  tests/helpers/package-fixture.mjs
PRESENT  tests/helpers/package-zip.mjs
PRESENT  tests/helpers/wow-mock.lua
PRESENT  scripts/verify-bot-files-closure.mjs
```

et le droits-gate de `main` ne comptait que **8** contrôles (9 après restitution, le 9e étant le contrôle du fichier inconnu).

### Restitution — méthode

Branche **neuve** `p0/package-delivery-coverage-20261111` créée depuis `main` `4a3b657`, dans un worktree dédié (`C:\factory\worktrees\bot-wow-delivery`). La branche fermée `p0/package-whitelist-toc-20261110` **n'a jamais été réutilisée** : ses fichiers ont été relus avec `git checkout <fermée> -- <fichiers>`, puis **vérifiés blob par blob** identiques à la source avant commit.

```
$ git -C ... rev-parse "p0/package-whitelist-toc-20261110:tests/package-addon-delivery.test.mjs"
4ca3acbb4d8d558cdaa3ddddf408af4e2532bb14
$ git -C ... hash-object tests/package-addon-delivery.test.mjs
4ca3acbb4d8d558cdaa3ddddf408af4e2532bb14      # identique
```

### Restitution — contenu (commit `1fdd88403ee96726a8e4b1d87c926a5b37034aff`, 4 fichiers, +486 / −3)

| fichier | apport |
|---|---|
| `tests/package-addon-delivery.test.mjs` | **nouveau** — 35 contrôles. Seule suite qui ne simule pas une installation : elle construit un paquet avec le **vrai** builder, l'extrait dans un faux dossier WoW, puis charge la TOC générée et chacun de ses fichiers sous Lua 5.1 (wasmoon). Couvre : arborescence `Interface\AddOns\Casinobabe`, liste blanche exacte, absence de `LibStub`/`LibDBIcon`/police/texture casino, initialisation des variables sauvegardées, déclenchement des événements, capture des erreurs par le bus, intégrité SHA-256 de chaque fichier du manifeste, reprise après installation interrompue. |
| `tests/package-release-rights-gate.test.mjs` | +7 lignes : semence `Unexpected.lua` (fichier addon inconnu de la source) + contrôle « exclu du paquet **et** déclaré dans les droits non résolus ». Aucune suppression silencieuse. |
| `tests/helpers/wow-mock.lua` | +19 lignes : `GetAddOnMetadata` répond les métadonnées de la TOC **réellement chargée** via `__WoWMockLoadAddOn`. Hors appel explicite, comportement **identique** à `main` (`nil`) : le contrat existant (`version == 'fixture'` de `package-addon-activation.test.mjs`) est préservé. |
| `package.json` | script `test:package-delivery` + insertion de `node tests/package-addon-delivery.test.mjs` dans la chaîne `npm test`, **après** `package-addon-activation`. Aucune entrée supprimée : `package-integrity-verifier` (PR #179), `package-addon-install`, `package-addon-activation`, `package-release-rights-gate`, `third-party-notices-shipped`, `canonical-package-digest` et toutes les autres sont conservées. Vérifié par script : `dropped: aucun`. |

### Restitution — vérifications réelles (worktree dédié, `npm ci` exécuté)

| commande | résultat |
|---|---|
| `node tests/package-addon-delivery.test.mjs` | exit 0 — `LIVRAISON ADDON : OK` (35/35) |
| `node tests/package-release-rights-gate.test.mjs` | exit 0 — `PACKAGE RELEASE RIGHTS GATE : OK` (9/9, dont le contrôle du fichier inconnu) |
| `npm run validate` | exit 0 — `BOT-WOW validation PASS` |
| `npm test` | exit 0 (livraison, installation, activation, intégrité, droits, notices, paiement, checkout, migrations, agent-state, autopilot) |
| `git diff --check` ; `git diff --cached --check` | 0 |

## 3. Résolution du conflit de la PR #185

`distribution/INSTALL.md` était en conflit (`UU`) après la fusion de #179. Résolution par **merge**, jamais par rebase ni force-push : les trois commits d'origine de la branche (`8bffd2a`, `b66c2d2`, `e3f91ef`) restent ancêtres du résultat (`git merge-base --is-ancestor e3f91ef HEAD` → exit 0).

Résolution retenue :

- **orthographe** : `Casinobabe` (côté PR #185) est conservé aux 3 occurrences ; la faute `Casinababe` introduite par le côté `main` (PR #179, non relue) est corrigée, car le builder écrit réellement dans `addon/Casinobabe` (`ADDON_DIR = 'Casinobabe'` dans `scripts/build-package.cjs`) et le document doit nommer le vrai dossier.
- **ajout documentaire** (hors conflit) : `verify-package.py` figure désormais dans l'arbre « Contenu du paquet ». Le builder l'embarque dans `package/` et le déclare au `MANIFEST.json` ; son absence rendait le guide incomplet par rapport au paquet réellement livré.
- le reste est une union sans marqueur. Aucune protection, aucun avertissement, aucune limite assumée du manifeste non signé supprimés.

Contrôles après résolution : 0 marqueur de conflit, 0 occurrence de `Casinababe`, 11 occurrences de `Casinobabe`, `verify-package.py` listé lignes 24 et 55.

Commit de merge `4f1cbef3d0d6b9a92ff5cd05a69c2abe038cedc1`, poussé en **fast-forward** (`e3f91ef..4f1cbef`) sur `fix/issue82-docs-after-merge-20261111`. Vérifications réelles dans ce worktree : `npm ci` exit 0, `npm run validate` PASS, `npm test` exit 0, `git diff --check` 0.

## 4. Paquet réel construit depuis le `main` final

**Source épinglée** : `aveca/Casinobabe@b625ccec5fd61225dd92c5c54fa8721da76c3876` (branche `feat/fishing-route-intelligence-v2`), checkout local détaché **propre** `C:\factory\worktrees\casinobabe-pin`, origine GitHub, jamais modifié.

**Builder** : `main` `0774272`, worktree détaché `C:\factory\worktrees\bot-wow-build`.

Commande exacte (exécutée deux fois) :

```
node scripts/build-package.cjs --source C:\factory\worktrees\casinobabe-pin --version 1.2.2-rc.1 --out %TEMP%\pkg-<first|second> --source-repo aveca/Casinobabe --source-ref feat/fishing-route-intelligence-v2 --source-commit b625ccec5fd61225dd92c5c54fa8721da76c3876
```

### Mesure

| grandeur | valeur |
|---|---|
| SHA-256 du ZIP | `7d48c2496c83bbdf12e2beac6aab42d5ba66b7fb3bb65725c746b1c10d89f335` |
| Taille | 180 805 octets |
| Entrées ZIP | 26 |
| Entrées manifeste (SHA-256) | 25 |
| Reproductibilité | deux builds **byte-identiques** (même SHA-256) |
| Version | `1.2.2-rc.1` |
| Contenu addon | 2 fichiers liste blanche + `Casinobabe.toc` générée (dossier `Casinobabe/`) |
| Scripts Python | 16 (= fermeture BFS = `BOT_FILES`) |
| Fichiers du dossier addon source déclarés exclus | 3 |
| Provenance | vérifiée contre le checkout réel |

### Contenu du ZIP (26 entrées)

```
MANIFEST.json
VERSION
package/INSTALL.md
package/THIRD_PARTY_NOTICES.md
package/config.example.json
package/requirements.txt
package/verify-package.py
package/addon/Casinobabe/Casinobabe.toc
package/addon/Casinobabe/CasinobabeFishing.lua
package/addon/Casinobabe/LiveErrorCapture.lua
package/scripts/fishing_bot.py
package/scripts/fishing_client.py
package/scripts/fishing_controls.py
package/scripts/fishing_map.py
package/scripts/fishing_mapread.py
package/scripts/fishing_memory.py
package/scripts/fishing_minimap.py
package/scripts/fishing_navigation.py
package/scripts/fishing_observer.py
package/scripts/fishing_popup.py
package/scripts/fishing_process.py
package/scripts/fishing_recovery.py
package/scripts/fishing_safety.py
package/scripts/fishing_screen.py
package/scripts/fishing_spots.py
package/scripts/focus_broker.py
```

Inventaire contrôlé : **aucun** `Casinobabe.lua`, **aucun** `LibStub`, **aucun** `LibDBIcon`, **aucun** `.ttf`, **aucun** `.tga`.

### TOC générée

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

### Pourquoi cette mesure diffère de `14beafc7…` (176 903 o)

Le builder livré dans `main` embarque désormais `package/verify-package.py` (apporté par #179) et le déclare au manifeste. L'archive ne peut donc plus être identique à l'ancienne. Aucune réécriture d'historique : la nouvelle valeur est publiée telle quelle, l'ancienne reste dans les rapports datés `2026-11-10`.

## 5. Vérifications du paquet réel

Toutes exécutées localement sur les octets réellement produits (réplique exacte du job CI `package-candidate`).

| # | contrôle | commande / méthode | résultat |
|---|---|---|---|
| 1 | double build byte-identique | 2 × `build-package.cjs` | SHA-256 égaux → **OUI, byte-identique** |
| 2 | archive | `node scripts/verify-package-archive.cjs <zip> 1.2.2-rc.1 b625ccec…` | `PACKAGE ARCHIVE: PASS` (version, source, 26 entrées, 25 manifeste, 180 805 o, SHA-256) |
| 3 | fermeture Python | `node scripts/verify-bot-files-closure.mjs --manifest …/MANIFEST.json --scripts-dir <source>/scripts` | PASS (16 = 16) |
| 4 | vérificateur client, paquet QA | extraction réelle puis `py -3 package/verify-package.py --allow-qa` | `PACKAGE INTEGRITY OK — QA ONLY; not authorized for customer distribution (unresolved rights: 2).` exit 0 |
| 5 | vérificateur client, refus par défaut | `py -3 package/verify-package.py` | `PACKAGE VERIFICATION FAILED: QA-only package; refusing installation without --allow-qa` → **exit 1** (fail-closed) |
| 6 | droits du candidat | assertion sur `MANIFEST.json` | `mode = qa`, `eligible = false`, provenance exacte, `unresolvedComponents = ["Code original Casinobabe","Police DejaVu Sans"]` |
| 7 | verrou de release | `build-package.cjs … --release` contre la vraie source, sentinelles pré-positionnées | **exit 1** — `ECHEC D'INTEGRITE — paquet non construit : release refusée : 2 exigence(s) non satisfaite(s) (Code original Casinobabe, Police DejaVu Sans) ; aucun artefact existant ne sera supprimé et aucune archive ne sera produite`. Sentinelles préservées : `KEEP PACKAGE`, ZIP de 8 octets intact. |

Exclusions déclarées au manifeste (`distribution.addon.excluded`) :

| fichier | raison |
|---|---|
| `Casinobabe.lua` | interface casino historique : 0 référence au module pêche et 0 symbole exporté utilisé par lui (vérifié sur le commit source) ; non requis |
| `Casinobabe.toc` | TOC du addon casino : remplacée par la TOC BOT-WOW générée par ce builder |
| `media/casino_uni.ttf` | police DejaVu Sans : 0 `SetFont` / 0 `ttf` dans le module pêche (vérifié) ; non requise par le paquet BOT-WOW |

Variables sauvegardées : `CasinobabeDB`, `CasinobabeErrorBus`.

## 6. Documents commerciaux encore à écrire (inventaire, sans rien inventer)

Le paquet technique est prêt. Ce qui manque pour une livraison commerciale est **documentaire et décisionnaire** — rien n'est rédigé ici, aucun contenu n'est inventé :

| document | état | pourquoi c'est nécessaire |
|---|---|---|
| Conditions de licence client (CLUF) | **absent** | seule chose qui ouvre `--release` aujourd'hui |
| Droits de redistribution du runtime `aveca/Casinobabe` | **non documentés** (bloqueur `B-licence`, déjà ouvert) | `unresolvedComponents` cite « Code original Casinobabe » |
| Statut de la police DejaVu Sans | **non résolu** | seconde exigence non satisfaite du verrou `--release` ; la police n'est **pas** distribuée dans le paquet (whitelist addon = 2 `.lua` + TOC), il faut donc décider d'une mention ou d'une substitution |
| Identification du vendeur / entité | **absente** | mention légale obligatoire côté acheteur |
| Périmètre d'installation / désinstallation | partiel (`INSTALL.md` décrit l'installation) | aucune procédure de désinstallation documentée |
| Support et conditions de remboursement | **absents** | lié au prix/checkout, hors périmètre autorisé ici |

Ces points relèvent de la décision propriétaire ; aucun n'a été rédigé dans ce cycle.

## 7. Hors périmètre vérifié — limites honnêtes

- **Non vérifié : exécution dans un véritable client WoW autorisé.** Les tests Lua 5.1 (wasmoon) chargent les octets réels du paquet, mais ils ne prouvent pas l'activation côté client Blizzard.
- **Non reproductible avec le checkout local courant** : avec le checkout local `aveca/Casinobabe` à `257418c9` (en avance sur le `main` distant de la branche source), `verify-package-archive.cjs` et `verify-bot-files-closure.mjs` échouent (20 modules vs 16 scripts embarqués). L'écart vient du checkout local, pas du code ; la mesure de référence est `7d48c249…`, produite depuis `b625ccec` avec le builder final.
- **Aucune ouverture de vente** : aucun prix, aucun Payment Link, aucune touche Stripe/Mollie, aucun Worker, aucun webhook, aucun secret, aucune variable sensible, aucune écriture D1 ou R2, aucun profil marchand, aucun paiement, aucun remboursement, aucun e-mail commercial. `aveca/Casinobabe` lu en lecture seule.
- Un déploiement applicatif n'aurait pas dû être déclenché par ce commit documentaire : `PROJECT_STATE.md` et `agents/**` ne sont jamais publiés sur Pages (`scripts/build-site.mjs` : `FILES` + `DIRS = assets, docs, legal, fr`). `pages.yml` porte donc désormais `PROJECT_STATE.md` et `agents/**` dans `paths-ignore` (ajout minimal, aligné sur la règle déjà présente pour `AGENTS.md` et `reports/**`). La CI utile (`validate.yml`, `ui-quality.yml`) reste entièrement déclenchée.

## 8. Prochaine action

Une seule, et elle est au propriétaire : **trancher les droits de redistribution du runtime et publier les conditions de licence client**. Ce sont elles — et seulement elles — qui ouvrent `--release`. Aucune action technique supplémentaire n'est requise pour rendre le paquet livrable : il est construit, reproductible, inventorié et vérifiable de bout en bout par le client.

Ensuite, et seulement après autorisation : test d'activation dans un vrai client WoW, puis décision d'écriture R2 pour publier l'artefact `7d48c249…`.
