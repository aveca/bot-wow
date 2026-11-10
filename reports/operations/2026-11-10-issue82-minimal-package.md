# 2026-11-10 — issue factory-control#82 : paquet Fishing Assistant minimal (liste blanche + tests installation/activation)

MISSION : paquet QA minimal Fishing Assistant avec dépendances réelles prouvées (aucune ouverture de vente)
REPOSITORY : aveca/bot-wow (source runtime : aveca/Casinababe@b625ccec5fd61225dd92c5c54fa8721da76c3876, lecture seule)
BRANCH : factory/issue82-mwaoy17i
JOB : job-issue82-mwaoy17i
PR : https://github.com/aveca/bot-wow/pull/184 (PAS de fusion — revue requise)

## 1. Analyse de fermeture sur les octets épinglés (lecture seule)

Checkout détaché `C:\factory\worktrees\casinobabe-pin` @ `b625ccec…` (« fix(addon): remove unverified third-party runtime assets »).

- Contenu source exact : `Casinobabe.lua`, `Casinobabe.toc`, `CasinobabeFishing.lua`, `LiveErrorCapture.lua`, `media/casino_uni.ttf` (Libs/* et background.tga déjà supprimés par le commit épinglé lui-même).
- 0 occurrence de `LibStub`/`LibDBIcon`/`SetFont`/`.ttf` dans les deux fichiers whitelistés (findstr direct).
- Les 20 appels globaux `G("…")` du module pêche = API WoW uniquement (GetZoneText, PlaySound, GetSpellInfo, CombatLogGetCurrentEventInfo, UnitName, GetAddOnMetadata, StaticPopup_Show, GetItemCount, GetInventoryItemLink, GetItemInfo, GetWeaponEnchantInfo, GetProfessions/Info, GetSubZoneText, InCombatLockdown, C_Timer) — aucune fonction du core casino → aucun shim nécessaire.
- Chaîne d'erreurs : `LiveErrorCapture.lua` capture `geterrorhandler()` puis installe le sien SEULEMENT si un précédent existe (ligne 69) ; `CasinobabeFishing.lua` ne remplace le sien qu'en cas d'échec d'init (lignes 1399-1410) et délègue au précédent — l'ordre TOC `[LiveErrorCapture.lua, CasinobabeFishing.lua]` est nécessaire et est celui du builder.
- Fermeture Python (BFS depuis `fishing_bot.py`, imports indentés try/except « jamais bloquants » inclus) = **16 modules** : fishing_bot, fishing_client, fishing_controls, fishing_map, fishing_mapread, fishing_memory, fishing_minimap, fishing_navigation, fishing_observer, fishing_popup, fishing_process, fishing_recovery, fishing_safety, fishing_screen, fishing_spots, focus_broker — **égale à BOT_FILES** : rien à corriger, la liste est fermée.

## 2. Builder whitelisté (PR #184)

- Whitelist `[LiveErrorCapture.lua, CasinobabeFishing.lua]` + TOC BOT-WOW **générée** (Interface 20506, SavedVariables `CasinobabeDB, CasinobabeErrorBus`) ; le .toc casino n'entre jamais (chargé `Casinobabe.lua` + Libs non livrés).
- Exclusions déclarées au manifeste (`distribution.addon.excluded`) : core casino (0 référence au module pêche), TOC casino, Libs, police tierce (0 SetFont).
- Fail-closed whitelist : fichier non inventorié → QA : exclu + déclaré (`excluded` + `unlisted` + `unresolvedComponents`) ; `--release` : REFUS, aucun artefact supprimé.
- Correction d'un bug réel exposé par le nouveau test : `unresolvedRights.push()` exécuté avant la déclaration `const` (TDZ) dès qu'un fichier non inventorié existait — le build crashait au lieu de flager.

## 3. Tests (PR #184)

- `tests/package-addon-install.test.mjs` — 19 contrôles (whitelist exacte, exclusions, bijection TOC↔Lua, ordre, en-tête TBC + SavedVariables, chemins sûrs, SHA-256 manifeste↔octets, provenance réelle + `overridesChecked`, fail-closed QA/release).
- `tests/package-addon-activation.test.mjs` — activation réelle sous wasmoon-lua5.1 (Lua 5.1) + `tests/helpers/wow-mock.lua` : fixtures toujours ; octets réels via `BOTWOW_PACKAGE_FIXTURE` (sinon SKIP visible, jamais compté). Charge les octets réels dans l'ordre TOC sans erreur ; LEC remplace le handler de base ; init OK → handler LEC préservé ; sonde « probe activation Casinobabe » capturée par le BUS réel ; `/cbfish` + frame `Casinobabe_FishingEvents` (PLAYER_LOGIN/LOOT_OPENED).
- `scripts/verify-bot-files-closure.mjs` (câblé dans le job `package-candidate` après le premier build) : MANIFEST scripts == fermeture BFS. PASS réel (16=16) ; fail-closed prouvé dans les deux sens (module mort + module manquant).
- Helpers partagés (`tests/helpers/package-zip.mjs`, `package-fixture.mjs`) ; `distribution-package`, `package-release-rights-gate`, `third-party-notices-shipped` adaptés au contrat whitelist sans affaiblir les garde-fous (symlinks toujours refusés via `walk()` ; `--release` toujours refusé ; préflight préserve l'existant).

## 4. Preuves locales réelles (commandes exactes)

| Commande | Résultat |
|---|---|
| `node scripts\build-package.cjs --source C:\factory\worktrees\casinobabe-pin --version 1.2.3-wl.1 --out …\wl-first` (×2, wl-second) | 2 fichiers addon + TOC générée, 16 scripts, 3 exclusions déclarées, provenance vérifiée |
| SHA-256 des deux ZIP | `48818cebdde8518d5f056d441d2704dd60a809685a362b9976e88998273d0c89` = **byte-identiques** (176 892 octets) |
| `node scripts\verify-package-archive.cjs …\wl-first\casinobabe-fishing-1.2.3-wl.1.zip 1.2.3-wl.1 b625ccec…` | **PASS** (25 entrées, 24 SHA-256) |
| `node scripts\build-package.cjs … --release` | **REFUSÉ** (« Code original Casinobabe »), sentinelles préservées |
| `node scripts\verify-bot-files-closure.mjs --manifest <MANIFEST réel> --scripts-dir <pin>/scripts` | **PASS** (16 scripts = fermeture BFS 16 modules) |
| `BOTWOW_PACKAGE_FIXTURE=<ZIP réel> node tests\package-addon-activation.test.mjs` | **17/17 OK** (dont 10 contrôles sur octets réels) |
| `BOTWOW_PACKAGE_FIXTURE=<ZIP réel> BOTWOW_PACKAGE_KEY=casinobabe-fishing-1.2.0.zip node tests\delivery-replay.test.mjs` | **LIVRAISON REPRISE : OK** — SHA-256 livré == ZIP exact, une licence/un jeton/un reçu |
| `npm run validate` | **PASS** |
| `npm test` (chaîne complète, 30 suites) | **PASS** |

## 5. CI

Job `package-candidate` (validate.yml) : double-build sur la source épinglée + verify-package-archive + asserts droits fail-closed + **nouvelle étape fermeture** + gate `--release` refusé + `cmp` byte-identique + delivery-replay avec le ZIP réel. Lien d'exécution et SHA exacts : voir commentaire RESULT sur factory-control#82.

## 6. Limites (NON VÉRIFIÉ)

- L'activation « réelle » est une activation HORS CLIENT : Lua 5.1 réel (wasmoon) + mock WoW fidèle, pas le client TBC. Elle prouve le contrat de chargement, pas le comportement en jeu.
- La fermeture Python est statique (BFS d'imports) ; aucune exécution du bot Python n'est faite.
- `BOTWOW_PACKAGE_FIXTURE` absent en CI → les 10 contrôles d'octets réels ne s'exécutent pas dans le job `validate` standard (SKIP visible) ; la preuve réelle locale est liée ci-dessus.

## 7. Interdictions tenues

Aucun paiement/prix/checkout/Worker/secret/R2 modifié ; `--release` continue d'échouer ; vitrine « achat indisponible » inchangée (tests release-availability/storefront PASS) ; source Casinababe jamais écrite ; aucune fusion ni déploiement.
