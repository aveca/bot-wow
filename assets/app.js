/* BOT-WOW — interactions de la page d'accueil.
   - carte « sonar » du hero : MÊME carte et MÊME planificateur que la démo
     (assets/route-planner.js), donc aucun calcul divergent ;
   - révélation au défilement (désactivée si prefers-reduced-motion) ;
   - achat : le montant et la devise sont fixés côté serveur, le navigateur
     n'envoie que l'e-mail.
*/
import { planRound } from './route-planner.js?v=b662d2ee';
import './analytics.js?v=b662d2ee';
import './journey.js?v=b662d2ee';
import './session.js?v=b662d2ee';
import './film.js?v=b662d2ee';

// La classe `js` est posee des le chargement du module : sans JavaScript,
// le CSS n'applique aucune masquee (page 100% lisible). Elle est posee
// AVANT toute peinture pour eviter un flash de contenu non anime.
document.documentElement.classList.add('js');

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ----------------------------------------------------------------- carte */
function svgEl(tag, attrs = {}, text = null) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (text !== null) n.textContent = text;
  return n;
}

function riskColor(spot) {
  const rate = Number(spot.expectedCatchRate || 0);
  const mobs = (spot.mobs || []).length;
  if (mobs > 0 || rate < 0.4) return '#ff6b6b';
  if (rate < 0.7) return '#ffb545';
  return '#4ade80';
}

function drawHeroMap(map, round) {
  const svg = document.getElementById('heroMap');
  if (!svg) return;
  svg.innerHTML = '';

  // fond : disque de minicarte + grille technique
  svg.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 50, fill: 'rgba(70,230,255,0.045)', stroke: '#17233a' }));
  for (let rr = 14; rr <= 46; rr += 16) {
    svg.appendChild(svgEl('circle', { cx: 0, cy: 0, r: rr, fill: 'none', stroke: '#101a2b', 'stroke-width': 0.6 }));
  }
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    svg.appendChild(svgEl('line', {
      x1: Math.cos(rad) * 12, y1: Math.sin(rad) * 12,
      x2: Math.cos(rad) * 50, y2: Math.sin(rad) * 50,
      stroke: '#101a2b', 'stroke-width': 0.6,
    }));
  }
  // nord
  svg.appendChild(svgEl('text', { x: 0, y: -53, fill: '#46e6ff', 'font-size': 5, 'text-anchor': 'middle', 'font-family': 'monospace' }, 'N'));

  // trajet de la ronde (pointillés animés)
  const spots = map.spots || [];
  const byId = {};
  spots.forEach((s) => { byId[s.id] = s; });
  (round.legs || []).forEach((leg) => {
    const a = byId[leg.from];
    const b = byId[leg.to];
    if (!a || !b) return;
    svg.appendChild(svgEl('line', {
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      stroke: leg.verified ? '#46e6ff' : '#ffb545',
      'stroke-width': leg.verified ? 1.3 : 1,
      'stroke-dasharray': leg.verified ? '5 5' : '2 4',
      opacity: leg.verified ? 0.9 : 0.75,
      class: leg.verified ? 'route-path' : '',
    }));
  });

  // Balayage sonar : un secteur qui tourne en continu (groupe SVG anime
  // en CSS via `transform`, donc compose sans repaint). C'est l'instrument
  // qui donne au radar sa fonction de lecture, pas un simple cercle.
  const sweepId = 'sweepGrad' + Math.random().toString(36).slice(2, 8);
  const defs = svgEl('defs');
  const grad = svgEl('linearGradient', {
    id: sweepId, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 28, y2: 0,
  });
  grad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#5fb4d8', 'stop-opacity': '0.55' }));
  grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#5fb4d8', 'stop-opacity': '0' }));
  defs.appendChild(grad);
  svg.appendChild(defs);
  const sweepG = svgEl('g', { class: 'sweep' });
  sweepG.appendChild(svgEl('path', {
    d: 'M0,0 L0,-52 A52,52 0 0,1 27.2,37.3 Z', fill: `url(#${sweepId})`, opacity: '0.22',
  }));
  sweepG.appendChild(svgEl('line', {
    x1: 0, y1: 0, x2: 0, y2: -52, stroke: '#5fb4d8', 'stroke-width': '0.7', opacity: '0.6',
  }));
  svg.appendChild(sweepG);

  // balayage sonar
  const ping = svgEl('circle', { cx: 0, cy: 0, r: 6, fill: 'none', stroke: '#5fb4d8', 'stroke-width': 0.7, class: 'ping' });
  svg.appendChild(ping);

  // bancs
  (round.order || []).forEach((id, i) => {
    const s = byId[id];
    if (!s || s.x === null) return;
    const c = riskColor(s);
    const g = svgEl('g', { class: 'node' });
    g.appendChild(svgEl('circle', { cx: s.x, cy: s.y, r: 3.4, fill: c, opacity: 0.9, class: 'core' }));
    g.appendChild(svgEl('circle', { cx: s.x, cy: s.y, r: 6.2, fill: 'none', stroke: c, 'stroke-width': 0.5, opacity: 0.4 }));
    g.appendChild(svgEl('text', { x: s.x + 5, y: s.y - 4.4, fill: '#46e6ff', 'font-size': 4.6, 'font-family': 'monospace' }, String(i + 1)));
    svg.appendChild(g);
  });
}

