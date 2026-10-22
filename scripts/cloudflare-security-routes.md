# Garde-fou HTTP du domaine public — Cloudflare

Le site est publie sur `bot-wow.com` par un projet **Cloudflare Pages**
(projet `bot-wow`, branche `main`, build `node scripts/build-site.mjs _site`).
Un second Worker, `botwow-security-guard`, protege les chemins qui ne
doivent jamais etre servis.

## Pourquoi

Lors d'un deploiement antérieur, le projet Pages avait un build command
vide et un repertoire de sortie a la RACINE du depot : le code du Worker
(`worker/index.js`), `package.json` et les scripts etaient publics. La
cause racine est corrigee (allowlist `scripts/build-site.mjs` +
`.assetsignore` versionne), mais le cache edge de Cloudflare conservait
une entree pour l'URL exacte `/worker/index.js`, servie en `HIT` meme
avec `Cache-Control: no-cache` en requete. Aucune purge n'etait possible
(permission zone `Cache Purge` absente du token disponible).

Cloudflare execute une **route Worker avant la consultation du cache
edge** : une route sur les chemins sensibles neutralise donc l'entree
perimee sans toucher au cache.

## Chemins proteges

| Route | Effet |
|---|---|
| `bot-wow.com/worker/*` | 404 (le Worker repond, le cache n'est pas consulte) |
| `bot-wow.com/package.json` | 404 |
| `bot-wow.com/package-lock.json` | 404 |

Defense en profondeur, cote site :

- `scripts/build-site.mjs` : liste blanche de l'artefact, le build
  **echoue** si un fichier interdit reapparait ;
- `_redirects` : 302 vers `/404.html` pour `/worker/*`, `/scripts/*`,
  `/tests/*`, `/migrations/*`, `/node_modules/*`, `/dist/*`, `/.github/*`,
  `/package.json`, `/package-lock.json`, `/wrangler.toml` ;
- `_headers` : `no-store` sur ces chemins.

## Deploiement

```bash
cd security-guard
npx wrangler deploy
```

## Gestion des routes

```bash
# lister
npx wrangler --help   # ou l'API Cloudflare :
# GET  /zones/{zone_id}/workers/routes
# POST /zones/{zone_id}/workers/routes  {script, pattern}
# DELETE /zones/{zone_id}/workers/routes/{script}
```

Retirer la route redonne la seule protection applicative
(`_redirects` + allowlist de build).

## Verification

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://bot-wow.com/worker/index.js   # 404
curl -sS -o /dev/null -w "%{http_code}\n" https://bot-wow.com/package.json      # 404
curl -sS -o /dev/null -w "%{http_code}\n" https://bot-wow.com/                  # 200
```
