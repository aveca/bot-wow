/**
 * analytics.js — instrumentation minimale du parcours.
 *
 * PRINCIPES
 *  - AUCUNE DONNEE PERSONNELLE : ni email, ni nom, ni identifiant de
 *    commande. Seulement des evenements nommes et des proprietes
 *    non identifiantes (un identifiant de CTA, un mode, un horizon).
 *  - SILENCIEUX PAR DEFAUT : sans point de collecte configure, rien ne
 *    sort du navigateur. Les evenements restent dans un tampon memoire
 *    (window.__botwowEvents) pour inspection et test, puis sont effaces.
 *  - TRANSPARENT : le point de collecte se declare explicitement, soit
 *    par <meta name="botwow-track-endpoint" content="https://...">, soit
 *    par window.BOTWOW_TRACK_ENDPOINT avant le chargement du module.
 *  - SANS DEPENDANCE : envoi par navigator.sendBeacon quand il existe,
 *    sinon fetch en mode "keepalive", sinon abandon silencieux.
 *
 * EVENEMENTS (nom, proprietes)
 *   cta_click      { cta: id du CTA, target: href, place: section }
 *   planner_mode   { mode: 'prudent' | 'equilibre' | 'exploration' }
 *   ownership_view { years: 1 | 2 | 3 }
 *   checkout_start { product: 'bot-wow-lifetime' }
 *   waitlist_join  { } (le succes est signale par le serveur, pas ici)
 *
 * Ces evenements mesurent des INTENTIONNERS clics, pas des achats : un
 * achat se compte cote Worker (webhook Mollie), jamais ici.
 */
(function () {
  var ENDPOINT = '';
  try {
    var meta = document.querySelector('meta[name="botwow-track-endpoint"]');
    if (meta && meta.content) ENDPOINT = meta.content;
  } catch (e) { /* meta absent : rien ne part */ }
  if (!ENDPOINT && typeof window.BOTWOW_TRACK_ENDPOINT === 'string') {
    ENDPOINT = window.BOTWOW_TRACK_ENDPOINT;
  }

  var buffer = (window.__botwowEvents = window.__botwowEvents || []);
  var MAX = 100;

  function send(event, props) {
    var payload = { event: event, props: props || {}, at: Date.now() };
    buffer.push(payload);
    if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
    if (!ENDPOINT) return; // aucun point de collecte : rien ne sort
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      } else if (window.fetch) {
        window.fetch(ENDPOINT, {
          method: 'POST',
          body,
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          mode: 'cors',
          credentials: 'omit',
        }).catch(function () {});
      }
    } catch (e) { /* envoi impossible : on ignore, le tampon reste local */ }
  }

  window.botwowTrack = send;

  /* 1. Clics sur les elements marques (delegation : marche meme si le
        contenu est injecte plus tard par app.js). */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-track]') : null;
    if (!el) return;
    var name = el.getAttribute('data-track');
    if (!name) return;
    var props = {};
    var id = el.getAttribute('data-cta-id');
    if (id) props.cta = id;
    var href = el.getAttribute('href');
    if (href) props.target = href;
    var place = el.closest('[id]');
    if (place && place.id) props.place = place.id;
    send(name, props);
  });

  /* 2. Changement de mode du planificateur (le hero). */
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest ? ev.target.closest('#plannerModes button[data-mode]') : null;
    if (!btn) return;
    send('planner_mode', { mode: btn.getAttribute('data-mode') });
  });

  /* 3. Horizon du calculateur de cout de possession. */
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest ? ev.target.closest('.own-switch button[data-years]') : null;
    if (!btn) return;
    send('ownership_view', { years: Number(btn.getAttribute('data-years')) });
  });

  /* 4. Depart du checkout : l'utilisateur a saisi son email et valide. */
  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    if (form && form.id === 'buyForm') {
      send('checkout_start', { product: 'bot-wow-lifetime' });
    }
  }, true);
})();