/* ---------------------------------------------------------------- achat */
// L'API vit sur api.bot-wow.com : le site statique n'a pas de proxy meme
// origine (verifie : /api/config sur bot-wow.com renvoie 404). On utilise
// donc l'URL absolue de l'API, avec un repli meme origine si l'API est
// proxifiee ulterieurement.
const API_BASE = 'https://api.bot-wow.com';

async function startCheckout(email) {
  const btn = document.getElementById('buyBtn');
  const err = document.getElementById('buyErr');
  const ok = document.getElementById('buyOk');
  // La page est servie en EN par defaut et en FR sous /fr/ ; la langue
  // declaree par <html lang> pilote aussi la langue de livraison de la cle.
  const isFr = (document.documentElement.lang || 'en').toLowerCase() === 'fr';
  const T = isFr
    ? { pending: 'Redirection…',
        fail: 'Le paiement n’a pas pu être lancé (%1) — réessayez, ou écrivez à support@bot-wow.com : la licence peut être délivrée à la main.',
        waitOk: 'Merci ! Votre demande est enregistrée. Le support vous répond et peut délivrer la licence manuellement.',
        waitErr: 'Envoi impossible (%1) — réessayez ou écrivez à support@bot-wow.com.' }
    : { pending: 'Redirecting…',
        fail: 'Payment could not be started (%1) — try again, or email support@bot-wow.com and we will issue the licence manually.',
        waitOk: 'Thank you! Your request is registered. Support answers and can issue the licence manually.',
        waitErr: 'Could not register (%1) — try again or email support@bot-wow.com.' };
  err.textContent = '';
  ok.textContent = '';
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = T.pending;
  const payload = { email, lang: isFr ? 'fr' : 'en' };
  let data = null;
  let lastError = null;
  for (const base of [API_BASE, '']) {
    try {
      const res = await fetch(base + '/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.checkoutUrl) { data = body; break; }
      lastError = body.error || ('http_' + res.status);
    } catch (e) {
      lastError = String(e && e.message ? e.message : e);
    }
  }
  if (!data) {
    btn.disabled = false;
    btn.textContent = original;
    err.textContent = T.fail.replace('%1', lastError || 'error');
    // Le parcours s'est arrete ici : on le signale (sans aucune PII).
    if (typeof window.botwowTrack === 'function') {
      window.botwowTrack('checkout_error', { step: 'no_checkout_url' });
    }
    return;
  }
  window.location.href = data.checkoutUrl;
}

/* ------------------------------------------------- canal de repli support */
/* Le paiement carte FONCTIONNE (montant et devise fixes cote serveur). Ce
   formulaire n'est donc pas une "liste d'attente d'ouverture du paiement" :
   c'est un canal de repli reel. Si le checkout echoue, ou si le visiteur
   veut payer autrement (rail manuel, facture), son adresse part dans la
   meme file /api/subscribe et le support repond. */
async function wireWaitlist() {
  for (const form of document.querySelectorAll('form[data-waitlist]')) {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const isFr = (document.documentElement.lang || 'en').toLowerCase() === 'fr';
      const input = form.querySelector('input[type=email]');
      const out = form.querySelector('.wl-state');
      const value = (input.value || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value)) {
        if (out) out.textContent = isFr ? 'Adresse e-mail invalide.' : 'Invalid email address.';
        return;
      }
      const btn = form.querySelector('button');
      if (btn) btn.disabled = true;
      let sent = false, lastError = null;
      for (const base of [API_BASE, '']) {
        try {
          const res = await fetch(base + '/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: value, lang: isFr ? 'fr' : 'en' }),
          });
          if (res.ok) { sent = true; break; }
          lastError = res.status;
        } catch (e) { lastError = String(e && e.message ? e.message : e); }
      }
      if (btn) btn.disabled = false;
      if (out) {
        out.textContent = sent
          ? (isFr ? 'Merci ! Votre demande est enregistrée — le support vous répond.' : 'Thank you! Your request is registered — support will answer you.')
          : (isFr ? 'Envoi impossible (%1) — réessayez ou écrivez à support@bot-wow.com.' : 'Could not register (%1) — try again or email support@bot-wow.com.').replace('%1', lastError);
      }
    });
  }
}

