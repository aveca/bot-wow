# Provenance runtime et paquet reproductible — 2026-11-07T23:05Z

**Mission :** établir la provenance cryptographique du runtime livré, prouver
qu'un paquet **reproductible au bit** peut être reconstruit, et quantifier
l'écart entre l'artefact R2 en production et la source committée.

**Dépôt :** `aveca/bot-wow` (exclusif) · **Branche :**
`p0/reproducible-runtime-package-20261107` (base `origin/main` @
`9a01a5098b8025cf6b1ca338f426033224459c99`)

**Verdict en une phrase :** le runtime de pêche est **identifié, auditable et
désormais reproductible au bit** (`F8138F3C…`), mais l'**objet R2 en production
n'est pas reproductible** (6 fichiers non commités + 2 exécutables hors
manifeste) et les **droits de redistribution ne sont documentés nulle part** —
donc aucune vente du runtime ne peut être justifiée en l'état.

---

## 1. Périmètre du runtime : pêche uniquement

| Constat | Statut | Preuve |
|---|---|---|
| Aucun runtime WoW **Gold / PvP / XP** n'existe dans `aveca/bot-wow` | **[vérifié]** | `docs/historical-runtime-absence-20261106.md` (commit `f502029`), 915 commits inspectés |
| Le runtimeaddon de `aveca/Casinobabe` est un **panneau client de casino** : « gold » = devise de table, « pvp » = label de champ de bataille | **[vérifié]** | inspection du code du runtime |
| Le **seul** runtime réel est l'assistant de pêche Python (`fishing_bot.py`, `fishing_observer.py`, …) de `aveca/Casinobabe` | **[vérifié]** | commit `257418c9a0c2c489a01226e8065ac9c8eaded954`, branche `feat/fishing-route-intelligence-v2` |
| Aucun serveur privé explicitement autorisé n'est identifié → aucun smoke test réel possible | **[bloqué]** | aucun accès disponible dans cet environnement |

→ L'offre ne peut porter que sur l'assistant de pêche. Toute mention Gold/PvP/XP
serait une invention.

---

## 2. Chaîne de provenance établie

| Maillon | Valeur | Statut |
|---|---|---|
| Dépôt source | `aveca/Casinobabe` | **[vérifié]** |
| Commit source | `257418c9a0c2c489a01226e8065ac9c8eaded954` | **[vérifié]** |
| Branche source | `feat/fishing-route-intelligence-v2` | **[vérifié]** |
| Date du commit source | `2026-10-22T02:18:01Z` | **[vérifié]** |
| Produit | Casinobabe Fishing Assistant 1.2.0, interface WoW `20506` (Classic Era) | **[vérifié]** |
| Clé R2 configurée | `casinobabe-fishing-1.2.0.zip` (`wrangler.toml` var `R2_OBJECT_KEY`, ligne 69 ; garde du Worker `^casinobabe-fishing-\d+\.\d+\.\d+\.zip$`) | **[vérifié]** |
| Bucket | `botwow-binaries` (binding `R2_BINARIES`) | **[vérifié]** |
| Licence de la source | **AUCUNE** — pas de `LICENSE`, `COPYING` ni `NOTICE` dans le commit ; `license: null` (API GitHub) | **[vérifié]** |

> **Droits de distribution non établis.** L'absence de licence ne veut pas dire
> « domaine public » : elle veut dire que **personne n'a écrit qui peut
> redistribuer ce code**. Le propriétaire doit l'expliciter avant toute vente.

---

## 3. Le build d'origine n'est PAS reproductible — mesuré

Le dépôt source étant en **lecture seule**, la correction est apportée dans
BOT-WOW (`scripts/build-package.cjs`). Mais le constat de départ doit être mesuré,
pas supposé :

| Build python d'origine (`scripts/build_desktop_package.py`) | `builtAt` inscrit | SHA-256 du ZIP |
|---|---|---|
| #1 | `2026-11-07T19:06:24` | `D225E63FE611690C71C705283F1BF77CDA04891E9A9C1C13C06D02CC380300F6` |
| #2 | `2026-11-07T19:06:28` | `9FC19FEEBE69EBD55A10B4806C6A916C77F6E36566C74A4D70EE1C3509326FA1` |

**[vérifié]** — deux constructions **de la même source**, séparées de 4
secondes, ne produisent pas le même octet. Les **SHA-256 par fichier sont
identiques** dans les deux manifestes : la seule différence est l'horodatage
`builtAt` (heure de la machine). Conséquence : le SHA-256 du ZIP ne peut pas
servir de référence de provenance, et deux builds ne sont pas interchangeables.

---

## 4. Le build déterministe côté BOT-WOW

### 4.1 Ce qui a changé dans `scripts/build-package.cjs`

