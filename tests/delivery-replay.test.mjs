#!/usr/bin/env node
/**
 * delivery-replay.test.mjs — le client paie, le client est livre.
 *
 * Defaut couvert par ce fichier : le verrou d'idempotence du webhook est pose
 * AVANT la livraison. Si la livraison echoue apres ce verrou (panne D1,
 * e-mail, reseau), le rejeu du webhook etait ignore : le client avait paye et
 * ne recevait JAMAIS sa licence. Le test `d1-order-id-regression.test.mjs`
 * documentait ce defaut ("rejeu = echec definitif").
 *
 * Ce que ce fichier verifie, sur le VRAI Worker :
 *
 *  1. un webhook `paid` dont la livraison echoue est REPRIS au rejeu :
 *     une seule licence, un seul jeton, un e-mail, un recu de livraison ;
 *  2. un rejeu apres livraison reussie ne cree NI licence NI jeton
 *     supplementaires, et ne renvoie pas un second e-mail ;
 *  3. un e-mail qui a echoue est rejoue au rejeu, et le recu passe de
 *     `pending` a `sent` (rien ne reste « a rejouer ») ;
 *  4. un paiement echoue ne livre rien ;
 *  5. un remboursement revoque la licence ;
 *  6. l'activation d'une licence est mesuree (`license_activated`), dernier
 *     maillon du funnel qui n'etait pas instrumente.
 *
 * Aucun appel reseau reel : Mollie et Resend sont simules, le D1 est simule
 * avec un etat en memoire. Aucun paiement, aucun e-mail envoye.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

/* ---------------------------------------------------------- D1 simule */
/**
 * Mini-base en memoire qui repond aux MEMES requetes que le Worker emet.
 * Elle est volontairement explicite : chaque requete du Worker a une
 * correspondance ici, ce qui rend les verifications lisibles.
 */
function makeDb(state) {
  const like = (pattern) => {
    // "body LIKE '%<cle>%'" -> la cle cherchee.
    const m = /%([^%]+)%/.exec(String(pattern || ''));
    return m ? m[1] : null;
  };
  return {
    prepare(sql) {
      const key = sql.replace(/\s+/g, ' ').trim();
      const exec = {
        bind: (...args) => ({
          run: async () => {
            state.calls.push({ sql: key, args });
            if (/^INSERT INTO webhook_events/i.test(key)) {
              if (state.events.has(args[0])) {
                throw new Error('UNIQUE constraint failed: webhook_events.id');
              }
              state.events.add(args[0]);
              return { meta: { changes: 1, last_row_id: state.events.size } };
            }
            if (/^INSERT OR IGNORE INTO webhook_events/i.test(key)) {
              state.events.add(args[0]);
              return { meta: { changes: 1 } };
            }
            if (/^INSERT INTO orders/i.test(key)) {
              if (state.failOrderInsert) throw new Error('D1: ecriture de commande impossible');
              state.orders.push({
                id: args[0], provider: 'mollie', provider_id: args[1], email: args[2],
                amount: args[3], currency: args[4], status: /'failed'/.test(key) ? 'failed' : 'paid', metadata: args[6],
                created_at: args[7], updated_at: args[8],
              });
              return { meta: { changes: 1, last_row_id: state.orders.length } };
            }
            if (/^INSERT INTO licenses/i.test(key)) {
              if (state.failLicenseInsert) throw new Error('D1: ecriture de licence impossible');
              state.licenses.push({ id: state.nextLicenseId++, key: args[0], order_id: args[1], email: args[2], status: 'active' });
              return { meta: { changes: 1, last_row_id: state.nextLicenseId - 1 } };
            }
            if (/^INSERT INTO downloads/i.test(key)) {
              state.downloads.push({ token: args[0], license_id: args[1], count: 0, max_count: args[4] });
              return { meta: { changes: 1 } };
            }
            if (/^INSERT INTO deliveries/i.test(key)) {
              state.deliveries.push({
                id: state.nextDeliveryId++, email: args[0], subject: args[1], body: args[2],
                kind: 'delivery', status: /'sent'/.test(key) ? 'sent' : 'pending',
                error: args[3], created_at: args[args.length - 1], sent_at: /'sent'/.test(key) ? args[args.length - 1] : null,
              });
              return { meta: { changes: 1 } };
            }
            if (/^UPDATE deliveries SET status = 'sent'/i.test(key)) {
              const row = state.deliveries.find((d) => d.id === args[1]);
              if (row) { row.status = 'sent'; row.sent_at = args[0]; row.error = null; }
              return { meta: { changes: row ? 1 : 0 } };
            }
            if (/^UPDATE licenses SET status/i.test(key)) {
              const row = state.licenses.find((l) => l.id === args[1]);
              if (row) row.status = args[0];
              return { meta: { changes: row ? 1 : 0 } };
            }
            if (/^UPDATE orders SET status/i.test(key)) {
              const row = state.orders.find((o) => o.provider_id === args[2]);
              if (row) row.status = args[0];
              return { meta: { changes: row ? 1 : 0 } };
            }
            if (/^INSERT INTO activations/i.test(key)) {
              state.activations.push({ license_id: args[0], machine_id: args[1] });
              return { meta: { changes: 1 } };
            }
            if (/^UPDATE activations SET last_seen_at/i.test(key)) {
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 1, last_row_id: 0 } };
          },
          first: async () => {
            state.calls.push({ sql: key, args });
            if (/FROM webhook_events/i.test(key)) {
              return state.events.has(args[0]) ? { id: args[0] } : null;
            }
            if (/FROM orders/i.test(key)) {
              return state.orders.find((o) => o.id === args[0] || o.provider_id === args[1]) || null;
            }
            if (/JOIN orders o ON o.id = l.order_id/i.test(key)) {
              // Requete utilisee par revokeLicense ET par la reprise :
              // la licence liee a la commande du paiement.
              const order = state.orders.find((o) => o.provider_id === args[0]);
              if (!order) return null;
              const lic = state.licenses.find((l) => l.order_id === order.id);
              return lic ? { id: lic.id, key: lic.key, status: lic.status } : null;
            }
            if (/FROM licenses WHERE key/i.test(key)) {
              return state.licenses.find((l) => l.key === args[0]) || null;
            }
            if (/FROM downloads WHERE license_id/i.test(key)) {
              return state.downloads.find((d) => d.license_id === args[0]) || null;
            }
            if (/FROM deliveries/i.test(key)) {
              const needle = like(args[0]);
              const wanted = /status = 'sent'/.test(key) ? 'sent' : 'pending';
              const rows = state.deliveries.filter((d) => d.status === wanted && (!needle || String(d.body || '').includes(needle)));
              return rows.length ? rows[rows.length - 1] : null;
            }
            if (/FROM activations/i.test(key)) {
              return null;
            }
            return null;
          },
          all: async () => [],
        }),
      };
      return exec;
    },
    batch: async (stmts) => {
      for (const s of stmts) await s.run();
      return [];
    },
  };
}

