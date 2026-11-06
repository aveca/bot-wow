#!/usr/bin/env node
/**
 * tests/worker-fulfillment-reconciliation.test.mjs — non-regression P0.56
 * (reconciliation Worker / fulfillment).
 *
 * CONTEXTE MESURE (2026-11-05, production) :
 *   - Worker deploye `botwow-api`, version 50
 *     (`c3dcc842-c422-42d3-9828-405f30d70b5f`, deploiee le 2026-10-27).
 *   - GET https://api.bot-wow.com/bot-wow-gold  -> HTTP 200, HTML marketing
 *     legacy (« Farm your WoW gold », « 100% free »).
 *   - Meme constat sur /best-wow-bot, /bot-wow-classic, /bot-wow-gratuit,
 *     /de/, /en/, /ru/.
 *   => le Worker deploye est ANCIEN : il contient encore le generateur de
 *      pages marketing `handleLanding` et le repli sur une archive
 *      historique, alors que `main` les a supprimes depuis.
 *
 * Ce test verrouille les invariants de `main` (source ET runtime) pour que
 * la reconciliation soit verifiable sans deploiement :
 *
 *   1. aucune route marketing legacy sur l'hote API (308 vers le site
 *      canonique, aucun HTML) ;
 *   2. aucune archive historique en repli, une seule cle d'artefact
 *      configuree (`R2_OBJECT_KEY`), et jamais de requete R2 si la cle est
 *      absente ou invalide ;
 *   3. le quota de telechargement n'est reserve qu'APRES avoir trouve
 *      l'artefact (503 `artifact_unavailable` sans ecrire de quota) ;
 *   4. `Content-Disposition` porte exactement la cle de l'objet servi ;
 *   5. le fournisseur d'e-mail est Resend, fail-closed : sans
 *      `RESEND_API_KEY` aucun envoi n'est tente et la livraison est
 *      consignee en base pour rejeu ; aucun chemin e-mail « console.log
 *      only » ne subsiste.
 *
 * Aucun paiement, aucun e-mail reel, aucun acces R2 reel, aucun appel a un
 * service tiers : tout est simule localement.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

const workerSrc = readFileSync(join(REPO, 'worker', 'index.js'), 'utf8');

/* Le code SANS commentaires : les routes legacy sont mentionnees dans un
   commentaire qui documente justement leur suppression — ce n'est pas une
   implementation. Les assertions de source portent donc sur le code. */
const workerCode = workerSrc
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

/* Le Worker est charge comme module ESM depuis une copie temporaire (convention
   du depot : le bundle n'exporte que son `fetch`). */
