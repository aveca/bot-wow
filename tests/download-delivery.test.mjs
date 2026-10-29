#!/usr/bin/env node
/**
 * download-delivery.test.mjs — regression de livraison du paquet v1.2.0.
 *
 * Couvre le point identifie sans test lors de P0.1 §4.3 : le point de
 * telechargement /api/download n'avait aucun test de download (seuls les
 * scenarios de paiement etaient couverts par payment-flow.test.mjs).
 *
 * Appelle le VRAI Worker (worker/index.js) avec un D1 simule, un KV stateful
 * (rate-limit reel) et un R2 simule (objet present ou absent). Aucun appel
 * reseau, aucun paiement, aucun e-mail, aucune ecriture R2.
 *
 * Verifie :
 *  1. jeton manquant -> 400 missing_token
 *  2. jeton inconnu -> 404 invalid
 *  3. quota de telechargement (20/h/IP) -> 429 rate_limited au-dela
 *  4. jeton valide + licence active + objet R2 present ->
 *     200, Content-Type application/zip, Content-Disposition nom v1.2.0,
 *     corps identique aux octets attendus, compteur incremente
 *  5. jeton valide + licence active + objet R2 ABSENT ->
 *     404 file_not_found (ECART : PR #19 prévoit 503 artifact_unavailable,
 *     non encore merge dans main)
 *  6. licence revokee -> 403 ; expiree -> 410 ; limite atteinte -> 429
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const ZIP_PATH = 'C:\\\\factory\\\\reports\\\\bot-wow\\\\pkg\\\\casinobabe-fishing-1.2.0.zip';
const EXPECTED_OBJECT_KEY = 'casinobabe-fishing-1.2.0.zip';

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

/* ---------------------------------------------------------- environnement */
const zipBytes = readFileSync(ZIP_PATH);

function makeD1(state) {
  const rowByToken = state.rowByToken || new Map();
  return {
    prepare(sql) {
      const key = sql.replace(/\s+/g, ' ').trim();
      return {
        bind: (...args) => ({
          run: async () => {
            if (/UPDATE downloads SET count = count \+ 1 WHERE token = \?/i.test(key)) {
              const token = args[0];
              const row = rowByToken.get(token);
              if (row) row.count = (row.count || 0) + 1;
            }
            return { meta: { changes: 1 } };
          },
          first: async () => {
            if (/FROM downloads d/i.test(key) && /WHERE d\.token = \?/i.test(key)) {
              return rowByToken.get(args[0]) || null;
            }
            return null;
          },
        }),
      };
    },
  };
}

function makeKV() {
  const store = new Map();
  return {
    get: async (k) => {
      const v = store.get(k);
      return v === undefined ? null : JSON.parse(v);
    },
    put: async (k, v, opts) => { store.set(k, v); if (opts && opts.expirationTtl) store.set(k + ':ttl', opts.expirationTtl); },
  };
}

function makeEnv(state) {
  return {
    DB: makeD1(state),
    RATE_LIMIT: makeKV(),
    R2_BINARIES: {
      get: async (key) => {
        if (key === EXPECTED_OBJECT_KEY) {
          return { body: zipBytes };
        }
        if (key === 'Casinobabe-v1.0.38.zip') return null;
        return null;
      },
    },
    R2_OBJECT_KEY: EXPECTED_OBJECT_KEY,
    state,
  };
}

/* --------------------------------------------------------------- Worker */
const tmpWorker = join(HERE, '.worker-download-delivery.mjs');
writeFileSync(tmpWorker, readFileSync(join(REPO, 'worker', 'index.js'), 'utf8'));
const workerMod = await import('file:///' + tmpWorker.replace(/\\/g, '/') + '?t=' + Date.now());

async function callDownload(token, env, { ip = '203.0.113.10' } = {}) {
  const url = 'https://api.bot-wow.com/api/download' + (token === undefined ? '' : '?t=' + encodeURIComponent(token));
  const req = new Request(url, { headers: { 'cf-connecting-ip': ip } });
  return workerMod.default.fetch(req, env, {});
}

function envWithRow(token, over = {}) {
  const row = {
    token,
    license_id: 'lic_1',
    count: 0,
    max_count: 5,
    expires_at: Date.now() + 86400000,
    lic_status: 'active',
    license_key: 'BOTW-KEY-TEST',
    ...over,
  };
  const state = { rowByToken: new Map([[token, row]]) };
  return { env: makeEnv(state), row };
}

/* ------------------------------------------------------------------ tests */
console.log('=== LIVRAISON DU PAQUET v1.2.0 via /api/download (Worker reel) ===');

/* 1. jeton manquant */
{
  const res = await callDownload(undefined, makeEnv({ rowByToken: new Map() }));
  check('jeton manquant repond 400 missing_token', res.status === 400, `(status=${res.status})`);
  const body = await res.json();
  check('code d\'erreur missing_token', body.error === 'missing_token', `(recu ${body.error})`);
}

/* 2. jeton inconnu */
{
  const res = await callDownload('jeton-inconnu-p022', makeEnv({ rowByToken: new Map() }));
  check('jeton inconnu repond 404 invalid', res.status === 404, `(status=${res.status})`);
  const body = await res.json();
  check('code d\'erreur invalid', body.error === 'invalid', `(recu ${body.error})`);
}

