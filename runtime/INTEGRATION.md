# Runtime Casinobabe — intégration BOT-WOW

> **Mise à jour 2026-11-07T22:58Z** — le paquet est désormais **reproductible au bit**
> (build déterministe côté BOT-WOW, SHA-256 et empreinte canonique du contenu),
> et l'écart avec l'objet R2 live est **quantifié fichier par fichier**.
> Rapport complet : `reports/operations/2026-11-07-runtime-provenance-reproducible-package.md`.
> Périmètre du runtime : **pêche uniquement** — aucun runtime Gold/PvP/XP n'existe
> (voir `docs/historical-runtime-absence-20261106.md`).

## Source identifiée (section P0-2)

| Champ | Valeur | Preuve |
|---|---|---|
| Dépôt source | https://github.com/aveca/Casinobabe | remote `origin` du worktree `casinobabe-v2` |
| Branche de référence | `feat/fishing-route-intelligence-v2` | `origin/feat/fishing-route-intelligence-v2` |
| Commit de référence | `257418c9a0c2c489a01226e8065ac9c8eaded954` | identique local et distant |
| Date du commit source | `2026-10-22T02:18:01Z` | `git show -s --format=%cI` |
| Produit | Casinobabe-Fishing-Assistant 1.2.0 | `dist/VERSION` |
| Interface WoW | `20506` (Classic Era / Anniversary) | `runtime-addon/Casinobabe/Casinobabe.toc` |
| Correspondance BOT-WOW | Oui — Classic Era 1.13 | PRODUCT.md §29, INSTALL.md §2 |
| Licence | **aucune** — ni `LICENSE`, ni `COPYING`, ni `NOTICE` dans le commit ; `license: null` côté API GitHub | **[vérifié le 2026-11-07]** |

> **Droits de distribution non établis.** L'absence de licence dans le dépôt
> source ne signifie pas « libre de droits » : elle signifie que **les droits
> de redistribution ne sont pas documentés**. Aucune copie de ce runtime ne
> doit être vendue avant que le propriétaire n'explicite cette autorisation.

## Paquet distribuable (R2)

