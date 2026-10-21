/**
 * route-planner.js — calcul des rondes de peche (regles identiques au
 * programme local scripts/fishing_routes.py).
 *
 * POURQUOI DUPLIQUER ? Le programme local est en Python, le site en JS. Plutot
 * que de garder deux implementations qui divergent, les regles sont portees
 * ligne a ligne et la PARITE est verifiee par un test automatise
 * (tests/route-planner-parity.test.mjs) qui compare la ronde JS et la ronde
 * Python sur la meme carte. Toute divergence fait echouer la CI.
 *
 * Modele de donnees : le format d'echange de la carte (exporte par
 * fishing_spots.export_map) : {reference, spots[], segments{}}.
 */

export const COST_PER_UNIT_UNMEASURED = 1.2;
export const COST_OBSTACLE = 6.0;
export const RISK_WEIGHT = { prudent: 3.0, equilibre: 1.0, exploration: 0.4 };
export const YIELD_WEIGHT = { prudent: 1.0, equilibre: 1.6, exploration: 0.6 };
export const AVAILABILITY_WEIGHT = { prudent: 1.2, equilibre: 1.2, exploration: 0.5 };
export const MODES = ['prudent', 'equilibre', 'exploration'];
export const CONFIRM_MIN_SCORE = 0.62;

function mode0(mode) {
  const m = (mode || 'equilibre').toLowerCase();
  return MODES.includes(m) ? m : 'equilibre';
}

function dist(a, b) {
  if (!a || !b) return null;
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function mean(values) {
  const v = (values || []).filter((x) => x !== null && x !== undefined);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

/** Bancs confirmes (>= 2 observations et score suffisant). */
export function confirmedSpots(map) {
  return (map.spots || []).filter(
    (s) => (s.observations || 0) >= 2 && (s.score || 0) >= CONFIRM_MIN_SCORE
  );
}

export function buildGraph(map, mode = 'equilibre') {
  const m = mode0(mode);
  const reference = map.reference || 'minimap';
  const nodes = {};
  for (const s of confirmedSpots(map)) {
    if (s.x === null || s.x === undefined || s.y === null || s.y === undefined) continue;
    nodes[s.id] = {
      spot: s,
      pos: [Number(s.x), Number(s.y)],
      meta: {
        zone: s.zone,
        kind: s.kind,
        score: Number(s.score || 0),
        observations: s.observations || 0,
        visits: s.visits || 0,
        catches: s.catches || 0,
        reliability: Number(s.reliability || 0),
        expectedCatchRate: Number(s.expectedCatchRate || 0.5),
        availability: Number(s.availability || 1),
        mobs: s.mobs || [],
        accessMean: mean(s.accessTimes),
        fishMean: mean(s.fishTimes),
      },
    };
  }

  const edges = {};
  for (const seg of Object.values(map.segments || {})) {
    const a = seg.a;
    const b = seg.b;
    if (!nodes[a] || !nodes[b]) continue;
    const d = dist(nodes[a].pos, nodes[b].pos);
    const durations = seg.durations || [];
    const runs = seg.runs || 0;
    const success = seg.success || 0;
    const failure = seg.failure || 0;
    const rate = runs ? success / runs : 0;
    const e = {
      dist: d,
      verified: runs > 0,
      meanDuration: durations.length ? mean(durations) : null,
      successRate: rate,
      obstacles: seg.obstacles || [],
      runs,
    };
    edges[`${a}>${b}`] = e;
    edges[`${b}>${a}`] = { ...e };
  }

  if (m === 'exploration') {
    const ids = Object.keys(nodes);
    for (const a of ids) {
      const cands = [];
      for (const b of ids) {
        if (a === b) continue;
        const k = `${a}>${b}`;
        if (edges[k]) continue;
        const d = dist(nodes[a].pos, nodes[b].pos);
        if (d !== null) cands.push([d, b]);
      }
      cands.sort((x, y) => x[0] - y[0]);
      for (const [d, b] of cands.slice(0, 3)) {
        const e = {
          dist: d, verified: false, meanDuration: null, successRate: 0,
          obstacles: [], runs: 0, hypothetical: true,
        };
        edges[`${a}>${b}`] = e;
        edges[`${b}>${a}`] = { ...e };
      }
    }
  }
  return { nodes, edges, reference, mode: m };
}

export function edgeCost(graph, a, b, mode = 'equilibre') {
  const m = mode0(mode);
  const e = graph.edges[`${a}>${b}`];
  if (!e) return null;
  const d = e.dist || 0;
  let travel;
  if (e.meanDuration !== null && e.meanDuration !== undefined) {
    travel = Number(e.meanDuration);
  } else {
    if (m !== 'exploration') return null;
    travel = d * COST_PER_UNIT_UNMEASURED;
  }
  const risk = (e.obstacles || []).length * COST_OBSTACLE;
  if (e.runs) travel *= 1 + (1 - (e.successRate || 0)) * 2;
  return travel + risk * (RISK_WEIGHT[m] ?? 1);
}

function nodeValue(node, mode = 'equilibre') {
  const m = mode0(mode);
  const meta = node.meta;
  const rate = Number(meta.expectedCatchRate ?? 0.5);
  const avail = Number(meta.availability ?? 1);
  const rel = Number(meta.reliability ?? 0);
  let penalty = 0;
  if (meta.fishMean) penalty = Math.max(0, Number(meta.fishMean) - 20) * 0.02;
  return rate * (AVAILABILITY_WEIGHT[m] ?? 1) * (0.5 + 0.5 * rel) - penalty;
}

export function nearestNeighbour(graph, start, mode = 'equilibre') {
  const m = mode0(mode);
  const remaining = new Set(Object.keys(graph.nodes));
  const order = graph.nodes[start] ? [start] : [];
  if (remaining.has(start)) remaining.delete(start);
  let cur = start;
  while (remaining.size) {
    let best = null;
    let bestC = null;
    for (const sid of [...remaining].sort()) {
      let c = null;
      if (cur) {
        c = edgeCost(graph, cur, sid, m);
        // PAS de repli geometrique : un segment non franchissable est ignore
        // (le repli faisait passer le planificateur JS pour un banc
        // inatteignable — divergence avec Python, detectee par le test de
        // parite). En mode exploration, les liaisons geometriques sont
        // DEJA presentes dans le graphe avec un cout et verified=false.
      }
      if (c === null) continue;
      if (bestC === null || c < bestC) { best = sid; bestC = c; }
    }
    if (!best) break;
    order.push(best);
    remaining.delete(best);
    cur = best;
  }
  return order;
}

export function twoOpt(order, graph, mode = 'equilibre') {
  const m = mode0(mode);
  if (order.length < 4) return order.slice();
  const total = (seq) => {
    let t = 0;
    for (let i = 0; i < seq.length - 1; i++) {
      const c = edgeCost(graph, seq[i], seq[i + 1], m);
      if (c === null) return null;
      t += c;
    }
    return t;
  };
  let best = order.slice();
  let bestCost = total(best);
  if (bestCost === null) return best;
  let improved = true;
  let guard = 0;
  while (improved && guard < 50) {
    improved = false;
    guard += 1;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 2; j < best.length; j++) {
        const cand = best.slice(0, i + 1)
          .concat(best.slice(i + 1, j + 1).reverse())
          .concat(best.slice(j + 1));
        const c = total(cand);
        if (c !== null && c < bestCost - 1e-9) {
          best = cand;
          bestCost = c;
          improved = true;
        }
      }
    }
  }
  return best;
}

