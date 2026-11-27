/* sw.js — coquille hors ligne du compagnon mobile BOT-WOW.
 *
 * CE QUE CE SERVICE WORKER FAIT, EXACTEMENT :
 *   1. a l'installation, il met en cache la coquille : la page, son
 *      manifeste et ses icones. Rien d'autre n'est promis hors ligne.
 *   2. a chaque navigation, il essaie le RESEAU D'ABORD. Une page a jour
 *      est donc servie des qu'il y en a une ; ce n'est que quand le reseau
 *      echoue que la copie cachee est renvoyee.
 *   3. pour les ressources (icones, manifeste), le cache est servi en
 *      premier, puis complete par le reseau — elles sont immuables.
 *
 * CE QU'IL NE FAIT PAS :
 *   - il ne cache aucune donnee d'API ; l'etat du service ne peut donc
 *     jamais etre montre comme frais alors qu'il est perime. La page
 *     marque elle-meme "cached" sa derniere lecture, avec son horodatage.
 *   - il n'invente aucun contenu de remplacement : hors ligne, c'est la
 *     vraie page, avec ses vrais champs.
 *
 * Le nom du cache porte une version : la changer (v1 -> v2) publie une
 * nouvelle coquille et les anciennes entrees sont purges a l'activation.
 */
const CACHE = 'botwow-mobile-shell-v1';
const SHELL = [
  './',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations : reseau d'abord, cache seulement si le reseau tombe.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .catch(() => caches.match('./').then((hit) => hit || Response.error()))
    );
    return;
  }

  // Ressources immuables : cache d'abord, puis reseau (et on complete).
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});