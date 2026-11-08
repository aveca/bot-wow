# Rapport de cycle — Intégrité du paquet reproductible (PR #150)

**Date :** 2026-11-08
**Dépôt :** `aveca/bot-wow`
**Branche :** `p0/reproducible-runtime-package-20261107` (branche de la **PR #150 existante**, pas de seconde PR)
**Base :** merge de `origin/main` `158222e8528e7351afe76730a75ebe2fa7929324` (commit de merge `210d81d`)
**Mission :** #144 (point 3) · issue #151 `BOTWOW-P0-PACKAGE-INTEGRITY-PR150-20261108`

---

## 1. Objectif

Reprendre la PR #150 existante et corriger trois défauts d'intégrité confirmés dans
le builder déterministe et son empreinte canonique, **sans créer de PR concurrente**,
sans publier ni remplacer aucun artefact R2.

## 2. Divergence de la branche — résolue sans réécriture d'historique

| Élément | Avant | Après |
|---|---|---|
| Base de la PR #150 | `origin/main` @ `9a01a50` | merge de `158222e` (main courant) |
| Ahead / behind | 1 ahead / 2 behind | 2 ahead / **0 behind** |
| HEAD | `d840a1cdb728cbea28124d3656b8519b6b4889bf` | commit de merge `210d81d` + correctifs |

**Méthode retenue : merge, pas rebase.** `AGENTS.md` interdit le force-push et la
réécriture d'historique ; un rebase aurait exigé un force-push sur la branche de la PR.
Un merge produit le même état utile (la branche **contient** le main courant) sans
réécrire l'historique ni écraser les changements existants. Aucun conflit.

## 3. Les trois défauts corrigés

### 3.1 `scripts/build-package.cjs` — liens symboliques suivis (falsification de contenu)

**Défaut démontré :** `readdirSync(…, { withFileTypes: true })` ne suit pas les liens
symboliques — un `Dirent` de lien a `isDirectory() === false` et `isFile() === false`.
Un pointeur vers un **répertoire** était donc poussé comme « fichier » puis lu par
`readFileSync` (plantage `EISDIR`). Plus grave : un lien vers un **fichier** était lu
normalement, et le contenu d'un fichier **extérieur à la source** entrait dans le
paquet livré, déclaré au manifeste comme provenant de la source.

**Correctif :**
- `assertRegularFileInside()` / `assertDirectoryInside()` : rejet explicite de tout
  lien symbolique (fichier **et** répertoire) **avant toute lecture**, plus contrôle
  que le `realpath` reste strictement sous `SOURCE`.
- `walk()` (parcours source) rejette les liens et les entrées non régulières.
- `walkStrict()` : variante défensive pour l'arborescence mise en scène.
- `zipDirectory()` refuse aussi les liens à l'archivage (ceinture + bretelles).
- `copy()` appelle le garde AVANT `readFileSync`.

### 3.2 `scripts/canonical-package-digest.mjs` — digest non fail-closed

**Défaut démontré :** sans `MANIFEST.json`, l'outil sortait en **code 0**. Un
manifeste illisible (JSON invalide) donnait aussi un code 0, et un fichier livré
**hors manifeste** était seulement « documenté » sans faire échouer. L'outil
paraissait donc valider des artefacts qu'il n'avait pas pu vérifier.

**Correctif (fail-closed) :** le code de sortie est non nul dès que l'intégrité
n'est **pas établie** :
- `MANIFEST.json` absent → `manifestError`, exit 1 ;
- `MANIFEST.json` illisible ou sans table `files` exploitable → `manifestError`, exit 1 ;
- fichier livré non déclaré (`undeclared`) → exit 1 (auparavant exit 0) ;
- fichier déclaré manquant ou hash/taille divergent → exit 1 (déjà le cas) ;
- nouveau champ `integrityEstablished` et `manifestError` dans la sortie JSON ;
- lien symbolique dans le paquet → refusé avant lecture.

### 3.3 `scripts/build-package.cjs` — provenance CLI certifiée sans vérification

**Défaut démontré :** `arg('source-commit', …)` prenait la valeur CLI telle quelle et
l'inscrivait dans le manifeste. Un `--source-commit` falsifié aurait produit un
manifeste « auto-documentant » portant une provenance fausse.

**Correctif :** chaque override est confronté au checkout réel (`remote.origin.url`,
ref résolue, `HEAD`) :
- override sur une source sans dépôt Git → **refusé** (non falsifiable) ;
- valeur différente de la valeur réelle → **refusée** ;
- commit : référence courte acceptée seulement si c'est un préfixe du HEAD réel
  (≥ 7 caractères) ;
- le manifeste porte `provenanceVerified: true` (valeurs confrontées au checkout) et
  `overridesChecked` (drapeaux contrôlés) ;
- sans dépôt Git et sans override : provenance **inconnue**, rien n'est certifié ;
- toute erreur d'intégrité sort en code 1 avec `ECHEC D'INTEGRITE — paquet non construit`.

## 4. Tests ajoutés (négatifs, déterministes)

`tests/distribution-package.test.mjs` — la source de test est désormais un **vrai
dépôt Git** (provenance falsifiable). Ajouts :

| Famille | Test |
|---|---|
| Lien symbolique fichier | `Evil.lua` → fichier extérieur : build échoue |
| Lien symbolique répertoire | `Linked/` → répertoire extérieur : build échoue |
| Cible extérieure à `SOURCE` | build échoue **et aucune archive n'est produite** |
| Commit falsifié | `deadbeef…` : échec `ne correspond pas au HEAD reel` |
| Dépôt falsifié | `quelquun/autre-depot` : échec |
| Ref falsifiée | `branche-inexistante` : échec |
| Override sur source non Git | échec `provenance reelle est illisible` |
| Override valide | préfixe court du HEAD réel : accepté, commit complet écrit, `provenanceVerified: true` |
| Source non Git sans override | build accepté, provenance inconnue |

`tests/canonical-package-digest.test.mjs` — ajouts (dont `symlinkSync` à l'import) :

| Famille | Test |
|---|---|
| Manifeste absent | exit 1 + `manifestError` + `integrityEstablished: false` + sortie texte `NON ETABLIE` |
| JSON invalide | exit 1 + `manifestError` |
| Manifeste sans table `files` | exit 1 + `manifestError` |
| Fichier hors manifeste | exit 1 (était 0) + `integrityEstablished: false` |
| Lien symbolique dans le paquet | échec |

**Correction d'un piège de test :** `arg()` du builder retient la **première**
occurrence d'un drapeau. Ajouter un second `--source-commit` en fin de ligne était
silencieusement ignoré : un test de provenance falsifiée passait au vert sans rien
tester. Le helper `withArg()` remplace désormais la valeur au lieu de l'ajouter.

**Invariant EOL précisé :** l'ancien test comparait les SHA des deux ZIP. Comme les
deux sources sont deux commits Git distincts, leur manifeste porte un
`source.commit` différent et le ZIP **doit** différer. L'invariant vérifiable est
désormais précis : les **octets livrés** (`package/scripts/*.py`, `addon/*.toc`,
`addon/*.lua`) sont identiques, sans CRLF résiduel, et le manifeste déclare la même
politique `eol`.

## 5. Résultats (exécution locale réelle, 2026-11-08)

| Commande | Résultat |
|---|---|
| `node tests/distribution-package.test.mjs` | exit 0, `DISTRIBUTION : OK` |
| `node tests/canonical-package-digest.test.mjs` | exit 0, `CANONICAL DIGEST : OK` (31 contrôles) |
| `npm run validate` | exit 0, `BOT-WOW validation PASS` |
| `node tests/payment-flow.test.mjs` | exit 0, `PARCOURS DE PAIEMENT : OK` |
| `node tests/checkout-security.test.mjs` | exit 0, `SECURITE DU CHECKOUT : OK` |
| `node tests/worker-fulfillment-reconciliation.test.mjs` | exit 0, `RECONCILIATION WORKER : OK` |
| `npm test` (suite complète) | **exit 0**, toutes les suites vertes |
| `git diff --check` | exit 0 |

## 6. Conséquences sur les empreintes publiées

Le durcissement ajoute 60 octets au `MANIFEST.json` (`provenanceVerified`,
`overridesChecked`). L'identité du paquet change donc :

| Mesure | Avant (2026-11-07) | **Après (2026-11-08)** |
|---|---|---|
| SHA-256 du ZIP reproductible | `F8138F3C52EB2498114AD5BCD3988DB39A105BD4B757646BF1C2B7548DA79781` | `A05FC3802C5C86BDD189777A8D76C47AF99FC24436ADBE8779E71F2412C3DF8C` |
| Taille | 1 344 366 B | 1 344 402 B |
| Empreinte canonique (contenu) | `f69be8b34f74b2df68a177e0210b9bd73f6c99452c9279c291f2961173c90a53` | `0d9f39019215dba83927600cdc132fe606bdeabbc2a874bc1e8506f9cf3bf33e` |
| Fichiers / octets | 17 / 3 004 035 B | 17 / 3 004 095 B |
| Reproductibilité | 2 builds identiques | **2 builds identiques** (vérifié) |
| Intégrité | `ok` | `integrityEstablished: true` (fail-closed) |
| Provenance | valeurs CLI non confrontées | `provenanceVerified: true` |

**Documents mis à jour pour ne pas publier une valeur fausse :**
`runtime/sha256.txt`, `runtime/INTEGRATION.md`.
L'artefact R2 live (`1C132F36…`) n'est **pas** concerné : il n'a pas été relu, ni
réécrit, ni remplacé (voir §8).

## 7. Ce qui n'a PAS été fait (garde-fous)

- Aucune écriture, suppression ou **remplacement d'un objet R2** ; aucun upload d'archive.
- Aucun merge, déploiement, paiement réel, remboursement ou email client.
- Aucune modification de `worker/index.js`, `PRICE_TABLE`, routes paiement/webhooks,
  `RELEASE_STATUS`, montants, D1, secrets ou bindings.
- Le runtime source et ses exécutables n'ont pas été exécutés.
- Aucune licence inventée : `aveca/Casinobabe` ne documente toujours aucun droit de
  redistribution.
- `aveca/sargagame` lu en lecture seule, non modifié.
- La PR #150 reste **ouverte** pour revue.

## 8. Licence — blocage inchangé et vérifié

Contrôle refait ce cycle sur `aveca/Casinobabe @ 257418c` (clone local) :
- **aucun** fichier `LICENSE`, `COPYING`, `NOTICE` à la racine ;
- dépendance tierce identifiée : `wasmoon-lua5.1` (interpréteur Lua 5.1 en WASM) —
  elle impose une attribution dans ses propres termes, mais **le dépôt source ne
  déclare aucune licence** ;
- conclusion inchangée : les droits de redistribution du runtime **ne sont pas
  documentés**, donc la commercialisation reste bloquée sur ce point (`B-licence`).

Lecture R2 impossible depuis cet environnement : `r2_objects_list` et `r2_objects_get`
renvoient **HTTP 403** (code `10000`, « Authentication error ») sur le compte
`abf2b92cf718313567b4b38eb9dda17f`. `r2_buckets_list` fonctionne, lui : le bucket
`botwow-binaries` existe. Les faits sur l'objet live (`1C132F36…`, 1 387 543 B,
30 entrées, 20 identiques / 6 différents / 3 hors manifeste) restent donc
**[rapportés]** d'un cycle antérieur, **pas re-vérifiés** ici.

## 9. Prochaine action

Pousser la branche de la PR #150, attendre les checks GitHub Actions verts sur le
SHA exact, publier le SHA final et les run IDs sur l'issue #151 (task_id
`BOTWOW-P0-PACKAGE-INTEGRITY-PR150-20261108`), puis publier le rapport global sur
l'issue #144. Le checkout reste fermé.