| Source de non-determinisme | Correction |
|---|---|
| `builtAt = new Date()` (heure de la machine) | `SOURCE_DATE_EPOCH`, sinon la **date du commit source**, sinon `null` |
| tri par `localeCompare` (dépend de la locale) | tri **byte-stable** (`Buffer.compare`) |
| ordre des clés du manifeste | clés **triées** |
| fins de ligne héritées du checkout (CRLF sous Windows) | fichiers texte **normalisés en LF** ; la politique `eol: "LF"` est inscrite dans le manifeste |
| manifeste sans provenance | `source.repository`, `source.ref`, `source.commit`, `source.commitDate` inscrits dans le manifeste |
| `VERSION` et `RELEASE-NOTES.md` hors manifeste | ils sont **écrits avant** le manifeste et **déclarés** : le manifeste couvre tout le contenu livré (sauf `MANIFEST.json` lui-même) |

### 4.2 Preuves de reproductibilité (mesurées dans ce cycle)

| Mesure | Résultat |
|---|---|
| Build A | SHA-256 `F8138F3C52EB2498114AD5BCD3988DB39A105BD4B757646BF1C2B7548DA79781`, 1 344 366 octets, 17 entrées ZIP, 16 entrées de manifeste |
| Build B (immédiat) | **SHA-256 identique**, octets identiques (`Compare-Object` → aucun écart) |
| Build C (checkout **CRLF**) | **SHA-256 identique**, 1 344 366 octets |
| Build D (checkout remis en **LF**) | **SHA-256 identique** |
| Empreinte canonique du contenu (A, B, D) | `f69be8b34f74b2df68a177e0210b9bd73f6c99452c9279c291f2961173c90a53` (17 fichiers, 3 004 035 octets) |
| Intégrité `MANIFEST.json` ↔ contenu livré | `ok` — 0 écart, 0 fichier hors manifeste, 0 fichier déclaré manquant |
| Provenance inscrite dans le manifeste | `aveca/Casinobabe` / `feat/fishing-route-intelligence-v2` / `257418c9a0c2…` / `builtAt = 2026-10-22T02:18:01.000Z` |

Commande reproductible :

```bash
node scripts/build-package.cjs --source <checkout aveca/Casinobabe @ 257418c> \
     --version 1.2.0 --out dist
```

### 4.3 Nouvel outil : empreinte canonique du contenu

`scripts/canonical-package-digest.mjs` calcule l'empreinte **canonique** de
l'arborescence livrée (chemin + SHA-256 + taille, triés par octets) :
indépendante du ZIP, de ses horodatages et de son ordre de parcours. Il vérifie
aussi l'intégrité `MANIFEST.json` ↔ contenu livré (fichiers **déclarés absents**,
fichiers **livrés hors manifeste**, écarts de hash) et sort en code `1` si
l'intégrité est rompue. Il n'écrit rien.

C'est l'outil qui permet de comparer **le contenu** de deux paquets au lieu de
comparer deux conteneurs ZIP.

---

## 5. Écart entre l'artefact R2 en production et la source committée

Objet analysé : copie locale de `botwow-binaries/casinobabe-fishing-1.2.0.zip`
obtenue par `wrangler r2 object get --remote` (méthode documentée dans
`reports/operations/2026-11-04-p0-delivery-proof.md` et
`reports/revenue/BOT-WOW-REVENUE-DESIGN-2026-11-04.md`).

