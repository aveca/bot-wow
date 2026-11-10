# Third-party notices — BOT-WOW package candidate and historical R2 archives

**Objet :** inventorier les composants tiers, leurs licences et les obligations de
redistribution. Ce document distingue désormais les anciennes archives R2 du paquet
candidat reconstruit depuis la source runtime corrigée.

**Ce fichier ne crée aucune licence et n'accorde aucun droit.** Il constate l'état des
droits et ne vaut pas autorisation de publication.

## État de la source candidate — vérifié le 10 novembre 2026

La PR [aveca/Casinobabe#47](https://github.com/aveca/Casinobabe/pull/47), fusionnée dans
`feat/fishing-route-intelligence-v2` au commit
`b625ccec5fd61225dd92c5c54fa8721da76c3876`, retire du runtime candidat :

- `LibStub.lua` et `LibDBIcon-1.0.lua` ; le bouton minimap est désormais natif ;
- `media/background.tga` ; le fond est dessiné avec `SetColorTexture`.

Les lignes 4 à 6 de l'inventaire ci-dessous documentent **uniquement les composants
présents dans les anciennes archives R2 1.2.0 et 1.2.1**. Elles ne signifient pas que
ces composants restent dans la source candidate. Le builder refuse toujours ces noms
de fichiers s'ils réapparaissent.

## Portée du paquet candidat

`scripts/build-package.cjs` copie le dossier `runtime-addon/Casinobabe/` de la source,
les scripts Python listés dans `BOT_FILES`, un gabarit de configuration généré, ainsi
que `INSTALL.md`, `THIRD_PARTY_NOTICES.md`, `MANIFEST.json` et `VERSION`.

Le paquet candidat doit être reconstruit et inspecté avant toute distribution.
Les archives R2 1.2.0 et 1.2.1 sont des artefacts historiques non validés ; elles ne
doivent pas être utilisées comme paquet de vente.

## Inventaire vérifié

| # | Composant | Fichier livré | Origine vérifiée | Licence | Obligations | Statut |
|---|---|---|---|---|---|---|
| 1 | **DejaVu Sans** (Book) 2.37 | `<racine-archive>/runtime-addon/Casinobabe/media/casino_uni.ttf` (757 076 o) | Bitstream, Inc. (2003) + Tavmjong Bah (2006, Arev) ; `nameID 1/3 = DejaVu Sans`, `nameID 14 = dejavu.sourceforge.net/wiki/index.php/License` | Bitstream Vera Licence **+** Arev Licence, texte intégral **embarqué dans la police** (`nameID 13`) ; « DejaVu changes are in public domain » | Inclure l'avis de copyright et la permission dans chaque copie ; **renommer** si modifié (interdit de contenir « Bitstream », « Vera », « Arev », « Tavmjong Bah ») ; vendable dans un lot logiciel, jamais la police seule ; ne pas utiliser les noms Bitstream/Gnome/Tavmjong Bah en publicité sans autorisation écrite | **ÉTABLI** — redistribuable, à condition de livrer le texte de licence. Le fichier est déjà renommé (`casino_uni.ttf`, nom interne `DejaVu Sans`) : l'obligation de renommage est satisfaite |
| 2 | **wasmoon-lua5.1** 1.18.10 | dépendance Python déclarée (`package.json`), **non embarquée** dans le ZIP | `github.com/X3ZvaWQ/wasmoon-lua5.1`, auteur `x3zvawq` | **MIT** (champ `license` du registre npm, lu sur `registry.npmjs.org`) | Conserver l'avis de copyright + la permission MIT | **ÉTABLI** — redistribuable avec attribution |
| 3 | **lodash** 4.17.21 | dépendance transitive de wasmoon-lua5.1 | `github.com/lodash/lodash`, auteur John-David Dalton | **MIT** (registre npm) | Conserver l'avis de copyright + la permission MIT | **ÉTABLI** — redistribuable avec attribution |
| 4 | **LibStub** | `<racine-archive>/runtime-addon/Casinobabe/Libs/LibStub/LibStub.lua` (1 183 o) | en-tête : « LibStub is a simple versioning stub meant for use in Libraries. https://www.curseforge.com/wow/addons/libstub **(public domain)** » | **revendication « domaine public »** dans le fichier | Aucune attribution formellement exigée par cette revendication | **À CONFIRMER** — une mise dans le domaine public n'a pas le même effet selon les juridictions (notamment en droit français/européen). Le fichier cite son origine et sa position ; l'absence de texte de licence explicite est un risque résiduel, pas une interdiction |
| 5 | **LibDBIcon-1.0** (adaptation) | `<racine-archive>/runtime-addon/Casinobabe/Libs/LibDBIcon-1.0/LibDBIcon-1.0.lua` (7 600 o) | en-tête : « Based on the standard LibDBIcon-1.0 API, **adapted** to use `self` (TBC 2.5.5, not the Vanilla `this`/`arg1` globals) … Bundled with Casinobabe » | **AUCUNE** — le fichier ne porte aucune licence, et les dépôts GitHub publics de LibDBIcon-1.0 (wowace-clone, zerosnake0, Wrath-AddOns, WoWAddonMirrors, kaldown) déclarent tous `license: null` | Inconnues | **NON ÉTABLI** — œuvre dérivée d'une bibliothèque tierce dont la licence n'est publiée nulle part. **Ne pas redistribuer avant permission de l'auteur d'origine ou remplacement par une implémentation locale** |
| 6 | **Texture `background.tga`** | `<racine-archive>/runtime-addon/Casinobabe/media/background.tga` (1 572 908 o) | 512 × 1024, 24 bits, non compressée ; en-tête TGA `idLength = 0`, **aucun champ d'identification** ; aucune mention dans le dépôt | **AUCUNE** — aucune attribution, aucun crédit, aucune origine | Inconnues | **NON ÉTABLI** — origine et titulaire indisponibles. **Ne pas redistribuer avant identification de l'auteur et de la licence** |
| 7 | **Casinobabe (le projet lui-même)** | `<racine-archive>/runtime-addon/Casinababe/*.lua`, `package/scripts/fishing_*.py` | `## Author: Casinababe` dans le `.toc` ; déclaration du titulaire consignée dans `legal/PROPRIETARY-RIGHTS-DECLARATION.md` pour le code original uniquement | **Régime propriétaire BOT-WOW** — aucun droit open source n'est accordé | Conditions de licence client distinctes à publier et faire accepter avant paiement | **DÉCLARÉ PAR LE TITULAIRE — CONDITIONS CLIENT À FINALISER** — la déclaration ne couvre pas les composants tiers ni les modalités contractuelles de distribution au client |

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

Empreintes des composants tiers extraits de ces deux archives (identiques entre 1.2.0 et 1.2.1) :

| Composant | Taille | SHA-256 |
|---|---:|---|
| `LibDBIcon-1.0.lua` | 7 600 o | `423a81279f10542cfca09441c4ec21f5433e3203e349162d677acf0519705ac9` |
| `LibStub.lua` | 1 183 o | `6f704d6c93c6c156379d9b6789082ae6d96e4ea939e393bbf87f8791661f7c37` |
| `background.tga` | 1 572 908 o | `89e8ecd08fac85003a302ae52093acd7e41c862be4517c87611074ce213e798b` |
| `casino_uni.ttf` | 757 076 o | `7da195a74c55bef988d0d48f9508bd5d849425c1770dba5d7bfc6ce9ed848954` |

Les deux ZIP contiennent 30 entrées ; les 26 fichiers déclarés au manifeste passent SHA-256, taille et CRC. Deux scripts racine supplémentaires ne sont pas déclarés au manifeste : `Lancer-Casinobabe-Fishing-Assistant.bat` et `restaurer_previous.ps1`. Le second comporte une double barre de pipeline PowerShell et n'est pas validé. Le chemin de l'addon dans ces archives est `<racine-archive>/runtime-addon/Casinababe/`, différent du chemin de destination `package/addon/Casinababe/` du builder actuel. Cette divergence interdit d'affirmer que les archives R2 sont des sorties reproductibles du builder actuel.

La police `casino_uni.ttf` porte le texte complet Bitstream Vera + Arev dans sa table TTF `nameID 13` (record Windows UTF-16BE, 9 530 octets). Pour éviter toute ambiguïté lors d'une prochaine distribution, joindre également un fichier de notice séparé au paquet reconstruit ; les archives R2 actuelles ne contiennent pas ce fichier de notice.

## Ce qui bloque encore une vente publique

1. **Les anciennes archives R2 1.2.0 et 1.2.1** contiennent encore les fichiers LibDBIcon,
   LibStub et background.tga. Leur présence dans R2 ne les rend pas redistribuables.
   Le code Worker référence actuellement la clé 1.2.0 ; elle ne doit pas être servie
   comme release validée.
2. **Le code original** est couvert par la déclaration de titularité du propriétaire,
   consignée dans `legal/PROPRIETARY-RIGHTS-DECLARATION.md` et limitée au code original.
   Les conditions de licence client (durée, postes, support, mises à jour, garanties
   et modalités de résiliation) ne sont pas encore finalisées ni publiées : le candidat
   reste donc bloqué pour la distribution.
3. **La police DejaVu Sans** est redistribuable avec ses avis Bitstream Vera + Arev,
   qui sont inclus dans le fichier TTF ; la notice séparée reste jointe au paquet.

LibStub, LibDBIcon et background.tga sont désormais des références historiques pour
les anciens ZIP, pas des dépendances du runtime candidat.

## Mise à jour et non-régression

`tests/third-party-notices.test.mjs` conserve l'instantané des empreintes historiques
R2 1.2.0/1.2.1. Le test du builder bloque les chemins non certifiés s'ils réapparaissent.
La validation du paquet candidat doit en plus construire depuis le commit runtime exact,
lire le manifeste et inspecter les entrées ZIP. Aucun test de fixture ne remplace cette
validation de l'artefact réel.

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

## État des droits du paquet candidat

**Dépôt source de référence :** `aveca/Casinobabe`
**Commit source de référence :** `b625ccec5fd61225dd92c5c54fa8721da76c3876`

Le builder compare ces valeurs au dépôt et au HEAD réellement lus dans le checkout
source. Les tables historiques ci-dessous ne servent pas à décider des droits du
candidat courant.

| Composant | Présence | Fondement de la décision | Statut |
|---|---|---|---|
| Code original Casinobabe | oui | Déclaration du titulaire enregistrée dans `legal/PROPRIETARY-RIGHTS-DECLARATION.md`. Les modalités contractuelles destinées au client ne sont pas encore publiées. | **À CONFIRMER** — la titularité est déclarée, mais les conditions de licence client doivent être finalisées avant distribution |
| Police DejaVu Sans | oui | Licence Bitstream Vera + Arev embarquée dans le TTF ; avis et permissions joints dans cette notice livrée avec le paquet. | **ÉTABLI** — redistribution autorisée avec les avis de licence |
| LibStub / LibDBIcon-1.0 / background.tga | non | Absents du commit source exact ci-dessus ; le bouton minimap est natif et le fond est dessiné avec `SetColorTexture`. | **EXCLU** — ces fichiers ne font pas partie du candidat courant |
| wasmoon-lua5.1 / lodash | non | Dépendances déclarées mais non embarquées dans le ZIP candidat. | **NON EMBARQUÉ** — aucun binaire de ces dépendances n'est distribué dans le paquet |