export function planRound(map, options = {}) {
  const mode = mode0(options.mode);
  const graph = buildGraph(map, mode);
  const nodeIds = Object.keys(graph.nodes);
  if (!nodeIds.length) {
    return {
      order: [], legs: [], totalCost: 0, estimated: 0, mode,
      unverified: [], metrics: {}, graph: { nodes: 0, edges: 0 },
    };
  }
  let start = options.start;
  if (!start || !graph.nodes[start]) {
    const cands = nodeIds
      .map((id) => [id, nodeValue(graph.nodes[id], mode)])
      .sort((a, b) => b[1] - a[1]);
    start = cands.length ? cands[0][0] : null;
  }
  let order = twoOpt(nearestNeighbour(graph, start, mode), graph, mode);
  if (options.maxSpots) order = order.slice(0, options.maxSpots);

  const legs = [];
  let total = 0;
  const unverified = [];
  let travelTotal = 0;
  let fishTotal = 0;
  for (let i = 0; i < order.length - 1; i++) {
    const a = order[i];
    const b = order[i + 1];
    const e = graph.edges[`${a}>${b}`];
    const c = edgeCost(graph, a, b, mode);
    if (c === null || !e) continue;
    legs.push({
      from: a, to: b,
      distance: e.dist === null || e.dist === undefined ? null : Number(e.dist.toFixed(2)),
      durationSec: e.meanDuration === null || e.meanDuration === undefined
        ? null : Number(Number(e.meanDuration).toFixed(1)),
      verified: !!e.verified,
      successRate: Number((e.successRate || 0).toFixed(3)),
      obstacles: e.obstacles || [],
      cost: Number(c.toFixed(2)),
    });
    total += c;
    if (!e.verified) unverified.push({ from: a, to: b });
    if (e.meanDuration) travelTotal += Number(e.meanDuration);
  }

  let expected = 0;
  for (const sid of order) {
    const meta = graph.nodes[sid].meta;
    expected += Number(meta.expectedCatchRate ?? 0.5) * Number(meta.availability ?? 1);
    if (meta.fishMean) fishTotal += Number(meta.fishMean);
  }
  const metrics = {
    spots: order.length,
    travelSec: Number(travelTotal.toFixed(1)),
    fishSec: Number(fishTotal.toFixed(1)),
    expectedCatches: Number(expected.toFixed(2)),
    expectedCatchesPerHour: (travelTotal + fishTotal) > 0
      ? Number((expected * 3600 / (travelTotal + fishTotal)).toFixed(2)) : null,
    unverifiedLegs: unverified.length,
  };
  return {
    order, legs, totalCost: Number(total.toFixed(2)),
    estimated: Number(expected.toFixed(2)), mode, unverified, metrics,
    graph: { nodes: Object.keys(graph.nodes).length, edges: Object.keys(graph.edges).length },
  };
}

export function explain(round) {
  const lines = [];
  lines.push(`Mode : ${round.mode}`);
  lines.push(`Bancs : ${round.order.length}`);
  let i = 1;
  for (const leg of round.legs) {
    lines.push(
      `  ${i++}. ${leg.from.slice(0, 9)} -> ${leg.to.slice(0, 9)} : ${leg.distance} unites, ` +
      `${leg.durationSec} s${leg.verified ? '' : '  [NON VERIFIE]'}`
    );
  }
  const m = round.metrics || {};
  lines.push(`Deplacement : ${m.travelSec} s | peche : ${m.fishSec} s`);
  lines.push(`Prises ATTENDUES : ${m.expectedCatches} (${m.expectedCatchesPerHour}/h)`);
  if (round.unverified && round.unverified.length) {
    lines.push(`Segments non mesures utilises : ${round.unverified.length}`);
  }
  return lines.join('\n');
}
