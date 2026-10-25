#!/usr/bin/env node
/**
 * telemetry.test.mjs — validation du point de collecte /api/track.
 *
 * La logique serveur est testee sans reseau : le Worker est importe et
 * appele avec un D1 simule, ce qui permet de verifier :
 *   - la validation stricte des evenements et de leurs proprietes ;
 *   - le refus des charges malformees, trop grosses ou hors liste ;
 *   - la limitation de debit (429) ;
 *   - l'ecriture effective en base, avec les bonnes colonnes ;
 *   - l'absence de toute donnee personnelle acceptee.
 *
 * Le test de bout en bout (requete reelle + relecture en base) est dans
 * `scripts/telemetry-e2e.mjs` : il vise la production.
 */
import { handleTrack, validateEvent } from '../telemetry-worker/index.js';

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

/* --- D1 simule : memorise les INSERT et le compteur de debit --- */
function makeDb() {
  const state = { inserts: [], rl: new Map(), purged: 0 };
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (/INSERT INTO rl/i.test(sql)) {
                const key = args[0] + '|' + args[1];
                state.rl.set(key, (state.rl.get(key) || 0) + 1);
                return { success: true };
              }
              if (/INSERT INTO events/i.test(sql)) {
                state.inserts.push(args);
                return { success: true };
              }
              if (/DELETE FROM events/i.test(sql)) { state.purged++; return { success: true }; }
              return { success: true };
            },
            async first() {
              if (/SELECT count FROM rl/i.test(sql)) {
                const key = args[0] + '|' + args[1];
                return { count: state.rl.get(key) || 0 };
              }
              return null;
            },
          };
        },
      };
    },
  };
  return { db, state };
}

const BASE_ENV = { TELEMETRY_DB: null, TELEMETRY_SALT: 'sel-de-test' };
let CURRENT_ENV = BASE_ENV;

function req(body, headers = {}) {
  const h = new Headers({ 'content-type': 'application/json', ...headers });
  return new Request('https://bot-wow.com/api/track', {
    method: headers.__method || 'POST',
    headers: h,
    body: headers.__method === 'GET' ? undefined : body,
  });
}

console.log('=== TELEMETRIE : validation du point de collecte ===');

/* --- 1. evenement valide : ecrit en base --- */
{
  const { db, state } = makeDb();
  CURRENT_ENV = { ...BASE_ENV, TELEMETRY_DB: db };
  const res = await handleTrack(req(JSON.stringify({
    v: 1, event: 'cta_click', page: '/', lang: 'en', props: { cta: 'hero-buy', step: 'hero' },
  })), CURRENT_ENV);
  const r = await res.json();
  check('un evenement valide renvoie 202', res.status === 202, `(status ${res.status})`);
  check('un evenement valide est marque "stored"', r.stored === true, `(corps ${JSON.stringify(r)})`);
  check('une ligne est ecrite en base', state.inserts.length === 1, `(lignes ${state.inserts.length})`);
  const row = state.inserts[0] || [];
  check('la ligne contient l evenement', row[1] === 'cta_click', `(${row[1]})`);
  check('la ligne contient la page', row[2] === '/', `(${row[2]})`);
  check('la ligne contient la langue', row[3] === 'en', `(${row[3]})`);
  check('la ligne contient le CTA', row[4] === 'hero-buy', `(${row[4]})`);
  check('la ligne ne contient aucun email', !JSON.stringify(row).includes('@'), '');
  check('l IP n est pas stockee en clair', !JSON.stringify(row).includes('203.0.113'), '');
  check('l IP est hashee', typeof row[10] === 'string' && row[10].length === 16, `(${row[10]})`);
}

/* --- 2. evenement de test : marque et rattache a une reference --- */
{
  const { db, state } = makeDb();
  CURRENT_ENV = { ...BASE_ENV, TELEMETRY_DB: db };
  const res = await handleTrack(req(JSON.stringify({
    v: 1, event: 'page_view', page: '/compare', lang: 'fr', props: { step: 'load' },
    test: true, ref: 'e2e-abc123',
  })), CURRENT_ENV);
  const row = state.inserts[0] || [];
  check('un evenement de test est accepte', res.status === 202, `(status ${res.status})`);
  check('un evenement de test est marque test=1', row[9] === 1, `(${row[9]})`);
  check('un evenement de test porte sa reference', row[8] === 'e2e-abc123', `(${row[8]})`);
}

