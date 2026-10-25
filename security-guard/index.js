/**
 * security-guard — garde-fou HTTP du domaine public.
 *
 * POURQUOI CE WORKER EXISTE : le cache edge de Cloudflare conservait une
 * entree pour l'URL exacte /worker/index.js (heritee d'un deploiement
 * "racine du depot") et la servait toujours (cf-cache-status: HIT),
 * malgre les directives client (no-cache, max-age=0, Range). Aucune
 * requete de purge n'etait possible avec les permissions disponibles.
 *
 * Cloudflare execute la route Worker AVANT la consultation du cache edge :
 * une route sur les chemins sensibles suffit donc a neutraliser l'entree
 * perimee. Le Worker repond 404 et n'expose rien.
 *
 * Ce qui fait aussi la loi, en amont :
 *   - scripts/build-site.mjs : liste blanche de l'artefact publie ;
 *   - _redirects : redirection 302 des memes chemins vers la 404 du site ;
 *   - _headers : no-store sur ces chemins.
 *
 * Deploiement : cd security-guard && npx wrangler deploy
 * Route : voir scripts/cloudflare-security-routes.md
 */
export default {
  async fetch() {
    return new Response('Not found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  },
};
