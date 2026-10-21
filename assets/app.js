/* BOT-WOW — interactions de la page d'accueil.
   - carte « sonar » du hero : MÊME carte et MÊME planificateur que la démo
     (assets/route-planner.js), donc aucun calcul divergent ;
   - révélation au défilement (désactivée si prefers-reduced-motion) ;
   - achat : le montant et la devise sont fixés côté serveur, le navigateur
     n'envoie que l'e-mail.
*/
import { planRound } from './route-planner.js';

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

  // balayage sonar
  const ping = svgEl('circle', { cx: 0, cy: 0, r: 6, fill: 'none', stroke: '#46e6ff', 'stroke-width': 0.7, class: 'ping' });
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
async function startCheckout(email) {
  const btn = document.getElementById('buyBtn');
  const err = document.getElementById('buyErr');
  const ok = document.getElementById('buyOk');
  err.textContent = '';
  ok.textContent = '';
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Redirection…';
  try {
    // Le navigateur n'envoie QUE l'e-mail : ni montant, ni devise, ni URL.
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, lang: 'fr' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.checkoutUrl) {
      throw new Error(data.error || ('checkout_failed (' + res.status + ')'));
    }
    window.location.href = data.checkoutUrl;
  } catch (e) {
    btn.disabled = false;
    btn.textContent = original;
    err.textContent = 'Le paiement n’a pas pu être lancé : ' + (e.message || e) +
      ' — réessayez ou écrivez à support@bot-wow.com';
  }
}

function wireBuyForm() {
  const form = document.getElementById('buyForm');
  if (!form) return;
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const input = document.getElementById('email');
    const value = (input.value || '').trim();
    const err = document.getElementById('buyErr');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value)) {
      err.textContent = 'Merci d’indiquer une adresse e-mail valide.';
      return;
    }
    startCheckout(value);
  });
}

/* ------------------------------------------------------ révélations */
function wireReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------- boot */
async function boot() {
  wireBuyForm();
  wireReveal();
  try {
    const res = await fetch('./assets/demo-map.json', { cache: 'no-cache' });
    const map = await res.json();
    const round = planRound(map, { mode: 'equilibre' });
    drawHeroMap(map, round);
    const m = round.metrics || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('heroSpots', m.spots ?? '–');
    set('heroTravel', (m.travelSec ?? 0) + ' s');
    set('heroExpected', m.expectedCatches ?? '–');
    set('heroUnv', m.unverifiedLegs ?? 0);
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