function makeEnv(state, opts = {}) {
  const kv = { get: async () => null, put: async () => {}, delete: async () => {} };
  const telemetry = {
    prepare: () => ({
      bind: (...args) => ({
        run: async () => {
          state.telemetry.push({ sql: 'event', args });
          return { success: true };
        },
      }),
    }),
  };
  return {
    DB: makeDb(state),
    TELEMETRY_DB: telemetry,
    RATE_LIMIT: kv,
    R2_BINARIES: { get: async () => null },
    MOLLIE_API_KEY: 'test_key',
    MOLLIE_WEBHOOK_SECRET: 'test_secret',
    LICENSE_SECRET: 'test_license_secret',
    ADMIN_JWT_SECRET: 'test_admin_secret',
    RELEASE_STATUS: opts.releaseStatus ?? 'confirmed',
    RESEND_API_KEY: opts.resendKey === undefined ? 'test_resend_key' : opts.resendKey,
    state,
  };
}

function newState() {
  return {
    calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [],
    activations: [], telemetry: [], emails: [], customers: [],
    nextLicenseId: 1, nextDeliveryId: 1,
    failOrderInsert: false, failLicenseInsert: false,
  };
}

/* --------------------------------------------------------------- Worker */
const tmpWorker = join(HERE, '.worker-replay-under-test.mjs');
writeFileSync(tmpWorker, readFileSync(join(REPO, 'worker', 'index.js'), 'utf8'));
const workerMod = await import('file:///' + tmpWorker.replace(/\\/g, '/') + '?t=' + Date.now());

