# Runtime Casinobabe — intégration BOT-WOW

## Source identifiée (section P0-2)

| Champ | Valeur | Preuve |
|---|---|---|
| Dépôt source | https://github.com/aveca/Casinobabe | remote `origin` du worktree `casinobabe-v2` |
| Branche de référence | `feat/fishing-route-intelligence-v2` | `origin/feat/fishing-route-intelligence-v2` |
| Commit de référence | `257418c9a0c2c489a01226e8065ac9c8eaded954` | identique local et distant |
| Produit | Casinobabe-Fishing-Assistant 1.2.0 | `dist/VERSION` |
| Interface WoW | `20506` (Classic Era / Anniversary) | `runtime-addon/Casinobabe/Casinobabe.toc` |
| Correspondance BOT-WOW | Oui — Classic Era 1.13 | PRODUCT.md §29, INSTALL.md §2 |

## Paquet distribuable (R2)

| Champ | Valeur |
|---|---|
| Clé R2 cible | `casinobabe-fishing-1.2.0.zip` (`wrangler.toml` var `R2_OBJECT_KEY`) |
| Bucket | `botwow-binaries` (binding `R2_BINARIES`) |
| SHA-256 (reproduit depuis commit propre 257418c) | `4FB2D1C1C954C286305DFCF1C70A688C7E3E77FBA15E352A24A88916708F9FBA` |
| SHA-256 (dist existant, buildé avec mods locaux non commités) | `1C132F367607EA186FEFFDE8BBDA0A1A9F94CDEC4B7850B93C57C271270BBA4F` |
| Taille (reproduit) | 1 385 603 octets |
| Taille (existant) | 1 387 543 octets |

**Note :** les deux SHA diffèrent car le `dist/` existant dans le worktree `casinobabe-v2` a été construit à partir d'un état incluant des modifications locales non commitées (fichiers `M` sur plusieurs `scripts/fishing_*.py`). Le paquet reproduit depuis le commit propre `257418c` est la référence reproductible.

### État R2 et configuration live — vérifiés le 2026-11-07

L'objet `casinababe-fishing-1.2.0.zip` **est déjà présent** dans le bucket `botwow-binaries` :
- taille : **1 387 543 octets** ;
- dernière modification : `2026-10-27T06:31:06.784Z` ;
- SHA-256 recalculé sur les octets téléchargés : `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f`.

Le Worker `botwow-api` v52 (version `054cd158-4be2-42f8-92a6-ff9c4f059079`, 100 % du trafic au contrôle) utilise `R2_OBJECT_KEY=casinababe-fishing-1.2.0.zip` avec le bucket `R2_BINARIES`. Aucune valeur de secret n'a été lue et aucun objet R2 n'a été modifié.

**Conséquence :** le fichier actuellement configuré est l'ancien build avec modifications locales non commitées, pas le build propre reproductible ci-dessus. La présence de l'objet ne certifie donc pas la distribution du build propre. Son remplacement nécessiterait une écriture R2 explicitement autorisée.

## Procédure de build (reproductible)

Depuis une copie propre du dépôt aveca/Casinobabe à `257418c` :

```bash
python scripts/build_desktop_package.py --version 1.2.0 --out dist
```

Produit : `dist/Casinobabe-Fishing-Assistant-1.2.0.zip` + `MANIFEST.json` (SHA-256 par fichier) + `VERSION`.
Aucun chemin absolu n'est écrit dans le paquet : reproductible sur n'importe quel poste.

## Tests du runtime (réels, pas de simulation)

| Suite | Résultat |
|---|---|
| `tests/test_fishing_bot_contract.py` | 24 ok / 0 échec |

Couvre : détection flotteur (eau diurne + nocturne), garde "pas d'eau pas de lancer", cheveux rouges / leurres écartés, signaux de morsure, clics différés et reprise, contrat des logs (champs obligatoires), protection contre les doubles instances.

## Statut

Le runtime source est identifié et auditable. Au moins une fonction (pêche) est réellement testée. Le paquet est reproductible et vérifié SHA-256.

**Blocages restants pour la commercialisation :**
- Le paquet propre reproductible n'est pas celui actuellement configuré dans R2 ; son remplacement reste à autoriser.
- Aucune compatibilité serveur n'est datée (matrice `assets/compat.json` de BOT-WOW : tout `not_tested`).
- Le checkout public reste fermé. La valeur du secret `RELEASE_STATUS` n'a pas été lue.
- Aucun profil Mollie dédié BOT-WOW n'est confirmé par les preuves disponibles.
- Aucune installation, activation ou livraison E2E n'est certifiée.

Ce document ne prétend pas que le produit est prêt à la vente. Il constate l'existence et la reproductibilité du runtime source.