const tmpDir = mkdtempSync(join(tmpdir(), 'botwow-worker-'));
const tmpWorker = join(tmpDir, 'worker-under-test.mjs');
let workerMod;
try {
  writeFileSync(tmpWorker, workerSrc);
  workerMod = await import(`${pathToFileURL(tmpWorker).href}?t=${Date.now()}`);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

/* ------------------------------------------------------------- environnement */
const ARTIFACT_KEY = 'casinobabe-fishing-1.2.0.zip';

function makeEnv(state) {
  const db = {
    prepare(sql) {
      const key = sql.replace(/\s+/g, ' ').trim();
      const stmt = {
        bind: (...args) => ({
          run: async () => {
            state.events.push({ type: 'db', sql: key });
            if (/UPDATE downloads SET count = count \+ 1/i.test(key)) {
              state.events.push({ type: 'quota-reserve', sql: key });
              state.quotaReservations += 1;
              return { meta: { changes: state.quotaChanges } };
            }
            if (/INSERT INTO deliveries/i.test(key)) {
              state.deliveries.push({ sql: key, args });
              return { meta: { last_row_id: state.deliveries.length } };
            }
            return { meta: { last_row_id: 0, changes: 1 } };
          },
          first: async () => {
            state.events.push({ type: 'db', sql: key });
            if (/FROM downloads d JOIN licenses l/i.test(key)) return state.downloadRow || null;
            if (/FROM licenses l LEFT JOIN downloads d/i.test(key)) return state.licenseRow || null;
            return null;
          },
          all: async () => [],
        }),
        run: async () => ({ meta: { last_row_id: 0 } }),
        first: async () => null,
        all: async () => [],
      };
      return stmt;
    },
    batch: async () => [],
  };
  const telemetry = {
    prepare: () => ({
      bind: () => ({ run: async () => ({ success: true }) }),
      run: async () => ({ success: true }),
    }),
  };
  return {
    DB: db,
    TELEMETRY_DB: telemetry,
    RATE_LIMIT: { get: async () => null, put: async () => {} },
    R2_BINARIES: {
      get: async (key) => {
        state.events.push({ type: 'r2-get', key });
        if (Object.prototype.hasOwnProperty.call(state.r2Objects, key)) {
          return state.r2Objects[key];
        }
        return null;
      },
    },
    RELEASE_STATUS: 'confirmed',
    state,
  };
}

function newState(overrides = {}) {
  return {
    events: [],
    quotaReservations: 0,
    quotaChanges: 1,
    deliveries: [],
    r2Objects: {},
    downloadRow: {
      token: 'tok_1',
      lic_status: 'active',
      license_key: 'LIC-TEST-1',
      expires_at: Date.now() + 60 * 60 * 1000,
      count: 0,
      max_count: 1,
    },
    licenseRow: { key: 'LIC-TEST-1', lang: 'en', status: 'active', token: 'tok_1' },
    ...overrides,
  };
}

function zipObject() {
  return { body: new Response('PKfake-zip').body, key: ARTIFACT_KEY };
}

async function callDownload(env, token = 'tok_1') {
  const req = new Request('https://api.bot-wow.com/api/download?t=' + encodeURIComponent(token), { method: 'GET' });
  return workerMod.default.fetch(req, env, {});
}

function eventTypes(state, type) {
  return state.events.filter((e) => e.type === type).length;
}

/* ================================================================ 1. MARKETING */
console.log('=== RECONCILIATION WORKER : aucune route marketing legacy ===');

const LEGACY_PATHS = [
  '/', '/de/', '/en/', '/es/', '/pt/', '/ru/',
  '/bot-wow-gold', '/best-wow-bot', '/bot-wow-classic', '/bot-wow-gratuit',
];

for (const path of LEGACY_PATHS) {
  const state = newState();
  const res = await workerMod.default.fetch(
    new Request('https://api.bot-wow.com' + path, { method: 'GET' }),
    makeEnv(state),
    {},
  );
  const location = res.headers.get('location') || '';
  const body = res.status === 308 ? '' : await res.text();
  check(`GET ${path} redirige vers le site canonique`, res.status === 308, `(status=${res.status})`);
  check(`GET ${path} cible https://bot-wow.com`, location.startsWith('https://bot-wow.com'), `(location=${location})`);
  check(`GET ${path} ne rend aucun HTML marketing`,
    !/anti-detection|Farm your|100% free|Get BOT-WOW free/i.test(body));
}

/* ========================================================= 2. INVARIANTS SOURCE */
console.log('');
console.log('=== RECONCILIATION WORKER : invariants de source ===');

check('le generateur de landing legacy est absent', !workerCode.includes('handleLanding'));
check('aucune route SEO legacy dans le code',
  !/bot-wow-gold|best-wow-bot|bot-wow-gratuit|bot-wow-classic/.test(workerCode));
check("aucune archive historique en repli (Casinobabe-v1.0.38)",
  !/Casinobabe-v1\.0\.38/.test(workerSrc));
check('aucune archive historique en repli (v1.0.38.zip)', !/v1\.0\.38\.zip/.test(workerSrc));

const r2GetCalls = workerSrc.match(/R2_BINARIES\.get\(/g) || [];
check('une seule lecture d\'objet R2 dans le Worker', r2GetCalls.length === 1, `(lectures=${r2GetCalls.length})`);
check("l'artefact provient de la seule cle configuree R2_OBJECT_KEY",
  workerSrc.includes('R2_OBJECT_KEY'));
check('la cle d\'artefact est contrainte a un format versionne',
  /casinobabe-fishing-\\d\+\\\.\\d\+\\\.\\d\+\\\.zip|\\^casinobabe-fishing-/.test(workerSrc));
check('une absence d\'artefact repond artifact_unavailable',
  workerSrc.includes('artifact_unavailable'));
check('la reservation de quota est atomique (count < max_count)',
  /UPDATE downloads SET count = count \+ 1 WHERE token = \? AND count < max_count/.test(workerSrc));

/* Ordre statique : l'artefact est recherche AVANT la reservation de quota. */
const idxArtifact = workerSrc.indexOf('R2_BINARIES.get(objectKey)');
const idxQuota = workerSrc.indexOf('UPDATE downloads SET count = count + 1');
check("l'artefact est recherche avant la reservation de quota (source)",
  idxArtifact !== -1 && idxQuota !== -1 && idxArtifact < idxQuota,
  `(artifact=${idxArtifact}, quota=${idxQuota})`);

/* Fournisseur d'e-mail : un seul, fail-closed, sans chemin « log only ». */
check('le fournisseur d\'e-mail est Resend', workerSrc.includes('https://api.resend.com/emails'));
check('la cle RESEND_API_KEY est lue', workerSrc.includes('RESEND_API_KEY'));
check('sans RESEND_API_KEY l\'envoi echoue explicitement',
  workerSrc.includes('aucun secret RESEND_API_KEY configure'));
check('aucun chemin e-mail « console.log only » ne subsiste',
  !/async function sendDeliveryEmail\(/.test(workerCode));
check('le chemin de livraison reel est sendDeliveryEmail2',
  /async function sendDeliveryEmail2\(/.test(workerSrc));

/* ====================================================== 3. RUNTIME TELECHARGEMENT */
console.log('');
console.log('=== RECONCILIATION WORKER : runtime du telechargement ===');

/* ----- 3.1 Artefact configure absent -> 503, AUCUN quota consomme ----- */
{
  const state = newState();
  const env = makeEnv(state);
  env.R2_OBJECT_KEY = ARTIFACT_KEY;
  const res = await callDownload(env);
  const body = await res.json();
  check('artefact absent -> HTTP 503', res.status === 503, `(status=${res.status})`);
  check('artefact absent -> error artifact_unavailable', body.error === 'artifact_unavailable', `(error=${body.error})`);
  check('artefact absent -> aucun quota reserve', state.quotaReservations === 0, `(reservations=${state.quotaReservations})`);
  check('artefact absent -> l\'objet R2 configure a bien ete recherche', eventTypes(state, 'r2-get') === 1);
}

/* ----- 3.2 Artefact present -> 200, nom de fichier = cle exacte ----- */
{
  const state = newState();
  state.r2Objects[ARTIFACT_KEY] = zipObject();
  const env = makeEnv(state);
  env.R2_OBJECT_KEY = ARTIFACT_KEY;
  const res = await callDownload(env);
  const disposition = res.headers.get('content-disposition') || '';
  check('artefact present -> HTTP 200', res.status === 200, `(status=${res.status})`);
  check('artefact present -> Content-Type application/zip',
    (res.headers.get('content-type') || '').includes('application/zip'));
  check('Content-Disposition porte la cle exacte de l\'objet servi',
    disposition === `attachment; filename="${ARTIFACT_KEY}"`, `(disposition=${disposition})`);
  check('artefact present -> un seul quota reserve', state.quotaReservations === 1, `(reservations=${state.quotaReservations})`);

  const order = state.events.map((e) => e.type);
  const iArtifact = order.indexOf('r2-get');
  const iQuota = order.indexOf('quota-reserve');
  check("l'artefact est trouve AVANT la reservation de quota (runtime)",
    iArtifact !== -1 && iQuota !== -1 && iArtifact < iQuota, `(ordre=${order.join('>')})`);
}

/* ----- 3.3 Cle d'artefact invalide -> 503 sans aucune requete R2 ----- */
{
  const state = newState();
  const env = makeEnv(state);
  env.R2_OBJECT_KEY = 'Casinobabe-v1.0.38.zip';
  const res = await callDownload(env);
  const body = await res.json();
  check('cle historique invalide -> HTTP 503', res.status === 503, `(status=${res.status})`);
  check('cle historique invalide -> error artifact_unavailable', body.error === 'artifact_unavailable');
  check('cle historique invalide -> R2 jamais interroge', eventTypes(state, 'r2-get') === 0, `(lectures=${eventTypes(state, 'r2-get')})`);
  check('cle historique invalide -> aucun quota reserve', state.quotaReservations === 0);
}

/* ----- 3.4 Aucune cle configuree -> 503 sans aucune requete R2 ----- */
{
  const state = newState();
  const env = makeEnv(state);
  const res = await callDownload(env);
  const body = await res.json();
  check('cle absente -> HTTP 503', res.status === 503, `(status=${res.status})`);
  check('cle absente -> error artifact_unavailable', body.error === 'artifact_unavailable');
  check('cle absente -> R2 jamais interroge', eventTypes(state, 'r2-get') === 0);
  check('cle absente -> aucun quota reserve', state.quotaReservations === 0);
}

/* ----- 3.5 Quota epuise -> 429, aucun corps d'artefact servi ----- */
{
  const state = newState({ quotaChanges: 0 });
  state.r2Objects[ARTIFACT_KEY] = zipObject();
  const env = makeEnv(state);
  env.R2_OBJECT_KEY = ARTIFACT_KEY;
  const res = await callDownload(env);
  const body = await res.json();
  check('quota epuise -> HTTP 429', res.status === 429, `(status=${res.status})`);
  check('quota epuise -> error limit_reached', body.error === 'limit_reached', `(error=${body.error})`);
  check('quota epuise -> aucun ZIP servi',
    !(res.headers.get('content-type') || '').includes('application/zip'));
}

/* ==================================================== 4. FOURNISSEUR D'E-MAIL */
console.log('');
console.log('=== RECONCILIATION WORKER : fournisseur d\'e-mail fail-closed ===');

{
  const state = newState();
  const env = makeEnv(state);
  /* Aucun RESEND_API_KEY : c'est l'etat « fournisseur d'e-mail absent ». */
  delete env.RESEND_API_KEY;

  const outbound = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    outbound.push(url);
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };

  let res;
  try {
    const req = new Request('https://api.bot-wow.com/api/resend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'client@example.com' }),
    });
    res = await workerMod.default.fetch(req, env, {});
  } finally {
    globalThis.fetch = realFetch;
  }

  const body = await res.json();
  check('/api/resend repond 200', res.status === 200, `(status=${res.status})`);
  check('/api/resend ne revele pas l\'existence d\'une licence (anti-enumeration)',
    body.ok === true && !('key' in body) && !('token' in body), `(body=${JSON.stringify(body)})`);
  check('sans RESEND_API_KEY aucun envoi vers un fournisseur n\'est tente',
    !outbound.some((u) => /resend|mail|smtp/i.test(u)), `(appels=${JSON.stringify(outbound)})`);
  check('sans RESEND_API_KEY la livraison est consignee en base pour rejeu',
    state.deliveries.length === 1, `(lignes=${state.deliveries.length})`);
  if (state.deliveries.length === 1) {
    const row = state.deliveries[0];
    check('la livraison consignee est en statut pending',
      /'pending'/.test(row.sql), `(sql=${row.sql})`);
    check('la livraison consignee est un envoi de type delivery',
      /'delivery'/.test(row.sql), `(sql=${row.sql})`);
  }
}

console.log('');
console.log(failures === 0 ? 'RECONCILIATION WORKER : OK' : `RECONCILIATION WORKER : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
