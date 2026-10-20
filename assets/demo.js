/**
 * demo.js — demonstration interactive du bot de peche.
 *
 * La carte est chargee depuis assets/demo-map.json (donnees SIMULEES, produites
 * par le MEME code que le bot local : scripts/fishing_spots.export_map).
 * Le calcul de ronde utilise assets/route-planner.js, dont la parite avec le
 * planificateur Python est verifiee par tests/route-planner-parity.test.mjs.
 */
import { planRound, confirmedSpots } from './route-planner.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('oasis');
const state = { map: null, round: null };

function el(tag, attrs = {}, text = null) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (text !== null) n.textContent = text;
  return n;
}

/** Couleur du banc selon sa fiabilite (meme regle que la carte cote bot). */
function riskColor(spot) {
  const rel = Number(spot.reliability || 0);
  const rate = Number(spot.expectedCatchRate || 0);
  const mobs = (spot.mobs || []).length;
  if (mobs > 0 || rate < 0.4) return '#ef7a7a';
  if (rel < 0.6 || rate < 0.7) return '#e6c65a';
  return '#5ad07a';
}

function riskLabel(leg) {
  if (!leg.verified) return { txt: 'non vérifié', cls: 'risk-mid' };
  if ((leg.obstacles || []).length) return { txt: 'risque : ' + leg.obstacles.join(', '), cls: 'risk-hi' };
  if (leg.successRate < 0.8) return { txt: 'fiabilité ' + Math.round(leg.successRate * 100) + ' %', cls: 'risk-mid' };
  return { txt: 'maîtrisé', cls: 'risk-ok' };
}

function draw() {
  const map = state.map;
  const round = state.round;
  svg.innerHTML = '';

  // fond : oasis (repere minimap)
  svg.appendChild(el('circle', { cx: 0, cy: 0, r: 52, fill: '#0a1a10', stroke: '#1d3a26', 'stroke-width': 1 }));
  svg.appendChild(el('circle', { cx: 0, cy: 0, r: 45, fill: 'none', stroke: '#14301e', 'stroke-width': 1, 'stroke-dasharray': '2 3' }));

  // segments (trajets connus) puis ronde
  for (const seg of Object.values(map.segments || {})) {
    const a = (map.spots || []).find((s) => s.id === seg.a);
    const b = (map.spots || []).find((s) => s.id === seg.b);
    if (!a || !b || a.x === null || b.x === null) continue;
    const used = (round.legs || []).some((l) => (l.from === seg.a && l.to === seg.b) || (l.from === seg.b && l.to === seg.a));
    const risky = (seg.obstacles || []).length > 0 || (seg.failure || 0) > 0;
    svg.appendChild(el('line', {
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      stroke: used ? '#6ea8ff' : (risky ? '#4a1d1d' : '#1e3a2a'),
      'stroke-width': used ? 1.6 : 0.9,
      'stroke-dasharray': used ? '' : '3 3',
      opacity: used ? 0.95 : 0.6,
    }));
  }

  // ordre de la ronde
  (round.order || []).forEach((id, i) => {
    const s = (map.spots || []).find((x) => x.id === id);
    if (!s || s.x === null) return;
    svg.appendChild(el('text', {
      x: s.x + 4.5, y: s.y - 4.5, fill: '#6ea8ff', 'font-size': 4.6, 'font-weight': 700,
    }, String(i + 1)));
  });

  // bancs
  for (const s of confirmedSpots(map)) {
    if (s.x === null) continue;
    const c = riskColor(s);
    svg.appendChild(el('circle', { cx: s.x, cy: s.y, r: 3.1, fill: c, opacity: 0.92 }));
    svg.appendChild(el('circle', { cx: s.x, cy: s.y, r: 5.4, fill: 'none', stroke: c, 'stroke-width': 0.5, opacity: 0.45 }));
    svg.appendChild(el('text', { x: s.x, y: s.y + 9.6, fill: '#8b8ba7', 'font-size': 3.4, 'text-anchor': 'middle' },
      `${Math.round(Number(s.expectedCatchRate || 0) * 100)}%`));
    // mobs
    for (const m of s.mobs || []) {
      svg.appendChild(el('rect', { x: s.x + 4.4, y: s.y - 6.4, width: 2.6, height: 2.6, fill: '#ef7a7a', rx: 0.4 }));
    }
  }
}

function render() {
  const map = state.map;
  const mode = document.getElementById('mode').value;
  const maxSpots = Number(document.getElementById('maxspots').value);
  state.round = planRound(map, { mode, maxSpots });
  const r = state.round;
  const m = r.metrics || {};
  document.getElementById('m-spots').textContent = m.spots ?? '–';
  document.getElementById('m-travel').textContent = `${m.travelSec ?? 0} s`;
  document.getElementById('m-fish').textContent = `${m.fishSec ?? 0} s`;
  document.getElementById('m-exp').textContent = m.expectedCatches ?? '–';
  document.getElementById('m-h').textContent = m.expectedCatchesPerHour ? `${m.expectedCatchesPerHour} /h` : '–';
  document.getElementById('m-unv').textContent = m.unverifiedLegs ?? 0;

  const steps = document.getElementById('steps');
  steps.innerHTML = '';
  const spots = r.order || [];
  spots.forEach((id, i) => {
    const s = (map.spots || []).find((x) => x.id === id);
    const li = document.createElement('li');
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = String(i + 1).padStart(2, '0');
    const txt = document.createElement('span');
    const kind = s && s.kind === 'appat' ? 'appât' : (s && s.kind === 'cible' ? 'cible' : 'banc');
    const catches = s ? (s.catches || 0) : 0;
    const visits = s ? (s.visits || 0) : 0;
    txt.textContent = s ? `${kind} — ${catches} prise(s) sur ${visits} visite(s)` : 'banc';
    li.appendChild(n);
    li.appendChild(txt);
    if (i < r.legs.length) {
      const leg = r.legs[i];
      const info = riskLabel(leg);
      const tag = document.createElement('span');
      tag.className = 'risk ' + info.cls;
      tag.textContent = info.txt;
      li.appendChild(tag);
    }
    steps.appendChild(li);
  });
  draw();
}

async function boot() {
  const res = await fetch('./assets/demo-map.json', { cache: 'no-cache' });
  state.map = await res.json();
  document.getElementById('mode').addEventListener('change', render);
  const ms = document.getElementById('maxspots');
  ms.addEventListener('input', () => {
    document.getElementById('maxspotsv').textContent = ms.value;
    render();
  });
  render();
}

boot().catch((e) => {
  document.getElementById('steps').innerHTML =
    `<li style="color:#ef7a7a">Carte indisponible : ${String(e).slice(0, 120)}</li>`;
});