/* 3. quota de telechargement par IP (meme KV entre les requetes) */
{
  const quotaEnv = makeEnv({ rowByToken: new Map() });
  const statuses = [];
  for (let i = 0; i < 21; i++) {
    const res = await callDownload('jeton-pour-quota-p022', quotaEnv);
    statuses.push(res.status);
  }
  const allowed = statuses.slice(0, 20).every((s) => s === 404);
  check('les 20 premieres requetes passent le quota (404 invalide, pas 429)', allowed, `(statuts ${statuses.slice(0, 5).join(',')}…)`);
  check('la 21e requete est refusee en 429 rate_limited', statuses[20] === 429, `(statut ${statuses[20]})`);
  if (statuses[20] === 429) {
    const res = await callDownload('jeton-pour-quota-p022', quotaEnv);
    const body = await res.json();
    check('la reponse 429 indique rate_limited', body.error === 'rate_limited', `(recu ${body.error})`);
  }
}

/* 4. telechargement valide : 200 + headers + corps identique + compteur */
{
  const { env, row } = envWithRow('tok-ok-p022');
  const res = await workerMod.default.fetch(
    new Request('https://api.bot-wow.com/api/download?t=tok-ok-p022', { headers: { 'cf-connecting-ip': '198.51.100.77' } }),
    env, {}
  );
  check('jeton valide repond 200', res.status === 200, `(status=${res.status})`);
  check('Content-Type application/zip', res.headers.get('Content-Type') === 'application/zip', `(recu ${res.headers.get('Content-Type')})`);
  const cd = res.headers.get('Content-Disposition');
  check('Content-Disposition presente avec nom du paquet v1.2.0',
    cd === `attachment; filename="${EXPECTED_OBJECT_KEY}"`, `(recu ${cd})`);
  const received = Buffer.from(await res.arrayBuffer());
  check('corps du ZIP identique aux octets de reference',
    received.length === zipBytes.length && received.equals(zipBytes),
    `(recus ${received.length} octets, attendus ${zipBytes.length})`);
  // deuxieme telechargement avec le meme jeton : le compteur a ete incremente
  const res2 = await workerMod.default.fetch(
    new Request('https://api.bot-wow.com/api/download?t=tok-ok-p022', { headers: { 'cf-connecting-ip': '198.51.100.77' } }),
    env, {}
  );
  check('compteur de telechargement incremente (toujours 200 tant que sous la limite)', res2.status === 200, `(status=${res2.status})`);
  check('compteur en base passe a 2', row.count === 2, `(count=${row.count})`);
}

/* 5. objet R2 absent : 404 file_not_found (ecart documente vs PR #19 -> 503) */
{
  const env = makeEnv({ rowByToken: new Map([['tok-nort-p022', {
    token: 'tok-nort-p022', license_id: 'lic_1', count: 0, max_count: 5,
    expires_at: Date.now() + 86400000, lic_status: 'active', license_key: 'BOTW-KEY-TEST',
  }]]) });
  // R2_BINARIES renvoyant rien pour la cle de release
  const envNoR2 = {
    ...env,
    R2_BINARIES: { get: async () => null },
    R2_OBJECT_KEY: EXPECTED_OBJECT_KEY,
  };
  const res = await workerMod.default.fetch(
    new Request('https://api.bot-wow.com/api/download?t=tok-nort-p022', { headers: { 'cf-connecting-ip': '198.51.100.77' } }),
    envNoR2, {}
  );
  check('objet R2 absent repond 404 file_not_found', res.status === 404, `(status=${res.status})`);
  const body = await res.json();
  check('code d\'erreur file_not_found', body.error === 'file_not_found', `(recu ${body.error})`);
  check('ecart documente : PR #19 prevoit 503 artifact_unavailable, non encore sur main', true,
    '(voir rapports P0.4/P0.5 et https://github.com/aveca/bot-wow/pull/19)');
}

/* 6. etats de licence */
async function licenseCase(name, over, expectedStatus, expectedError) {
  const { env } = envWithRow('tok-lic-p022', over);
  const res = await workerMod.default.fetch(
    new Request('https://api.bot-wow.com/api/download?t=tok-lic-p022', { headers: { 'cf-connecting-ip': '198.51.100.77' } }),
    env, {}
  );
  const body = await res.json();
  check(`${name} repond ${expectedStatus}`, res.status === expectedStatus, `(statut ${res.status})`);
  check(`${name} code ${expectedError}`, body.error === expectedError, `(recu ${body.error})`);
}
{
  await licenseCase('licence revokee', { lic_status: 'revoked' }, 403, 'revoked');
  await licenseCase('licence expiree', { expires_at: Date.now() - 10000 }, 410, 'expired');
  await licenseCase('limite de telechargement atteinte', { count: 5, max_count: 5 }, 429, 'limit_reached');
}

console.log('');
console.log(failures === 0 ? 'LIVRAISON DOWNLOAD : OK' : `LIVRAISON DOWNLOAD : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
