# Déploiements

Relevé lecture seule du 2026-11-06. Ce cycle n'a rien déployé.

| surface | identifiant | source / version | horodatage | trafic |
|---|---|---|---|---|
| Cloudflare Pages `bot-wow` production | `e1fe25a3-9032-48c5-a5ba-b2433cfc41eb` | commit `ba720c0fce69f4121d5c5b0aa4a168ceac931b70` | 2026-11-06T11:31:08Z | apex `bot-wow.com` (www alias encore attaché, mais la zone redirige) |
| Worker `botwow-api` | déploiement `6aecab2d-6545-4c76-a6b3-cfb089372884` | version `1513595c-6a53-4575-b013-9979b696dce3` | 2026-11-06T09:16:54Z | 100 % |
| Worker précédent (rollback possible) | `36227a4d-00e7-4c9f-94e0-0913b29049bc` | version `c3dcc842-c422-42d3-9828-405f30d70b5f` | 2026-10-27T07:46:28Z | 0 % |
| Redirect Rule zone `bot-wow.com` | règle `3f85f4b6f15546cf98d928b07b597d5b` | `www` → apex, 301 | `last_updated` 2026-11-06T14:16:56Z | observée en HTTP à 14:17:33Z |

Build Pages : `node scripts/build-site.mjs _site`, branche `main`, previews `none`, `path_excludes` vide. Un merge sur `main`, y compris documentaire, reconstruit Pages. Le `paths-ignore` de `.github/workflows/pages.yml` ne couvre que GitHub Actions.

Écart : le déploiement Worker de 09:16Z n'est pas le SHA Pages `ba720c0`. Le fichier `worker/index.js` de HEAD est celui de `8744a3e`, déjà contenu dans ce SHA. Les commits suivants sont du site, de la CI et de la documentation.
