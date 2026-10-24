/**
 * demo.js — demonstration interactive du bot de peche.
 *
 * La carte est chargee depuis assets/demo-map.json (donnees SIMULEES, produites
 * par le MEME code que le bot local : scripts/fishing_spots.export_map).
 * Le calcul de ronde utilise assets/route-planner.js, dont la parite avec le
 * planificateur Python est verifiee par tests/route-planner-parity.test.mjs.
 */
import { planRound, confirmedSpots } from './route-planner.js?v=7e4dddd2';
/* Meme module de collecte que les autres pages (aucune duplication) :
   la demo est une etape du parcours, elle doit donc etre mesuree au
   meme titre que l'accueil et le comparateur. */
import './analytics.js?v=7e4dddd2';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('oasis');
const state = { map: null, round: null, selected: null };

/* Couleurs s'appuient sur l'ID elementText uniquement. Textes affiches :
   la langue vient de <html lang> (EN par defaut, FR sous /fr/). */
const IS_FR = (document.documentElement.lang || 'en').toLowerCase() === 'fr';
const T = IS_FR ? {
  spotEmpty: 'Cliquez un banc sur la carte pour voir ses caractéristiques (données simulées).',
  kindAppat: 'Appât', kindCible: 'Cible', kindBanc: 'Banc',
  kindLowAppat: 'appât', kindLowCible: 'cible', kindLowBanc: 'banc',
  mobsNone: 'aucun observé',
  colType: 'Type', colScore: 'Score de détection', colRel: 'Fiabilité observée',
  colCatches: 'Prises / visites (simulé)', colRate: 'Taux de prise attendu (estimation)',
  colMobs: 'Mobs autour', colLegs: 'Trajets mesurés vers ce banc',
  legUnverified: 'non vérifié', legRisk: 'risque : ', legRel: 'fiabilité ', legMastered: 'maîtrisé',
  modePrudent: 'Prudent', modeEquilibre: 'Équilibré', modeExploration: 'Exploration',
  explHead: 'Mode <b>%M</b> : l\'ordre minimise le <b>coût attendu</b> (temps de déplacement mesuré + pénalité de risque + probabilité d\'échec), puis l\'ordre est amélioré localement (2-opt).',
  explUnv: '<b>%N</b> segment(s) de la ronde n\'ont <b>jamais été mesurés</b> : ils sont signalés et ne sont proposés qu\'en exploration.',
  explAll: 'Tous les segments de cette ronde ont été <b>mesurés</b>.',
  explTravel: 'Déplacement cumulé : <b>%T s</b> · pêche estimée : <b>%F s</b>.',
  explCatch: 'Prises <b>attendues</b> : <b>%C</b> — estimation sur données simulées, jamais une mesure de jeu.',
  stepCatches: '%K — %C prise(s) sur %V visite(s)',
  stepFallback: 'banc',
  mapUnavailable: 'Carte indisponible : %E',
} : {
  spotEmpty: 'Click a spot on the map to see its characteristics (simulated data).',
  kindAppat: 'Bait', kindCible: 'Target', kindBanc: 'School',
  kindLowAppat: 'bait', kindLowCible: 'target', kindLowBanc: 'school',
  mobsNone: 'none observed',
  colType: 'Type', colScore: 'Detection score', colRel: 'Observed reliability',
  colCatches: 'Catches / visits (simulated)', colRate: 'Expected catch rate (estimate)',
  colMobs: 'Mobs nearby', colLegs: 'Measured legs to this spot',
  legUnverified: 'unverified', legRisk: 'risk: ', legRel: 'reliability ', legMastered: 'mastered',
  modePrudent: 'Cautious', modeEquilibre: 'Balanced', modeExploration: 'Exploration',
  explHead: 'Mode <b>%M</b>: the order minimises the <b>expected cost</b> (measured travel time + risk penalty + failure probability), then is improved locally (2-opt).',
  explUnv: '<b>%N</b> leg(s) of the round have <b>never been measured</b>: they are flagged and only offered in exploration mode.',
  explAll: 'Every leg of this round has been <b>measured</b>.',
  explTravel: 'Total travel: <b>%T s</b> · estimated fishing: <b>%F s</b>.',
  explCatch: '<b>Expected</b> catches: <b>%C</b> — an estimate over simulated data, never a game measurement.',
  stepCatches: '%K — %C catch(es) over %V visit(s)',
  stepFallback: 'school',
  mapUnavailable: 'Map unavailable: %E',
};

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
  if (!leg.verified) return { txt: T.legUnverified, cls: 'risk-mid' };
  if ((leg.obstacles || []).length) return { txt: T.legRisk + leg.obstacles.join(', '), cls: 'risk-hi' };
  if (leg.successRate < 0.8) return { txt: T.legRel + Math.round(leg.successRate * 100) + ' %', cls: 'risk-mid' };
  return { txt: T.legMastered, cls: 'risk-ok' };
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
    const selected = state.selected === s.id;
    const g = el('g', { class: 'node' });
    if (selected) {
      g.appendChild(el('circle', { cx: s.x, cy: s.y, r: 9.5, fill: 'none', stroke: '#46e6ff', 'stroke-width': 0.7, opacity: 0.85 }));
    }
    g.appendChild(el('circle', { cx: s.x, cy: s.y, r: 3.1, fill: c, opacity: 0.92, class: 'core' }));
    g.appendChild(el('circle', { cx: s.x, cy: s.y, r: 5.4, fill: 'none', stroke: c, 'stroke-width': 0.5, opacity: 0.45 }));
    g.appendChild(el('text', { x: s.x, y: s.y + 9.6, fill: '#8b8ba7', 'font-size': 3.4, 'text-anchor': 'middle' },
      `${Math.round(Number(s.expectedCatchRate || 0) * 100)}%`));
    // mobs
    for (const m of s.mobs || []) {
      g.appendChild(el('rect', { x: s.x + 4.4, y: s.y - 6.4, width: 2.6, height: 2.6, fill: '#ef7a7a', rx: 0.4 }));
    }
    // zone cliquable : selection du spot
    const hit = el('circle', { cx: s.x, cy: s.y, r: 8, fill: 'transparent', style: 'cursor:pointer' });
    hit.addEventListener('click', () => { state.selected = state.selected === s.id ? null : s.id; render(); });
    g.appendChild(hit);
    svg.appendChild(g);
  }
}