function wireBuyForm() {
  const form = document.getElementById('buyForm');
  if (!form) return;
  // La langue declaree par <html lang> pilote les messages : la page EN ne
  // doit jamais afficher un message en francais (corrige 2026-10-23).
  const isFr = (document.documentElement.lang || 'en').toLowerCase() === 'fr';
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const input = document.getElementById('email');
    const value = (input.value || '').trim();
    const err = document.getElementById('buyErr');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value)) {
      err.textContent = isFr
        ? 'Merci d’indiquer une adresse e-mail valide.'
        : 'Please enter a valid email address.';
      return;
    }
    startCheckout(value);
  });
}

/* ------------------------------------------------------ révélations
   Chorégraphie d'apparition au scroll (V9).
   - la classe `js` n'est posée QUE si JavaScript est actif : sans JS,
     aucun élément n'est masqué (la page reste lisible) ;
   - un seul observer, avec un décalage progressif par groupe (les enfants
     d'un même conteneur révèlent en cascade) ;
   - `prefers-reduced-motion` : on ne masque rien du tout. */
const REVEAL_SELECTOR = [
  '.section-head', '.metric-card', '.step', '.formula', '.ledger-row', '.price-card',
  '.honest-band', '.verdict', '.cmptable', '.evidence-strip', '.band',
  '.docstrip-alt > *', '.telemetry',
].join(',');

function wireReveal() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return; // rien n'est masqué : le contenu est visible d'emblée

  const targets = [...document.querySelectorAll(REVEAL_SELECTOR)];
  if (!targets.length) return;

  // Index de décalage par conteneur parent : les éléments d'un même
  // groupe révèlent en cascade, les groupes restent indépendants.
  const perParent = new Map();
  for (const el of targets) {
    const p = el.parentElement;
    const i = perParent.get(p) || 0;
    perParent.set(p, i + 1);
    el.style.setProperty('--reveal-i', String(Math.min(i, 3)));
    el.classList.add('reveal');
  }

  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
  targets.forEach((el) => io.observe(el));

  // Filet de securite : si un element n'a pas ete revele (conteneur masque,
  // navigateur etrange, onglet en arriere-plan), on le revele quand meme.
  // Le contenu ne doit JAMAIS rester invisible a cause d'une animation.
  setTimeout(() => {
    targets.forEach((el) => { if (!el.classList.contains('is-in')) el.classList.add('is-in'); });
  }, 3000);
}

