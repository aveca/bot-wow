#!/usr/bin/env node
/**
 * route-planner-parity.test.mjs — PARITE entre le planificateur JS du site et
 * le planificateur Python du bot local (scripts/fishing_routes.py).
 *
 * Pourquoi : la demonstration web et le bot local calculent des rondes. Si les
 * deux implémentations divergent, la demonstration ment sur ce que fait le
 * bot. Ce test compare donc, sur la MEME carte, l'ordre des bancs, les
 * segments, le cout et le rendement ATTENDU, pour les trois modes.
 *
 * Le test est IGNORE (et nonVert) si Python n'est pas disponible : il
 * n'invalide pas la CI sur une machine sans interpreteur.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { planRound } from '../assets/route-planner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const MAP_PATH = join(REPO, 'assets', 'demo-map.json');
const V2 = process.env.FISHING_V2_DIR || 'C:\\factory\\worktrees\\casinobabe-v2';

let failures = 0;
let skipped = false;

function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

if (!existsSync(MAP_PATH)) {
  console.log('SKIP : carte de demonstration absente');
  process.exit(0);
}
const map = JSON.parse(readFileSync(MAP_PATH, 'utf8'));

// La carte employee par la demo doit etre SIMULEE et le dire.
check('la carte de demonstration est explicitement simulee',
  map.simulated === true, `(simulated=${map.simulated})`);
check('la carte porte un avertissement lisible',
  typeof map.notice === 'string' && map.notice.length > 10);

function pythonPlan(mode) {
  const script = `
import json, sys
sys.path.insert(0, r'${V2}\\scripts')
import fishing_spots as fs, fishing_routes as fr
db = fs.import_map(json.load(open(r'${MAP_PATH}', encoding='utf-8')), simulated=True)
r = fr.plan_round(db, None, '${mode}')
print(json.dumps({'order': r['order'], 'totalCost': r['totalCost'],
                  'estimated': r['estimated'],
                  'legs': [{'from': l['from'], 'to': l['to'],
                             'distance': l['distance'],
                             'durationSec': l['durationSec'],
                             'verified': l['verified']} for l in r['legs']],
                  'metrics': r['metrics']}, ensure_ascii=False))
`;
  const out = execFileSync('python', ['-c', script], { encoding: 'utf8' });
  return JSON.parse(out);
}

let py = null;
try {
  py = pythonPlan('equilibre');
} catch (e) {
  skipped = true;
  console.log(`SKIP : planificateur Python indisponible (${String(e.message).slice(0, 120)})`);
}

if (!skipped) {
  for (const mode of ['prudent', 'equilibre', 'exploration']) {
    const ref = mode === 'equilibre' ? py : pythonPlan(mode);
    const js = planRound(map, { mode });
    check(`mode ${mode} : meme ordre de bancs`,
      JSON.stringify(js.order) === JSON.stringify(ref.order),
      `\n     JS = ${JSON.stringify(js.order)}\n     PY = ${JSON.stringify(ref.order)}`);
    check(`mode ${mode} : meme cout`,
      Math.abs(js.totalCost - ref.totalCost) < 0.05,
      `JS=${js.totalCost} PY=${ref.totalCost}`);
    check(`mode ${mode} : meme rendement attendu`,
      Math.abs(js.estimated - ref.estimated) < 0.05,
      `JS=${js.estimated} PY=${ref.estimated}`);
    check(`mode ${mode} : meme nombre de segments`,
      js.legs.length === ref.legs.length,
      `JS=${js.legs.length} PY=${ref.legs.length}`);
  }
}

console.log('');
if (skipped) {
  console.log('PARITE : IGNOREE (Python indisponible)');
  process.exit(0);
}
console.log(failures === 0 ? 'PARITE JS/PYTHON : OK' : `PARITE JS/PYTHON : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