/* ------------------------------------------------- selection d'un spot */
function renderSpotPanel() {
  const panel = document.getElementById('spotPanel');
  if (!panel) return;
  const map = state.map;
  const s = (map.spots || []).find((x) => x.id === state.selected);
  if (!s) {
    panel.innerHTML = `<p class="dim">${T.spotEmpty}</p>`;
    return;
  }
  const kind = s.kind === 'appat' ? T.kindAppat : (s.kind === 'cible' ? T.kindCible : T.kindBanc);
  const mobs = (s.mobs || []).length ? (s.mobs || []).join(', ') : T.mobsNone;
  const legs = (state.round.legs || []).filter((l) => l.from === s.id || l.to === s.id);
  const verified = legs.filter((l) => l.verified).length;
  panel.innerHTML =
    '<table class="metrics">' +
    `<tr><td>${T.colType}</td><td>${kind}</td></tr>` +
    `<tr><td>${T.colScore}</td><td>${Math.round(Number(s.score || 0) * 100)} %</td></tr>` +
    `<tr><td>${T.colRel}</td><td>${Math.round(Number(s.reliability || 0) * 100)} %</td></tr>` +
    `<tr><td>${T.colCatches}</td><td>${s.catches || 0} / ${s.visits || 0}</td></tr>` +
    `<tr><td>${T.colRate}</td><td>${Math.round(Number(s.expectedCatchRate || 0) * 100)} %</td></tr>` +
    `<tr><td>${T.colMobs}</td><td>${mobs}</td></tr>` +
    `<tr><td>${T.colLegs}</td><td>${verified} / ${legs.length}</td></tr>` +
    '</table>';
}

/* --------------------------------------------- explication de l'itinéraire */
function renderExplanation() {
  const box = document.getElementById('explain');
  if (!box) return;
  const r = state.round;
  const m = r.metrics || {};
  const modeLabel = { prudent: T.modePrudent, equilibre: T.modeEquilibre, exploration: T.modeExploration }[r.mode] || r.mode;
  const lines = [];
  lines.push(T.explHead.replace('%M', modeLabel));
  if (m.unverifiedLegs > 0) {
    lines.push(T.explUnv.replace('%N', m.unverifiedLegs));
  } else {
    lines.push(T.explAll);
  }
  lines.push(T.explTravel.replace('%T', m.travelSec).replace('%F', m.fishSec));
  lines.push(T.explCatch.replace('%C', m.expectedCatches));
  box.innerHTML = '<ul>' + lines.map((l) => `<li>${l}</li>`).join('') + '</ul>';
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
    const kind = s && s.kind === 'appat' ? T.kindLowAppat : (s && s.kind === 'cible' ? T.kindLowCible : T.kindLowBanc);
    const catches = s ? (s.catches || 0) : 0;
    const visits = s ? (s.visits || 0) : 0;
    txt.textContent = s ? T.stepCatches.replace('%K', kind).replace('%C', catches).replace('%V', visits) : T.stepFallback;
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
  renderSpotPanel();
  renderExplanation();
  draw();
}

async function boot() {
  // La carte est un file voisin du module (assets/demo-map.json) : la
  // resolution passe par import.meta.url pour fonctionner aussi depuis
  // une page sertie sous /fr/.
  const res = await fetch(new URL('demo-map.json', import.meta.url), { cache: 'no-cache' });
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
    `<li style="color:#ef7a7a">${T.mapUnavailable.replace('%E', String(e).slice(0, 120))}</li>`;
});
