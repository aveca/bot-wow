# Third-party notices — what ships in `casinobabe-fishing-1.2.0.zip`

**Objet :** inventorier, pièce par pièce, les composants **tiers réellement embarqués**
dans le paquet livré au client, avec la licence applicable et les obligations qui en
découlent. Chaque ligne est fondée sur une **vérification réelle** (fichier embarqué,
registre npm, table de noms de la police), pas sur une supposition.

**Ce fichier ne crée aucune licence et n'accorde aucun droit.** Il constate l'état des
droits. Tant qu'une ligne est marquée **NON ÉTABLI**, le composant correspondant ne doit
pas être redistribué.

## Portée : ce que contient réellement le paquet

`scripts/build-package.cjs` copie **tout** le dossier `runtime-addon/Casinobabe/` de la
source (addon Lua, bibliothèques et médias), les scripts Python `scripts/fishing_*.py`
et `scripts/focus_broker.py`, plus `config.example.json`, `INSTALL.md`, `MANIFEST.json`
et `VERSION`. Les composants tiers ci-dessous sont donc **tous livrés au client**.

## Inventaire vérifié

| # | Composant | Fichier livré | Origine vérifiée | Licence | Obligations | Statut |
|---|---|---|---|---|---|---|
| 1 | **DejaVu Sans** (Book) 2.37 | `<racine-archive>/runtime-addon/Casinobabe/media/casino_uni.ttf` (757 076 o) | Bitstream, Inc. (2003) + Tavmjong Bah (2006, Arev) ; `nameID 1/3 = DejaVu Sans`, `nameID 14 = dejavu.sourceforge.net/wiki/index.php/License` | Bitstream Vera Licence **+** Arev Licence, texte intégral **embarqué dans la police** (`nameID 13`) ; « DejaVu changes are in public domain » | Inclure l'avis de copyright et la permission dans chaque copie ; **renommer** si modifié (interdit de contenir « Bitstream », « Vera », « Arev », « Tavmjong Bah ») ; vendable dans un lot logiciel, jamais la police seule ; ne pas utiliser les noms Bitstream/Gnome/Tavmjong Bah en publicité sans autorisation écrite | **ÉTABLI** — redistribuable, à condition de livrer le texte de licence. Le fichier est déjà renommé (`casino_uni.ttf`, nom interne `DejaVu Sans`) : l'obligation de renommage est satisfaite |
| 2 | **wasmoon-lua5.1** 1.18.10 | dépendance Python déclarée (`package.json`), **non embarquée** dans le ZIP | `github.com/X3ZvaWQ/wasmoon-lua5.1`, auteur `x3zvawq` | **MIT** (champ `license` du registre npm, lu sur `registry.npmjs.org`) | Conserver l'avis de copyright + la permission MIT | **ÉTABLI** — redistribuable avec attribution |
| 3 | **lodash** 4.17.21 | dépendance transitive de wasmoon-lua5.1 | `github.com/lodash/lodash`, auteur John-David Dalton | **MIT** (registre npm) | Conserver l'avis de copyright + la permission MIT | **ÉTABLI** — redistribuable avec attribution |
| 4 | **LibStub** | `<racine-archive>/runtime-addon/Casinobabe/Libs/LibStub/LibStub.lua` (1 183 o) | en-tête : « LibStub is a simple versioning stub meant for use in Libraries. https://www.curseforge.com/wow/addons/libstub **(public domain)** » | **revendication « domaine public »** dans le fichier | Aucune attribution formellement exigée par cette revendication | **À CONFIRMER** — une mise dans le domaine public n'a pas le même effet selon les juridictions (notamment en droit français/européen). Le fichier cite son origine et sa position ; l'absence de texte de licence explicite est un risque résiduel, pas une interdiction |
| 5 | **LibDBIcon-1.0** (adaptation) | `<racine-archive>/runtime-addon/Casinobabe/Libs/LibDBIcon-1.0/LibDBIcon-1.0.lua` (7 600 o) | en-tête : « Based on the standard LibDBIcon-1.0 API, **adapted** to use `self` (TBC 2.5.5, not the Vanilla `this`/`arg1` globals) … Bundled with Casinobabe » | **AUCUNE** — le fichier ne porte aucune licence, et les dépôts GitHub publics de LibDBIcon-1.0 (wowace-clone, zerosnake0, Wrath-AddOns, WoWAddonMirrors, kaldown) déclarent tous `license: null` | Inconnues | **NON ÉTABLI** — œuvre dérivée d'une bibliothèque tierce dont la licence n'est publiée nulle part. **Ne pas redistribuer avant permission de l'auteur d'origine ou remplacement par une implémentation locale** |
| 6 | **Texture `background.tga`** | `<racine-archive>/runtime-addon/Casinobabe/media/background.tga` (1 572 908 o) | 512 × 1024, 24 bits, non compressée ; en-tête TGA `idLength = 0`, **aucun champ d'identification** ; aucune mention dans le dépôt | **AUCUNE** — aucune attribution, aucun crédit, aucune origine | Inconnues | **NON ÉTABLI** — origine et titulaire indisponibles. **Ne pas redistribuer avant identification de l'auteur et de la licence** |
| 7 | **Casinobabe (le projet lui-même)** | `<racine-archive>/runtime-addon/Casinobabe/*.lua`, `package/scripts/fishing_*.py` | `## Author: Casinobabe` dans le `.toc` ; seul auteur Git humain : `Coco <yacovassaraf@gmail.com>` | **AUCUNE** — aucun `LICENSE`/`COPYING`/`NOTICE`, ni dans `HEAD` ni dans tout l'historique Git | Inconnues | **NON ÉTABLI** — le propriétaire doit choisir et publier la licence de son propre code |