/* ------------------------------------------------------- fetch simule */
const realFetch = globalThis.fetch;
let paymentState = null;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith('https://api.mollie.com/')) {
    if (u.endsWith('/customers') && (opts.method || 'GET') === 'POST') {
      return new Response(JSON.stringify({ id: 'cst_test' }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.endsWith('/payments') && (opts.method || 'GET') === 'POST') {
      return new Response(JSON.stringify({ id: 'tr_created', _links: { checkout: { href: 'https://mollie.test/checkout' } } }),
        { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify(paymentState), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (u.startsWith('https://api.resend.com/')) {
    const body = JSON.parse(opts.body || '{}');
    const st = globalThis.__resendState;
    if (!st || !st.ok) {
      return new Response(JSON.stringify({ message: 'simulated failure' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    st.sent.push(body);
    return new Response(JSON.stringify({ id: 'email_simule' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, opts);
};

async function callWorker(path, { method = 'GET', body = null, env } = {}) {
  const req = new Request('https://api.bot-wow.com' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return workerMod.default.fetch(req, env, {});
}

function paidPayment(id = 'tr_REPLAY1', email = 'client@example.com') {
  return {
    id,
    status: 'paid',
    amount: { value: '20.00', currency: 'EUR' },
    metadata: { email, lang: 'fr', product: 'bot-wow-lifetime' },
  };
}

/* ===================================================================== */
console.log('=== LIVRAISON : reprise apres echec, idempotence, preuve de livraison ===');

/* --- 1. La livraison echoue apres le verrou : le rejeu doit la compléter --- */
{
  const state = newState();
  const env = makeEnv(state);
  globalThis.__resendState = { ok: true, sent: state.emails };
  paymentState = paidPayment('tr_REPLAY1');
  state.failLicenseInsert = true; // panne D1 au moment de creer la licence

  let firstError = null;
  try {
    await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_REPLAY1' }, env });
  } catch (e) { firstError = e; }

  check('livraison interrompue : le webhook signale l\'echec (Mollie reprogramme)',
    !!firstError, '(aucune erreur levee)');
  check('livraison interrompue : aucune licence creee',
    state.licenses.length === 0, `(${state.licenses.length})`);
  check('livraison interrompue : le verrou d\'idempotence est pose',
    state.events.has('payment:tr_REPLAY1'), '(verrou absent)');

  // La panne est absorbee : le rejeu du webhook doit reprendre la livraison.
  state.failLicenseInsert = false;
  const replay = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_REPLAY1' }, env });

  check('reprise : le rejeu repond 200', replay.status === 200, `(status=${replay.status})`);
  check('reprise : le client paye recoit UNE licence',
    state.licenses.length === 1, `(${state.licenses.length})`);
  check('reprise : la licence est liee a la commande du paiement',
    state.licenses.length === 1 && state.licenses[0].order_id === state.orders[0]?.id,
    `(${state.licenses[0]?.order_id} / ${state.orders[0]?.id})`);
  check('reprise : un jeton de telechargement est cree',
    state.downloads.length === 1, `(${state.downloads.length})`);
  check('reprise : l\'e-mail de livraison est parti',
    state.emails.length === 1, `(${state.emails.length})`);
  check('reprise : le recu de livraison est consigne (status sent)',
    state.deliveries.filter((d) => d.status === 'sent').length === 1,
    `(${state.deliveries.map((d) => d.status).join(',')})`);
}

/* --- 2. Rejeu apres livraison reussie : aucun doublon, aucun second e-mail --- */
{
  const state = newState();
  const env = makeEnv(state);
  globalThis.__resendState = { ok: true, sent: state.emails };
  paymentState = paidPayment('tr_REPLAY2');

  const first = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_REPLAY2' }, env });
  const replay = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_REPLAY2' }, env });

  check('rejeu : les deux appels repondent 200', first.status === 200 && replay.status === 200,
    `(${first.status}/${replay.status})`);
  check('rejeu : toujours UNE seule licence',
    state.licenses.length === 1, `(${state.licenses.length})`);
  check('rejeu : toujours UN seul jeton de telechargement',
    state.downloads.length === 1, `(${state.downloads.length})`);
  check('rejeu : UN seul e-mail envoye au client',
    state.emails.length === 1, `(${state.emails.length})`);
  check('rejeu : une seule commande',
    state.orders.length === 1, `(${state.orders.length})`);
}

/* --- 3. L'e-mail echoue : le rejeu le renvoie et clot le rejeu --- */
{
  const state = newState();
  const env = makeEnv(state, { resendKey: undefined }); // pas de cle d'envoi
  globalThis.__resendState = { ok: false, sent: state.emails };
  paymentState = paidPayment('tr_REPLAY3');

  await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_REPLAY3' }, env });

  check('e-mail en echec : la licence existe quand meme',
    state.licenses.length === 1, `(${state.licenses.length})`);
  check('e-mail en echec : la livraison est consignee pour rejeu',
    state.deliveries.filter((d) => d.status === 'pending').length === 1,
    `(${state.deliveries.map((d) => d.status).join(',')})`);

  // Le provider d'envoi redevient disponible ; le rejeu du webhook rejoue
  // l'e-mail et clot la ligne « a rejouer ».
  env.RESEND_API_KEY = 'test_resend_key';
  globalThis.__resendState = { ok: true, sent: state.emails };
  const replay = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_REPLAY3' }, env });

  check('e-mail en echec puis rejeu : le client recoit l\'e-mail',
    state.emails.length === 1, `(${state.emails.length})`);
  check('e-mail en echec puis rejeu : aucune licence en double',
    state.licenses.length === 1, `(${state.licenses.length})`);
  check('e-mail en echec puis rejeu : le recu passe a sent',
    state.deliveries.filter((d) => d.status === 'sent').length === 1 &&
    state.deliveries.filter((d) => d.status === 'pending').length === 0,
    `(${state.deliveries.map((d) => d.status).join(',')})`);
  check('e-mail en echec puis rejeu : le webhook repond 200',
    replay.status === 200, `(status=${replay.status})`);
}

/* --- 4. Un paiement echoue ne livre rien --- */
{
  const state = newState();
  const env = makeEnv(state);
  globalThis.__resendState = { ok: true, sent: state.emails };
  paymentState = { ...paidPayment('tr_FAILED1'), status: 'failed' };

  const res = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_FAILED1' }, env });

  check('paiement echoue : le webhook repond 200', res.status === 200, `(status=${res.status})`);
  check('paiement echoue : aucune licence',
    state.licenses.length === 0, `(${state.licenses.length})`);
  check('paiement echoue : aucun e-mail',
    state.emails.length === 0, `(${state.emails.length})`);
  check('paiement echoue : la commande est consignee comme echouee',
    state.orders.some((o) => o.status === 'failed'), `(${state.orders.map((o) => o.status).join(',')})`);
}

/* --- 5. Un remboursement revoque la licence --- */
{
  const state = newState();
  const env = makeEnv(state);
  globalThis.__resendState = { ok: true, sent: state.emails };
  paymentState = paidPayment('tr_REFUND1');
  await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_REFUND1' }, env });

  paymentState = { ...paidPayment('tr_REFUND1'), status: 'refunded' };
  const res = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_REFUND1' }, env });

  check('remboursement : le webhook repond 200', res.status === 200, `(status=${res.status})`);
  check('remboursement : la licence est revoquee',
    state.licenses.length === 1 && state.licenses[0].status === 'revoked',
    `(${state.licenses.map((l) => l.status).join(',')})`);
  check('remboursement : la commande passe a remboursee',
    state.orders.some((o) => o.status === 'refunded'), `(${state.orders.map((o) => o.status).join(',')})`);
}

/* --- 6. L'activation d'une licence est mesuree --- */
{
  const state = newState();
  const env = makeEnv(state);
  globalThis.__resendState = { ok: true, sent: state.emails };
  paymentState = paidPayment('tr_ACTIVATE1');
  await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_ACTIVATE1' }, env });

  const key = state.licenses[0]?.key;
  const res = await callWorker('/api/activate', {
    method: 'POST', body: { key, machine_id: 'machine-de-test' }, env,
  });
  const body = await res.json();

  check('activation : la licence active', res.status === 200 && body.ok === true,
    `(status=${res.status} ${JSON.stringify(body).slice(0, 80)})`);
  check('activation : l\'evenement license_activated est emis',
    state.telemetry.some((t) => String(t.args).includes('license_activated')),
    `(${state.telemetry.length} evenements)`);
  check('activation : aucun e-mail ni licence supplementaires',
    state.licenses.length === 1 && state.emails.length === 1,
    `(${state.licenses.length}/${state.emails.length})`);
}

/* --- 7. La garde de livraison refuse le checkout SANS appel Mollie --- */
{
  const state = newState();
  const env = makeEnv(state, { releaseStatus: 'pending' });
  globalThis.__resendState = { ok: true, sent: state.emails };
  let mollieCalls = 0;
  const countingFetch = async (url, opts = {}) => {
    if (String(url).startsWith('https://api.mollie.com/')) mollieCalls += 1;
    return globalThis.fetch(url, opts);
  };
  const realFetchRef = globalThis.fetch;
  globalThis.fetch = countingFetch;
  const res = await callWorker('/api/checkout', {
    method: 'POST', body: { email: 'client@example.com', lang: 'fr' }, env,
  });
  globalThis.fetch = realFetchRef;
  const body = await res.json();

  check('garde de livraison : le checkout repond 409',
    res.status === 409, `(status=${res.status})`);
  check('garde de livraison : l\'erreur est explicite',
    body.error === 'delivery_unverified', `(${JSON.stringify(body).slice(0, 80)})`);
  check('garde de livraison : AUCUN appel Mollie (aucun encaissement possible)',
    mollieCalls === 0, `(${mollieCalls} appels)`);
  check('garde de livraison : aucune commande creee',
    state.orders.length === 0, `(${state.orders.length})`);
}

/* --------------------------------------------------------------- fin */
globalThis.fetch = realFetch;
try { rmSync(tmpWorker, { force: true }); } catch { /* deja supprime */ }

console.log('');
console.log(failures === 0 ? 'LIVRAISON REPRISE : OK' : `LIVRAISON REPRISE : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