/* -------------------------------------------------- module ledger */
async function loadModuleLedger() {
  const container = document.getElementById('moduleLedger');
  if (!container) return;
  try {
    const res = await fetch(new URL('modules.json', import.meta.url), { cache: 'no-cache' });
    const data = await res.json();
    const modules = data.modules || [];
    const statusOrder = ['available', 'development', 'planned'];
    const statusClass = { 'available': 'shipped', 'development': 'dev', 'planned': 'plan' };
    const statusLabel = data.statuses || { 'available': { en: 'Available' }, 'development': { en: 'In development' }, 'planned': { en: 'Planned' } };
    const isFr = (document.documentElement.lang || 'en').toLowerCase() === 'fr';
    
    // Sort by status order, then by id
    modules.sort((a, b) => {
      const ai = statusOrder.indexOf(a.status);
      const bi = statusOrder.indexOf(b.status);
      if (ai !== bi) return ai - bi;
      return (a.id || '').localeCompare(b.id || '');
    });

    // Build rows
    for (const mod of modules) {
      const shippedCount = (mod.shipped?.[isFr ? 'fr' : 'en'] || []).length;
      const pendingCount = (mod.pending?.[isFr ? 'fr' : 'en'] || []).length;
      const total = shippedCount + pendingCount;
      const progress = total > 0 ? Math.round((shippedCount / total) * 100) : 0;
      
      const row = document.createElement('div');
      row.className = 'ledger-row';
      const title = mod.title?.[isFr ? 'fr' : 'en'] || mod.id;
      const desc = mod.summary?.[isFr ? 'fr' : 'en'] || '';
      const status = mod.status || 'planned';
      const sClass = statusClass[status] || 'dev';
      const sLabel = statusLabel[status]?.[isFr ? 'fr' : 'en'] || status;
      
      // Progression : on anime une echelle (transform composite), pas une
      // largeur : aucun recalcul de layout pendant l'animation.
      const pct = Math.max(3, Math.round(progress));
      row.innerHTML = `
        <div class="ledger-main">
          <span class="ledger-name">${title}</span>
          <span class="ledger-desc">${desc}</span>
          <div class="ledger-tags" aria-label="Features"></div>
        </div>
        <div class="ledger-progress">
          <div class="ledger-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progress"><span style="--p:${pct / 100}"></span></div>
          <span class="ledger-pct">${pct}%</span>
        </div>
        <div class="ledger-status"><span class="st st-${sClass}"><i></i>${sLabel}</span></div>
      `;
      container.appendChild(row);
      // Add feature tags from shipped items
      const tagsEl = row.querySelector('.ledger-tags');
      const shipped = mod.shipped?.[isFr ? 'fr' : 'en'] || [];
      shipped.slice(0, 4).forEach(f => {
        const tag = document.createElement('span');
        tag.className = 'ledger-tag';
        tag.textContent = f.length > 40 ? f.slice(0, 37) + '…' : f;
        tagsEl.appendChild(tag);
      });
    }
  } catch (e) {
    console.warn('Module ledger load failed:', e);
  }
}

/* ------------------------------------------------------ etat de scroll nav
   La navigation se densifie des que la page a defile : un seul seuil,
   un seul etat, une seule transition. */
function wireNavScroll() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ticking = false;
  const update = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 12);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
  update();
  if (reduce) nav.classList.remove('is-scrolled');
}

/* -------------------------------------------------- planificateur du hero
   L'aha moment : le visiteur fait tourner le VRAI planificateur (memes
   regles que le bot local, parite verifiee par tests/route-planner-parity)
   sur la VRAIE carte simulee, et voit la ronde se recalculer.
   SEE : la carte et ses bancs.  DECIDE : le mode.  GO : les CTA. */
