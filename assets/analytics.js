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
 *   offer_view     { step }                       affichage de l'offre/prix
 *   demo_open      { step }                       ouverture de la demonstration
 *   cta_click      { cta, step }                  clic sur un CTA
 *   planner_mode   { mode }                       mode du planificateur
 *   ownership_view { years }                      horizon du cout de possession
 *   checkout_start { step }                       depart du checkout (soumission formulaire)
 *   checkout_requested { step }                   clic sur un CTA d'achat
 *   checkout_error { step }                       echec du checkout
 *   journey_view   { cta, step }                  changement de section
 *
 * REGLES
 *   - aucune donnee personnelle : ni email, ni nom, ni identifiant de
 *     commande, ni texte libre ;
 *   - un identifiant de parcours anonyme (journey_id) relie les evenements
 *     d'une meme session sans exposer de donnee personnelle ;
 *   - Do Not Track respecte : rien n est envoye ;
 *   - l'interface n'est jamais bloquee par la collecte : les echecs sont
 *     silencieux et sans nouvelle tentative ;
 *   - tampon memoire borne (20 evenements) et vide a l'envoi.
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

  /* Identifiant de parcours anonyme : genere une fois par session,
     stocke en sessionStorage. Ne contient aucune donnee personnelle. */
  function journeyId() {
    var key = 'botwow_journey_id';
    var stored = sessionStorage.getItem(key);
    if (stored) return stored;
    var id = 'j_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    try { sessionStorage.setItem(key, id); } catch (e) { /* stockage indisponible */ }
    return id;
  }

  var JID = journeyId();

  /* Provenance du trafic, normalisee en courte liste fermee :
     google, yt, reddit, discord, forum, direct, other.
     Aucune URL complete, aucun parametre, aucune donnee personnelle :
     on ne lit que le referrer (hôte) et un utm_source reconnu. */
  var SOURCE_MAP = {
    'google': 'google', 'googlesyndication': 'google',
    'youtube': 'yt', 'yt': 'yt', 'youtu.be': 'yt',
    'reddit': 'reddit', 'redd.it': 'reddit',
    'discord': 'discord', 'discordapp': 'discord', 'discord.gg': 'discord',
    'forum': 'forum', 'forums': 'forum'
  };
  function source() {
    try {
      var q = location.search || '';
      var m = /[?&]utm_source=([a-z0-9._-]{1,30})/i.exec(q);
      // Un UTM present a priorite : une valeur inconnue devient "other",
      // elle ne doit pas etre remplacee a tort par "direct" ou un referrer.
      if (m) {
        var raw = m[1].toLowerCase();
        return SOURCE_MAP[raw] || 'other';
      }
      var ref = document.referrer || '';
      if (!ref) return 'direct';
      var host = ref.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
      if (host.indexOf(location.hostname) >= 0) return 'direct';
      host = host.replace(/^www\./, '');
      if (SOURCE_MAP[host]) return SOURCE_MAP[host];
      if (/(^|\.)google\.[a-z.]+$/.test(host)) return 'google';
      if (/(^|\.)t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/.test(host)) return 'other';
      return 'other';
    } catch (e) { return 'other'; }
  }
  var SRC = source();

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
    // On complete l'objet de proprietes AVANT de le placer dans le payload :
    // réaffecter la variable après coup ne modifierait pas payload.props.
    var p = (props && typeof props === 'object') ? props : {};
    p.journey_id = JID;
    p.source = SRC;
    var payload = {
      v: SCHEMA,
      event: event,
      page: page(),
      lang: lang(),
      props: p,
    };
    if (test) { payload.test = true; payload.ref = test; }
    return payload;
  }

  function send(payload) {
    if (!enabled) return;
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      } else if (window.fetch) {
        window.fetch(ENDPOINT, {
          method: 'POST',
          body: body,
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          mode: 'same-origin',
          credentials: 'omit',
        }).catch(function () {});
      }
    } catch (e) { /* la collecte ne doit jamais casser l'interface */ }
  }

  function track(event, props) {
    if (!enabled) return;
    var payload = build(event, props);
    buffer.push(payload);
    if (buffer.length > MAX_BUFFER) buffer.shift();
    send(payload);
  }

  /* Publie l'API pour l'application (et pour les tests). */
  window.botwowTrack = track;
  window.botwowJourneyId = JID;
  window.botwowTrackFlush = function () {
    if (!enabled || !buffer.length) return;
    try {
      var body = JSON.stringify({ v: SCHEMA, batch: buffer });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      } else if (window.fetch) {
        window.fetch(ENDPOINT, {
          method: 'POST', body: body, keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          mode: 'same-origin', credentials: 'omit',
        }).catch(function () {});
      }
    } catch (e) { /* ignore */ }
    buffer = [];
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

  /* 4. Clics sur les CTA d'achat (checkout_requested). */
  // Écouteur élargi : couvre maintenant 7 IDs CTA buy-réels (contre 4 auparavant),
  // tout en excluant les boutons de démonstration/navigation qui n'ouvrent pas
  // le checkout (hero-demo, final-demo, telemetry-*, radar-, journey-*, steps-demo,
  // compare-cta). Le serveur conserve le contrôle : seul payment_confirmed →
  // license_created → delivery_sent crée une conversion réelle.
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-cta-id="hero-offer"], [data-cta-id="mbar-buy"], [data-cta-id="final-buy"], [data-cta-id="compare-buy"], [data-cta-id="nav-buy"], [data-cta-id="journey-fish-buy"], [data-cta-id="journey-licence-buy"], [data-cta-id="steps-buy"]') : null;
    if (!el) return;
    track('checkout_requested', { step: el.getAttribute('data-cta-id') || 'unknown' });
  }, { passive: true });

  /* 5. Depart et echec du checkout (soumission du formulaire). */
  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    if (form && form.id === 'buyForm') {
      track('checkout_start', { step: 'buy_form' });
    }
  }, true);

  /* 6. Affichage de page (une fois, au chargement). */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { track('page_view', { step: 'load' }); });
  } else {
    track('page_view', { step: 'load' });
  }

  /* Ouverture de la demonstration. */
  if (location.pathname === '/demo.html' || location.pathname === '/fr/demo.html') {
    track('demo_open', { step: 'demo_open' });
  }

  /* 7. Fin de page : on vide le tampon. */
  window.addEventListener('pagehide', function () { window.botwowTrackFlush(); });

  /* 8. Affichage de la section offre (offre_view) : quand la section
        #pricing entre dans le viewport. */
  (function () {
    var pricing = document.querySelector('#pricing');
    if (!pricing || !window.IntersectionObserver) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          track('offer_view', { step: 'pricing' });
          observer.disconnect();
        }
      });
    }, { threshold: 0.1 });
    observer.observe(pricing);
  })();

})();