/* --- 3. charges invalides --- */
{
  const { db } = makeDb();
  CURRENT_ENV = { ...BASE_ENV, TELEMETRY_DB: db };
  const cases = [
    ['JSON invalide', '{pas du json', 400],
    ['version inconnue', JSON.stringify({ v: 99, event: 'cta_click', page: '/', lang: 'en' }), 400],
    ['evenement hors liste', JSON.stringify({ v: 1, event: 'hack', page: '/', lang: 'en' }), 400],
    ['page hors liste', JSON.stringify({ v: 1, event: 'page_view', page: 'javascript:alert(1)', lang: 'en' }), 400],
    ['langue inconnue', JSON.stringify({ v: 1, event: 'page_view', page: '/', lang: 'xx' }), 400],
    ['propriete hors liste', JSON.stringify({ v: 1, event: 'planner_mode', page: '/', lang: 'en', props: { mode: 'hack; DROP TABLE' } }), 400],
    ['annee hors bornes', JSON.stringify({ v: 1, event: 'ownership_view', page: '/', lang: 'en', props: { years: 9999 } }), 400],
    ['test sans reference', JSON.stringify({ v: 1, event: 'page_view', page: '/', lang: 'en', test: true }), 400],
    ['corps trop gros', JSON.stringify({ v: 1, event: 'page_view', page: '/', lang: 'en', props: { step: 'x'.repeat(9000) } }), 413],
  ];
  for (const [label, body, expected] of cases) {
    const res = await handleTrack(req(body), CURRENT_ENV);
    check(`refuse : ${label}`, res.status === expected, `(status ${res.status}, attendu ${expected})`);
  }
}

/* --- 4. methode et type de contenu --- */
{
  const { db } = makeDb();
  CURRENT_ENV = { ...BASE_ENV, TELEMETRY_DB: db };
  const bad = await handleTrack(req(null, { __method: 'GET' }), CURRENT_ENV);
  check('refuse : methode non POST', bad.status === 405, `(status ${bad.status})`);
  const wrongType = await handleTrack(req(JSON.stringify({ v: 1, event: 'page_view', page: '/', lang: 'en' }), { 'content-type': 'text/plain' }), CURRENT_ENV);
  check('refuse : type de contenu non JSON', wrongType.status === 415, `(status ${wrongType.status})`);
}

/* --- 5. limitation de debit --- */
{
  const { db } = makeDb();
  CURRENT_ENV = { ...BASE_ENV, TELEMETRY_DB: db };
  let limited = 0;
  for (let i = 0; i < 70; i++) {
    const res = await handleTrack(req(JSON.stringify({ v: 1, event: 'page_view', page: '/', lang: 'en', props: { step: 'load' } })), CURRENT_ENV);
    if (res.status === 429) limited++;
  }
  check('la limitation de debit se declenche', limited > 0, `(429 : ${limited} fois)`);
  check('la limite est atteinte a 60/min', limited === 10, `(429 : ${limited} fois sur 70)`);
}

/* --- 6. stockage indisponible : reponse gracieuse --- */
{
  CURRENT_ENV = BASE_ENV; // pas de base : le site ne doit pas dependre de la collecte
  const res = await handleTrack(req(JSON.stringify({ v: 1, event: 'page_view', page: '/', lang: 'en' })), CURRENT_ENV);
  const r = await res.json();
  check('sans base, la reponse reste 202', res.status === 202, `(status ${res.status})`);
  check('sans base, stored=false', r.stored === false, `(corps ${JSON.stringify(r)})`);
}

/* --- 7. validation pure --- */
{
  check('validateEvent rejette un null', validateEvent(null) === null);
  check('validateEvent rejette un tableau', validateEvent([]) === null);
  const ok = validateEvent({ v: 1, event: 'planner_mode', page: '/', lang: 'en', props: { mode: 'exploration' } });
  check('validateEvent accepte un evenement valide', ok && ok.mode === 'exploration');
  check('validateEvent refuse une propriete non listee', validateEvent({ v: 1, event: 'cta_click', page: '/', lang: 'en', props: { email: 'a@b.c' } }) === null);
}

console.log(failures === 0 ? '\nTELEMETRIE : OK' : `\nTELEMETRIE : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