> **Périmètre de lecture, à énoncer franchement :** dans **ce** cycle, aucun
> nouveau `Get Object` n'a été effectué — l'API Cloudflare n'est pas accessible
> depuis cet environnement (HTTP 403). L'analyse porte donc sur la copie déjà
> téléchargée, dont le SHA-256 recalculé (`1C132F36…`) correspond à la valeur
> historiquement vérifiée. La **réconciliation List Objects / Get Object**
> (HTTP 404, code `10007` sur l'API REST) reste le constat du recontrôle du
> 2026-11-07T14:31Z (commentaire sur #134) : **non résolu**.

| Mesure | Valeur |
|---|---|
| SHA-256 de l'objet | `1C132F367607EA186FEFFDE8BBDA0A1A9F94CDEC4B7850B93C57C271270BBA4F` |
| Taille / entrées | 1 387 543 octets, 30 entrées ZIP, 26 fichiers déclarés au manifeste |
| Intégrité interne (manifeste ↔ contenu) | **0 écart** — le manifeste de l'objet live est cohérent avec lui |
| Fichiers **identiques** au commit `257418c` | **20** |
| Fichiers **différents** du commit `257418c` | **6** — `fishing_assistant_app/fishing_assistant.py`, `scripts/fishing_bot.py`, `scripts/fishing_controls.py`, `scripts/fishing_minimap.py`, `scripts/fishing_navigation.py`, `scripts/focus_broker.py` |
| Fichiers livrés **absents** de la source | **3** — `Lancer-Casinobabe-Fishing-Assistant.bat`, `restaurer_previous.ps1`, `VERSION` |
| Fichiers livrés **hors manifeste** de l'objet | **3** — les deux exécutables ci-dessus + `VERSION` |
| Empreinte canonique de l'objet live | `fc9a1e0aa04059eb5ff433661afc23cea360fa771146b88972222d36d564f160` (3 174 481 octets) |

**Conclusion :** l'artefact R2 live **n'est pas reproductible** depuis un état
committé. Il embarque du code modifié non commité et deux exécutables qui ne
figurent ni dans la source ni dans son propre manifeste — donc **d'origine
inconnue**, jamais revue. Sa provenance n'est pas établie.

Son remplacement par le paquet reproductible (`F8138F3C…`) est **possible sans
écriture R2 dans cette PR** : il demandera une **autorisation explicite** d'écrire
l'objet, ce que `AGENTS.md` interdit par défaut. Aucun exécutable de l'artefact
live n'a été lancé.

---

## 6. Ce qui a été livré

| Fichier | Nature |
|---|---|
| `scripts/build-package.cjs` | build déterministe (horodatage, tri, manifeste, LF, provenance) |
| `scripts/canonical-package-digest.mjs` | **nouveau** — empreinte canonique du contenu + contrôle d'intégrité du manifeste |
| `tests/distribution-package.test.mjs` | + 9 contrôles (provenance, `builtAt` déterministe, clés triées, 2 builds = même SHA, CRLF = même SHA, intégrité canonique) |
| `tests/canonical-package-digest.test.mjs` | **nouveau** — 20 contrôles de l'empreinte canonique et de l'intégrité |
| `package.json` | `npm test` inclut le nouveau test ; script `test:canonical-digest` |
| `runtime/INTEGRATION.md`, `runtime/sha256.txt` | provenance, reproductibilité, écart R2 chiffré, **licence absente** |
| `reports/operations/2026-11-07-runtime-provenance-reproducible-package.md` | ce rapport |
| `agents/*`, `PROJECT_STATE.md` | verrous, tâches, bloqueurs, décisions, résultats de tests |

## 7. Tests réellement exécutés (résultats réels)

| Commande | Résultat |
|---|---|
| `node tests/canonical-package-digest.test.mjs` | exit 0 — `CANONICAL DIGEST : OK` (20 contrôles) |
| `node tests/distribution-package.test.mjs` | exit 0 — `DISTRIBUTION : OK` (28 contrôles) |
| `node scripts/build-package.cjs --source <clone 257418c> --version 1.2.0 --out <dir>` (× 4 : LF, LF, CRLF, LF restauré) | SHA-256 identique `F8138F3C…` à chaque fois |
| `node scripts/canonical-package-digest.mjs <paquet>` | `integrite : ok`, exit 0 |
| `python scripts/build_desktop_package.py --version 1.2.0 --out <dir>` (× 2) | SHA-256 **différents** (`D225E63F…` vs `9FC19FEE…`) |
| `npm run validate` | exit 0 — `BOT-WOW validation PASS` |
| `npm test` | exit 0 |
| `CHECK_OPEN_PR_LOCKS=1 node scripts/check-agent-state.mjs` | exit 0 — `AGENT STATE : OK` |
| `git diff --check` | exit 0 |

## 8. Garde-fous respectés

- **Aucune écriture R2**, aucun upload, aucun delete, aucun `wrangler r2 object put`.
- Aucun changement Worker, Pages, secret, binding, D1, webhook, prix, checkout,
  paiement Mollie, e-mail client, migration.
- `aveca/Casinobabe` : **lecture seule**. Le clone local déjà présent a été
  basculé CRLF/LF pour la mesure puis **restauré** (état propre, `core.autocrlf=false`,
  HEAD `257418c`, `git status` vide) ; **aucun push, aucun commit, aucune issue,
  aucun commentaire** dans ce dépôt.
- Aucun exécutable de l'artefact live n'a été lancé.
- Aucun merge, aucun déploiement.

## 9. Limites explicites

- **[non vérifié]** La réconciliation `List Objects` / `Get Object` R2 (404 / `10007`
  sur l'API REST) n'est pas résolue : pas de nouvel accès API depuis cet environnement.
- **[non vérifié]** Les **droits de redistribution** : aucune licence dans la source.
- **[non vérifié]** L'artefact live ne peut pas être re-construit : il dépend d'un
  état non commité et de 2 exécutables d'origine inconnue.
- **[non vérifié]** Aucun smoke test réel : aucun serveur privé autorisé identifié.
- **[rapporté]** La présence de l'objet R2 et son ETag
  (`d9d7ab22ec076873b8fed656a53460bc`, `last_modified 2026-10-27T06:31:06.784Z`)
  provient du recontrôle du 2026-11-07T14:31Z, pas de ce cycle.

## 10. Prochaine action (une seule)

**Décision du propriétaire sur la licence et l'artefact** : (a) expliciter les
droits de redistribution du runtime `aveca/Casinobabe` (ou les refuser, ce qui
ferme la voie de la vente du runtime) ; (b) autoriser — ou refuser — le
remplacement de l'objet R2 live par le paquet reproductible `F8138F3C…`, en
acceptant que les 2 exécutables hors manifeste disparaissent du paquet livré.
Tant que (a) n'est pas écrit, le checkout public reste fermé et aucune vente ne
peut être justifiée.
