# Paquet R2 1.2.1 — déposé, pas encore servi

Date : 2026-11-07. L'objet actuellement téléchargé n'est pas modifié. `R2_OBJECT_KEY` de production reste `casinobabe-fishing-1.2.0.zip`.

## Dépôt nommé Casinababe

`GET /repos/aveca/Casinababe` répond 404. Aucun dépôt distinct de ce nom n'est visible. Le dépôt lisible, non modifié, est `aveca/Casinobabe`. La construction ci-dessous vient de ce dépôt.

## Source retenue

`aveca/Casinobabe` `main` (`e76de1ee3a026a857bb2fa510877295f8ee2b3d5`, 2026-10-30) n'est pas le produit pêche : son `Casinobabe.toc` est en version `1.0.38`, décrit un panneau casino, et ne charge pas `CasinobabeFishing.lua`.

Le bout de la branche `feat/fishing-route-intelligence-v2` est `257418c9a0c2c489a01226e8065ac9c8eaded954` (2026-10-22). C'est le commit propre qui contient l'assistant de pêche. Son toc d'origine dit encore `1.0.38` et « gold casino ».

Correctif unique avant empaquetage, pour que le toc porte la version du paquet :

- `## Version: 1.2.1`
- `## Notes: Casinobabe Fishing Assistant. Desktop package and in-game fishing helper for Interface 20506.`
- `## Interface: 20506` inchangé
- `CasinobabeFishing.lua` reste chargé
- `Casinobabe.lua`, `background.tga` et `casino_uni.ttf` restent dans le paquet : le module pêche s'accroche à la table `Casinobabe` de ce commit. Ils ne sont pas le produit décrit par le toc.

`VERSION` du paquet : `1.2.1`. 30 entrées. Présents : `fishing_assistant.py`, `fishing_bot.py`, `CasinobabeFishing.lua`. Absents : `state/`, `logs/`, `1.0.38`.

## Reproduction

Python 3.12. Deux constructions indépendantes ont donné le même SHA-256. Le script `scripts/rebuild-fishing-package.py` fige `builtAt` à l'horodatage du commit (`2026-10-22T02:18:01`), trie les entrées ZIP et compresse en deflate niveau 6.

```bash
git clone --depth 1 --branch feat/fishing-route-intelligence-v2 \
  https://github.com/aveca/Casinobabe.git /tmp/casinobabe
# HEAD = 257418c9a0c2c489a01226e8065ac9c8eaded954
python3 scripts/rebuild-fishing-package.py /tmp/casinobabe /tmp/out.zip
```

## Objet déposé

| Champ | Valeur |
|---|---|
| Bucket | `botwow-binaries` |
| Clé | `casinobabe-fishing-1.2.1.zip` |
| Taille | 1 385 570 octets |
| SHA-256 | `ef294998a1ac5ce703739f7541ac63d0e61191f55fa8a7129b420b38adf79132` |
| etag | `28a82bc4cca54e427b1232c3c6bf19d8` |

Relecture API après dépôt : même taille, même SHA-256.

## Objet laissé en place

| Champ | Valeur |
|---|---|
| Clé | `casinobabe-fishing-1.2.0.zip` |
| Taille | 1 387 543 octets |
| SHA-256 | `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f` |
| etag | `d9d7ab22ec076873b8fed656a53460bc` |

`R2_OBJECT_KEY` du Worker `botwow-api` est toujours `casinobabe-fishing-1.2.0.zip`. Le basculement se fait avec la réouverture du checkout, pas ici. `GET /api/download` sert encore l'objet 1.2.0.
