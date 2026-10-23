/**
 * analytics.js — collecte de parcours first-party.
 *
 * Les evenements sont envoyes au meme domaine que le site (/api/track,
 * Cloudflare Pages Function) et persistes dans D1. Aucun service tiers,
 * aucun identifiant publicitaire, aucune dependance.
 *
 * SCHEMA (version 1)
 *   { v: 1, event: nom, page: chemin, lang: 'en'|'fr', props: {...} }
 *
 * EVENEMENTS
 *   page_view      { step }                       affichage de page
 *   cta_click      { cta, step }                  clic sur un CTA
 *   planner_mode   { mode }                       mode du planificateur
 *   ownership_view { years }                      horizon du cout de possession
 *   checkout_start { step }                       depart du checkout
 *   checkout_error { step }                       echec du checkout
 *
 * REGLES
 *   - aucune donnee personnelle : ni email, ni nom, ni identifiant de
 *     commande, ni texte libre ;
 *   - Do Not Track respecte : rien n est envoye ;
 *   - l'interface n'est jamais bloquee par la collecte : les echecs sont
 *     silencieux et sans nouvelle tentative ;
 *   - tampon memoire borne ; les evenements restent individuels, jamais rejoues en lot.
 */
(function () {
  var SCHEMA = 1;
  /* Point de collecte : MEME ORIGINE par defaut (first-party, aucun
     identifiant publicitaire tiers). Surchargeable par
     window.BOTWOW_TRACK_ENDPOINT pour un test ou un environnement
     different — jamais un secret : c'est une URL publique. */
  var ENDPOINT = (typeof window !== 'undefined' && window.BOTWOW_TRACK_ENDPOINT) || '/api/track';
  var MAX_BUFFER = 20;

  var buffer = [];
  var enabled = true;

  try {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') enabled = false;
  } catch (e) { /* API absente : on continue */ }

  function lang() {
    var l = (document.documentElement.lang || 'en').toLowerCase();
    return l.indexOf('fr') === 0 ? 'fr' : 'en';
  }

  function page() {
    var p = location.pathname || '/';
    if (p.length > 64) p = p.slice(0, 64);
    return p;
  }

  /* Un evenement de test est demande explicitement (?telemetry_test=ref). */
  function testRef() {
    try {
      var m = /[?&]telemetry_test=([a-z0-9_-]{1,40})/.exec(location.search);
      return m ? m[1] : null;
    } catch (e) { return null; }
  }

  var test = testRef();

  function build(event, props) {
    var payload = {
      v: SCHEMA,
      event: event,
      page: page(),
      lang: lang(),
      props: props || {},
    };
    if (test) { payload.test = true; payload.ref = test; }
    return payload;
  }

  function send(payload) {
    if (!enabled) return true;
    var body;
    try {
      body = JSON.stringify(payload);
    } catch (e) {
      return false;
    }

    // sendBeacon est prioritaire, mais un refus de mise en file doit
    // retomber sur fetch. Chaque requete contient un seul evenement :
    // le Worker /api/track n'accepte pas de payload { batch: [...] }.
    try {
      if (navigator.sendBeacon &&
          navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))) {
        return true;
      }
    } catch (e) { /* fallback fetch ci-dessous */ }

    try {
      if (window.fetch) {
        window.fetch(ENDPOINT, {
          method: 'POST',
          body: body,
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          mode: 'same-origin',
          credentials: 'omit',
        }).catch(function () {});
        return true;
      }
    } catch (e) { /* la collecte ne doit jamais casser l'interface */ }

    return false;
  }

  function track(event, props) {
    if (!enabled) return;
    var payload = build(event, props);
    if (!send(payload)) {
      buffer.push(payload);
      if (buffer.length > MAX_BUFFER) buffer.shift();
    }
  }

  /* Publie l'API pour l'application (et pour les tests). */
  window.botwowTrack = track;
  window.botwowTrackFlush = function () {
    if (!enabled || !buffer.length) return;
    var pending = buffer.slice();
    buffer.length = 0;
    // Rejouer les evenements en attente un par un : jamais de lot que
    // le Worker ne sait pas valider. Les echecs restent bornes en memoire.
    pending.forEach(function (payload) {
      if (!send(payload)) {
        buffer.push(payload);
        if (buffer.length > MAX_BUFFER) buffer.shift();
      }
    });
  };

  /* 1. Clics sur les elements marques (delegation : fonctionne meme si le
        contenu est injecte plus tard par app.js). */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-track]') : null;
    if (!el) return;
    var name = el.getAttribute('data-track');
    if (!name) return;
    var props = {};
    var id = el.getAttribute('data-cta-id');
    if (id) props.cta = id;
    var place = el.closest('[id]');
    if (place && place.id) props.step = place.id;
    track(name, props);
  }, { passive: true });

  /* 2. Mode du planificateur. */
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest ? ev.target.closest('#plannerModes button[data-mode]') : null;
    if (!btn) return;
    track('planner_mode', { mode: btn.getAttribute('data-mode') });
  }, { passive: true });

  /* 3. Horizon du calculateur de cout de possession. */
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest ? ev.target.closest('.own-switch button[data-years]') : null;
    if (!btn) return;
    track('ownership_view', { years: Number(btn.getAttribute('data-years')) });
  }, { passive: true });

  /* 4. Depart et echec du checkout. */
  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    if (form && form.id === 'buyForm') {
      track('checkout_start', { step: 'buy_form' });
    }
  }, true);

  /* 5. Affichage de page (une fois, au chargement). */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { track('page_view', { step: 'load' }); });
  } else {
    track('page_view', { step: 'load' });
  }

  /* 6. Fin de page : on vide le tampon. */
  window.addEventListener('pagehide', function () { window.botwowTrackFlush(); });
})();