let heroMapData = null;

function updateHeroStats(round) {
  const m = round.metrics || {};
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('heroSpots', m.spots ?? '–');
  set('heroTravel', (m.travelSec ?? 0) + ' s');
  set('heroExpected', m.expectedCatchesPerHour != null ? m.expectedCatchesPerHour + '/h' : (m.expectedCatches ?? '–'));
  set('heroUnv', m.unverifiedLegs ?? 0);
}

function wireHeroPlanner() {
  const group = document.getElementById('plannerModes');
  if (!group) return;
  if (!heroMapData) { group.hidden = true; return; }
  group.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-mode]');
    if (!btn) return;
    const mode = btn.dataset.mode;
    const already = btn.getAttribute('aria-pressed') === 'true';
    if (already) return;
    group.querySelectorAll('button[data-mode]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b === btn));
    });
    const round = planRound(heroMapData, { mode });
    drawHeroMap(heroMapData, round);
    updateHeroStats(round);
  });
}

/* -------------------------------------------------- cout de possession
   Comparaison de depense reelle, a partir de prix PUBLIES et cites.
   BOT-WOW : 20,00 EUR une fois.
   PixelBuddy : 19,99 EUR / 30 jours (Farming Pack) et a partir de
   6,99 EUR / 30 jours (a la carte, un role).
   Source : pixelwowbot.com/#pricing, lu le 2026-10-22.
   L'hypothese de renouvellement est ecrite noir sur blanc : on ne cache
   pas que leur tarif est un abonnement. */
const OWNERSHIP = {
  ours: 20,          // EUR, une fois
  packMonthly: 19.99, // EUR / 30 jours, renouvellement
  carteMonthly: 6.99, // EUR / 30 jours, a la carte (role unique)
};

function fmtEUR(n) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function wireOwnership() {
  const box = document.getElementById('ownership');
  if (!box) return;
  const years = Number(box.dataset.years || 1);
  const months = years * 12;
  const theirsPack = OWNERSHIP.packMonthly * months;
  const theirsCarte = OWNERSHIP.carteMonthly * months;
  const max = Math.max(OWNERSHIP.ours, theirsPack, theirsCarte);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('ownOurs', fmtEUR(OWNERSHIP.ours));
  set('ownPack', fmtEUR(theirsPack));
  set('ownCarte', fmtEUR(theirsCarte));
  const bars = [
    ['ownOursBar', OWNERSHIP.ours], ['ownPackBar', theirsPack], ['ownCarteBar', theirsCarte],
  ];
  for (const [id, v] of bars) {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.max(3, Math.round((v / max) * 100)) + '%';
  }
  set('ownSaving', fmtEUR(Math.max(0, theirsPack - OWNERSHIP.ours)));

  const group = box.querySelector('.own-switch');
  if (!group) return;
  group.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-years]');
    if (!btn) return;
    box.dataset.years = btn.dataset.years;
    group.querySelectorAll('button[data-years]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b === btn));
    });
    wireOwnershipValues();
  });
}

function wireOwnershipValues() {
  const box = document.getElementById('ownership');
  if (!box) return;
  const years = Number(box.dataset.years || 1);
  const months = years * 12;
  const theirsPack = OWNERSHIP.packMonthly * months;
  const theirsCarte = OWNERSHIP.carteMonthly * months;
  const max = Math.max(OWNERSHIP.ours, theirsPack, theirsCarte);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('ownOurs', fmtEUR(OWNERSHIP.ours));
  set('ownPack', fmtEUR(theirsPack));
  set('ownCarte', fmtEUR(theirsCarte));
  const bars = [['ownOursBar', OWNERSHIP.ours], ['ownPackBar', theirsPack], ['ownCarteBar', theirsCarte]];
  for (const [id, v] of bars) {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.max(3, Math.round((v / max) * 100)) + '%';
  }
  set('ownSaving', fmtEUR(Math.max(0, theirsPack - OWNERSHIP.ours)));
}