## Textes de licence à joindre au paquet

Le texte embarqué de la police (Bitstream Vera + Arev) doit être reproduit dans les
copies. Il est donc joint ci-après, extrait tel quel de `nameID 13` de
`casino_uni.ttf`.

### DejaVu Sans — avis de copyright (extrait intégral, `nameID 13`)

```
Copyright (c) 2003 by Bitstream, Inc. All Rights Reserved.
Copyright (c) 2006 by Tavmjong Bah. All Rights Reserved.
DejaVu changes are in public domain
```

Le texte complet des licences Bitstream Vera et Arev est stocké dans la police elle-même
(table `name`, `nameID 13`). Il doit être lu à cet endroit — le reproduire ici mot pour
mot n'apporterait rien de plus que la police ne porte déjà. Il est rappelé que la police
**peut être vendue dans un lot logiciel mais jamais seule**, et que les noms
« Bitstream », « Vera », « Arev » et « Tavmjong Bah » ne peuvent pas être utilisés en
publicité sans autorisation écrite.

### wasmoon-lua5.1 et lodash — MIT

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
```

- wasmoon-lua5.1 1.18.10 — Copyright (c) x3zvawq — <https://github.com/X3ZvaWQ/wasmoon-lua5.1>
- lodash 4.17.21 — Copyright (c) John-David Dalton — <https://lodash.com/>



## Archives R2 inspectées — instantané vérifié le 2026-11-08

Cet inventaire décrit les objets R2 effectivement relus, pas un nouveau build produit par le builder actuel.

| Objet | Taille | SHA-256 |
|---|---:|---|
| `casinababe-fishing-1.2.0.zip` | 1 387 543 o | `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f` |
| `casinababe-fishing-1.2.1.zip` | 1 385 570 o | `ef294998a1ac5ce703739f7541ac63d0e61191f55fa8a7129b420b38adf79132` |

Les deux ZIP contiennent 30 entrées ; les 26 fichiers déclarés au manifeste passent SHA-256, taille et CRC. Deux scripts racine supplémentaires ne sont pas déclarés au manifeste : `Lancer-Casinobabe-Fishing-Assistant.bat` et `restaurer_previous.ps1`. Le second comporte une double barre de pipeline PowerShell et n'est pas validé. Le chemin de l'addon dans ces archives est `<racine-archive>/runtime-addon/Casinababe/`, différent du chemin de destination `package/addon/Casinababe/` du builder actuel. Cette divergence interdit d'affirmer que les archives R2 sont des sorties reproductibles du builder actuel.

La police `casino_uni.ttf` porte le texte complet Bitstream Vera + Arev dans sa table TTF `nameID 13` (record Windows UTF-16BE, 9 530 octets). Pour éviter toute ambiguïté lors d'une prochaine distribution, joindre également un fichier de notice séparé au paquet reconstruit ; les archives R2 actuelles ne contiennent pas ce fichier de notice.

## Ce qui bloque la redistribution, exactement

Trois composants et le code du projet lui-même n'ont pas de droits établis :

1. **LibDBIcon-1.0** (œuvre dérivée, aucune licence publiée) — permission de l'auteur
   d'origine, ou remplacement par une implémentation écrite pour ce projet ;
2. **`background.tga`** (origine inconnue) — identifier l'auteur et sa licence, ou
   remplacer la texture ;
3. **Le code Casinobabe lui-même** — décision du propriétaire sur la licence de son
   propre code (licence propriétaire à rédiger, ou licence open source à choisir).

Le quatrième point, **LibStub**, est un risque résiduel de « domaine public » à
confirmer, pas un interdit.

## Mise à jour et non-régression

`tests/third-party-notices.test.mjs` vérifie que **chaque fichier tiers présent
dans `runtime-addon/`` apparaît dans ce document**, et qu'aucune ligne « NON ÉTABLI »
n'est discrètement retirée. Ajouter un composant tiers sans l'inventorier fait échouer
`npm test`.

## Journal des vérifications

| Date | Vérification | Méthode |
|---|---|---|
| 2026-11-08 | wasmoon-lua5.1 1.18.10 = MIT | `registry.npmjs.org/wasmoon-lua5.1/1.18.10`, champ `license` |
| 2026-11-08 | lodash 4.17.21 = MIT | `registry.npmjs.org/lodash/4.17.21`, champ `license` |
| 2026-11-08 | police = DejaVu Sans 2.37, licence embarquée | lecture de la table `name` du TTF (`nameID 0/1/3/13/14`) |
| 2026-11-08 | LibDBIcon-1.0 : aucune licence dans le fichier | lecture de l'en-tête du fichier livré |
| 2026-11-08 | LibDBIcon-1.0 : `license: null` sur 5 miroirs GitHub publics | API GitHub `search/repositories` |
| 2026-11-08 | texture : aucune identification | en-tête TGA (`idLength = 0`), aucune mention dans le dépôt |
| 2026-11-08 | aucun `LICENSE` dans le projet, jamais | `git log --all --diff-filter=D` + `git ls-files` |
