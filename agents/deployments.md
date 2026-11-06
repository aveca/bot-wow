# Déploiements

Relevé du 2026-11-06T14:48Z. Le Worker `botwow-api` a été déployé depuis `main` `017882a`. Pages, secrets, Mollie, prix et checkout sont inchangés par ce déploiement.

| surface | identifiant | source / version | horodatage | trafic |
|---|---|---|---|---|
| Cloudflare Pages `bot-wow` production | `e1fe25a3-9032-48c5-a5ba-b2433cfc41eb` | commit `ba720c0fce69f4121d5c5b0aa4a168ceac931b70` | 2026-11-06T11:31:08Z | apex `bot-wow.com` (www alias encore attaché, mais la zone redirige). Identifiant relu avant le merge de la PR #129 ; le merge Pages n'a pas été re-listé ici. |
| Worker `botwow-api` | déploiement `6ca34fa3-198a-44b8-a6ed-300e7db37f99` | version `054cd158-4be2-42f8-92a6-ff9c4f059079`, commit `017882a2ba29239801b4e0e6641a54872c4285a3` | 2026-11-06T14:48:17Z | 100 % |
| Worker précédent (rollback immédiat) | `6aecab2d-6545-4c76-a6b3-cfb089372884` | version `1513595c-6a53-4575-b013-9979b696dce3` | 2026-11-06T09:16:54Z | 0 % |
| Worker plus ancien | `36227a4d-00e7-4c9f-94e0-0913b29049bc` | version `c3dcc842-c422-42d3-9828-405f30d70b5f` | 2026-10-27T07:46:28Z | 0 % |
| Redirect Rule zone `bot-wow.com` | règle `3f85f4b6f15546cf98d928b07b597d5b` | `www` → apex, 301 | `last_updated` 2026-11-06T14:16:56Z | observée en HTTP à 14:17:33Z |

Build Pages : `node scripts/build-site.mjs _site`, branche `main`, previews `none`, `path_excludes` vide. Un merge sur `main`, y compris documentaire, reconstruit Pages. Le `paths-ignore` de `.github/workflows/pages.yml` ne couvre que GitHub Actions.

Écart restant : le Worker en service est `017882a`. L'identifiant Pages cité plus haut date d'avant le merge de la PR #129 et n'a pas été relu pendant ce déploiement.