/* -------------------------------------------------- comparateur en accordeon
   Sur petit ecran, le comparateur (26 criteres) deployait 14 670 px. Les
   groupes sont des <details> natifs : on ne laisse ouvert que le premier,
   et l'utilisateur ouvre ce qui l'interesse. Sur grand ecran tout reste
   deploye (les <details> portent l'attribut `open`). */
function wireCompareAccordion() {
  const groups = [...document.querySelectorAll('.cmp-group')];
  if (!groups.length) return;
  const mq = window.matchMedia('(max-width: 760px)');
  const apply = () => {
    if (mq.matches) groups.forEach((g, i) => { if (i > 0) g.removeAttribute('open'); });
    else groups.forEach((g) => g.setAttribute('open', ''));
  };
  apply();
  if (mq.addEventListener) mq.addEventListener('change', apply);
}

/* --------------------------------------------- barre d'action desktop */
/* La barre collante (.mbar) est permanente sur mobile. Sur desktop, elle
   n'apparait qu'une fois le hero quitte : la section d'achat est situee
   apres plusieurs ecrans de contenu, et sans ce rappel un visiteur engage
   dans la lecture devrait remonter toute la page pour payer.

   Honnetete : la barre affiche le prix REEL (20,00 EUR) et rien d'autre —
   pas de remise, pas de compte a rebours, pas de fausse rarete. */
function wireActionBar() {
  const bar = document.querySelector('.mbar');
  if (!bar) return;
  const hero = document.querySelector('.hero');
  // Mobile : la barre est toujours visible (CSS), aucune classe requise.
  if (window.matchMedia('(max-width: 760px)').matches) {
    bar.classList.add('is-on');
    return;
  }
  if (!hero || !('IntersectionObserver' in window)) {
    // Sans observateur : on garde la barre visible des que l'on quitte le
    // haut de la page (repli sur le scroll, jamais l'inverse).
    const onScroll = () => {
      if (window.scrollY > (hero ? hero.offsetHeight : 600)) bar.classList.add('is-on');
      else bar.classList.remove('is-on');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      // Le hero n'est plus (ou peu) visible -> la barre apparait.
      if (e.isIntersecting && e.intersectionRatio > 0.15) bar.classList.remove('is-on');
      else bar.classList.add('is-on');
    }
  }, { threshold: [0, 0.15, 0.5] });
  io.observe(hero);
}

/* ------------------------------------------------------------- boot */
async function boot() {
  wireBuyForm();
  wireWaitlist();
  wireReveal();
  wireNavScroll();
  wireOwnership();
  wireCompareAccordion();
  wireActionBar();
  loadModuleLedger();
  try {
    // Résolu depuis l'URL du MODULE (pas de la page) : la carte doit se
    // charger identiquement depuis /, /fr/ et /docs/... (bug FR repéré en QA
    // visuelle : fetch relatif à la page -> 404 sur les pages /fr/).
    const mapUrl = new URL('demo-map.json', import.meta.url);
    const res = await fetch(mapUrl, { cache: 'no-cache' });
    const map = await res.json();
    heroMapData = map;
    // La carte est exposee au module d'etape (session.js) : c'est elle
    // qui pose le marqueur du spot memorise, sur de VRAIES coordonnees.
    window.botwowHeroMap = map;
    const round = planRound(map, { mode: 'equilibre' });
    drawHeroMap(map, round);
    updateHeroStats(round);
    wireHeroPlanner();
  } catch (e) {
    // Le hero reste lisible même sans la carte : on ne casse pas la page.
    const svg = document.getElementById('heroMap');
    if (svg) {
      svg.appendChild(svgEl('text', {
        x: 0, y: 0, fill: '#6b8199', 'font-size': 4, 'text-anchor': 'middle', 'font-family': 'monospace',
      }, 'carte indisponible'));
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