| Champ | Valeur |
|---|---|
| Clé R2 cible | `casinobabe-fishing-1.2.0.zip` (`wrangler.toml` var `R2_OBJECT_KEY`, ligne 69) |
| Bucket | `botwow-binaries` (binding `R2_BINARIES`) |
| SHA-256 (reproductible, build BOT-WOW) | `F8138F3C52EB2498114AD5BCD3988DB39A105BD4B757646BF1C2B7548DA79781` |
| Taille (reproductible) | 1 344 366 octets — 17 entrées ZIP, 16 entrées de manifeste |
| Empreinte canonique du contenu | `f69be8b34f74b2df68a177e0210b9bd73f6c99452c9279c291f2961173c90a53` (17 fichiers, 3 004 035 octets) |
| SHA-256 (build python d'origine, **non reproductible**) | `4FB2D1C1…` / `D225E63F…` / `9FC19FEE…` selon le build |
| SHA-256 (objet R2 live, état non commité) | `1C132F367607EA186FEFFDE8BBDA0A1A9F94CDEC4B7850B93C57C271270BBA4F` |
| Taille (objet R2 live) | 1 387 543 octets — 30 entrées |

### État R2 et configuration live — vérifié le 2026-11-07

L'objet `casinobabe-fishing-1.2.0.zip` **est déjà présent** dans le bucket `botwow-binaries` :
- taille : **1 387 543 octets** ;
- dernière modification : `2026-10-27T06:31:06.784Z` ;
- SHA-256 recalculé sur les octets téléchargés : `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f`.

Le Worker `botwow-api` v52 (version `054cd158-4be2-42f8-92a6-ff9c4f059079`, 100 % du trafic au contrôle) utilise `R2_OBJECT_KEY=casinobabe-fishing-1.2.0.zip` avec le bucket `R2_BINARIES`. Aucune valeur de secret n'a été lue et aucun objet R2 n'a été modifié.

**Conséquence :** le fichier actuellement configuré est l'ancien build avec modifications locales non commitées, pas le build propre reproductible ci-dessus. La présence de l'objet ne certifie donc pas la distribution du build propre. Son remplacement nécessiterait une écriture R2 explicitement autorisée.

### Écart mesuré entre l'objet R2 live et la source committée

Comparaison fichier par fichier de l'objet R2 live avec le commit `257418c`
(outils : `scripts/canonical-package-digest.mjs` + comparaison SHA-256 directe) :

| Mesure | Valeur |
|---|---|
| Fichiers de l'objet R2 live | 30 |
| Fichiers **identiques** au commit `257418c` | **20** |
| Fichiers **différents** du commit `257418c` | **6** — `fishing_assistant_app/fishing_assistant.py`, `scripts/fishing_bot.py`, `scripts/fishing_controls.py`, `scripts/fishing_minimap.py`, `scripts/fishing_navigation.py`, `scripts/focus_broker.py` |
| Fichiers livrés **absents** du commit `257418c` | **3** — `Lancer-Casinobabe-Fishing-Assistant.bat`, `restaurer_previous.ps1`, `VERSION` |
| Fichiers livrés **hors manifeste** de l'objet live | **3** — les deux exécutables ci-dessus + `VERSION` |
| Empreinte canonique de l'objet live | `fc9a1e0aa04059eb5ff433661afc23cea360fa771146b88972222d36d564f160` (3 174 481 octets) |

→ L'objet R2 live **n'est pas reproductible** depuis un état committé : il contient
du code modifié non commité **et** deux exécutables qui ne sont ni dans la source
ni dans son propre manifeste. Sa provenance n'est pas établie. Son remplacement
exige une **écriture R2 explicitement autorisée** (interdite par `AGENTS.md`).

## Procédure de build (reproductible) — build déterministe BOT-WOW

Depuis un checkout propre de `aveca/Casinobabe` à `257418c` :

```bash
node scripts/build-package.cjs --source <checkout-casinobabe> --version 1.2.0 --out dist
```

Produit : `dist/casinobabe-fishing-1.2.0.zip` + `MANIFEST.json` (SHA-256 par
fichier + **provenance** dépôt/ref/commit) + `VERSION`.

Déterminisme obtenu (le build d'origine ne l'était pas) :
- `builtAt` = `SOURCE_DATE_EPOCH`, sinon la **date du commit source**
  (`2026-10-22T02:18:01.000Z`) — jamais l'heure de la machine ;
- tri des fichiers **byte-stable** (plus de `localeCompare`) ;
- clés du manifeste **triées** ;
- fins de ligne des fichiers texte **normalisées en LF** (le checkout CRLF ou LF
  ne change plus l'octet livré) ;
- provenance inscrite dans le manifeste (`source.repository`, `source.ref`,
  `source.commit`).

Preuves de reproductibilité (2026-11-07) :

| Mesure | Résultat |
|---|---|
| Deux builds consécutifs, même source | SHA-256 **identique** `F8138F3C…`, octets identiques |
| Build depuis un checkout **CRLF** | SHA-256 **identique** `F8138F3C…` (1 344 366 octets) |
| Build après retour du checkout en **LF** | SHA-256 **identique** `F8138F3C…` |
| Empreinte canonique du contenu (2 builds) | `f69be8b3…` **identique** |
| Intégrité manifeste → contenu livré | `ok` (0 écart, 0 fichier hors manifeste, 0 fichier déclaré manquant) |

### Build d'origine (python) — mesuré NON reproductible

`python scripts/build_desktop_package.py --version 1.2.0 --out dist` (dépôt
source, **lecture seule**) :

| Build | `builtAt` inscrit | SHA-256 |
|---|---|---|
| #1 | `2026-11-07T19:06:24` | `D225E63FE611690C71C705283F1BF77CDA04891E9A9C1C13C06D02CC380300F6` |
| #2 | `2026-11-07T19:06:28` | `9FC19FEEBE69EBD55A10B4806C6A916C77F6E36566C74A4D70EE1C3509326FA1` |

Les SHA-256 par fichier sont **identiques** dans les deux manifests : la seule
différence est l'horodatage `builtAt`. Deux builds de la même source ne sont donc
**pas** interchangeables, et le SHA-256 du ZIP ne peut pas servir de référence de
provenance. C'est ce que le build déterministe de BOT-WOW corrige (le dépôt
source reste en lecture seule : aucune modification n'y a été faite).

### Vérification d'un paquet livré

```bash
node scripts/canonical-package-digest.mjs <dossier du paquet> --json
```

L'outil calcule l'empreinte **canonique du contenu** (chemin + SHA-256 + taille,
triés) — indépendante du ZIP, de ses horodatages et de son ordre — et contrôle
l'intégrité `MANIFEST.json` ↔ contenu livré (fichiers déclarés absents, fichiers
livrés hors manifeste, écarts de hash). Code de sortie `1` si l'intégrité est
rompue. Il n'écrit rien.

## Tests du runtime (réels, pas de simulation)

| Suite | Résultat |
|---|---|
| `tests/test_fishing_bot_contract.py` | 24 ok / 0 échec |

Couvre : détection flotteur (eau diurne + nocturne), garde "pas d'eau pas de lancer", cheveux rouges / leurres écartés, signaux de morsure, clics différés et reprise, contrat des logs (champs obligatoires), protection contre les doubles instances.

## Statut

Le runtime source est identifié et auditable. Au moins une fonction (pêche) est réellement testée. Le paquet est **reproductible au bit** et vérifiable par SHA-256 **et** par empreinte canonique de contenu.

**Blocages restants pour la commercialisation :**
- Les **droits de redistribution ne sont pas documentés** (aucune licence dans `aveca/Casinobabe`) : le propriétaire doit les expliciter avant toute vente.
- Le paquet propre reproductible n'est pas celui actuellement configuré dans R2 ; son remplacement reste à autoriser (écriture R2 interdite sans autorisation explicite).
- L'objet R2 live contient du code **non commité** et 2 exécutables hors manifeste : sa provenance est **non établie**.
- Aucune compatibilité serveur n'est datée (matrice `assets/compat.json` de BOT-WOW : tout `not_tested`).
- Le checkout public reste fermé. La valeur du secret `RELEASE_STATUS` n'a pas été lue.
- Aucun profil Mollie dédié BOT-WOW n'est confirmé par les preuves disponibles.
- Aucune installation, activation ou livraison E2E n'est certifiée.

Ce document ne prétend pas que le produit est prêt à la vente. Il constate l'existence, la **provenance** et la **reproductibilité** du runtime source — pour la pêche uniquement.
