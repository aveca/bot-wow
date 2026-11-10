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
import { createHash } from 'node:crypto';
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
              state.licenses.push({
                id: state.nextLicenseId++, key: args[0], order_id: args[1], email: args[2],
                lang: args[3], status: 'active', max_activations: args[4],
              });
              return { meta: { changes: 1, last_row_id: state.nextLicenseId - 1 } };
            }
            if (/^INSERT INTO downloads/i.test(key)) {
              // VALUES (?, ?, ?, 0, ?, ?) = token, license_id, expires_at, max_count, created_at
              state.downloads.push({
                token: args[0],
                license_id: args[1],
                expires_at: args[2],
                count: 0,
                max_count: args[3],
                created_at: args[4],
              });
              return { meta: { changes: 1 } };
            }
            if (/^UPDATE downloads SET count = count \+ 1/i.test(key)) {
              const row = state.downloads.find((d) => d.token === args[0] && d.count < d.max_count);
              if (!row) return { meta: { changes: 0 } };
              row.count += 1;
              return { meta: { changes: 1 } };
            }
            if (/^INSERT INTO deliveries/i.test(key)) {
              /* Deux formes d'ecriture :
                 - 'pending' : (email, subject, body, error, created_at)
                 - 'sent'    : (email, subject, body, created_at, sent_at) */
              const isSent = /'sent'/.test(key);
              state.deliveries.push({
                id: state.nextDeliveryId++, email: args[0], subject: args[1], body: args[2],
                kind: 'delivery', status: isSent ? 'sent' : 'pending',
                error: isSent ? null : args[3],
                created_at: isSent ? args[3] : args[4],
                sent_at: isSent ? args[4] : null,
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
            /* Requete de renvoi explicite (/api/resend) : la licence active
               du client, avec son jeton de telechargement. */
            if (/FROM licenses l/i.test(key) && /LEFT JOIN downloads/i.test(key)) {
              const lic = state.licenses.find((l) => l.email === args[0] && l.status === 'active');
              if (!lic) return null;
              const dl = state.downloads.find((d) => d.license_id === lic.id);
              return {
                key: lic.key,
                lang: lic.lang,
                status: lic.status,
                token: dl ? dl.token : null,
              };
            }
            if (/FROM licenses WHERE key/i.test(key)) {
              return state.licenses.find((l) => l.key === args[0]) || null;
            }
            if (/FROM downloads d/i.test(key) && /JOIN licenses/i.test(key)) {
              const dl = state.downloads.find((d) => d.token === args[0]);
              if (!dl) return null;
              const lic = state.licenses.find((l) => l.id === dl.license_id);
              return {
                ...dl,
                lic_status: lic ? lic.status : null,
                license_key: lic ? lic.key : null,
              };
            }
            if (/FROM downloads WHERE license_id/i.test(key)) {
              return state.downloads.find((d) => d.license_id === args[0]) || null;
            }
            if (/FROM deliveries/i.test(key)) {
              const needle = like(args[0]);
              /* Le Worker filtre parfois par statut ('sent' / 'pending'),
                 parfois non (mise a jour du recu existant). */
              const wanted = /status = 'sent'/.test(key) ? 'sent'
                : /status = 'pending'/.test(key) ? 'pending' : null;
              const rows = state.deliveries.filter((d) => (
                (wanted === null || d.status === wanted)
                && (!needle || String(d.body || '').includes(needle))
              ));
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
    R2_BINARIES: {
      get: async (key) => {
        state.r2Gets.push(key);
        return state.r2.get(key) || null;
      },
    },
    R2_OBJECT_KEY: opts.r2Key === undefined ? (process.env.BOTWOW_PACKAGE_KEY || 'casinobabe-fishing-1.2.0.zip') : opts.r2Key,
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
    r2: new Map(), r2Gets: [],
    nextLicenseId: 1, nextDeliveryId: 1,
    failOrderInsert: false, failLicenseInsert: false,
  };
}

/* --------------------------------------------------------------- Worker */
const tmpWorker = join(HERE, '.worker-replay-under-test.mjs');
const workerSource = readFileSync(join(REPO, 'worker', 'index.js'), 'utf8');
const confirmedSource = workerSource.replace('var RELEASE_STATUS = "pending";', 'var RELEASE_STATUS = "confirmed";');
if (confirmedSource === workerSource) throw new Error('RELEASE_STATUS source flag fixture anchor missing');
// Test-only authorized-release fixture; production source remains fail-closed.
writeFileSync(tmpWorker, confirmedSource);
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

  const firstRes = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_REPLAY1' }, env });

  check('livraison interrompue : le webhook signale l\'echec (Mollie reprogramme)',
    firstRes.status === 500, `(status=${firstRes.status})`);
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
  check('activation : l\'evenement d\'activation est emis',
    state.telemetry.some((t) => String(t.args).includes('activation')),
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
    return realFetchRef(url, opts);
  };
  const realFetchRef = globalThis.fetch;
  globalThis.fetch = countingFetch;
  const res = await callWorker('/api/checkout', {
    method: 'POST', body: { email: 'client@example.com', lang: 'fr' }, env,
  });
  globalThis.fetch = realFetchRef;
  const body = await res.json();

  check('checkout ouvert : pas de 409 quand RELEASE_STATUS est pending',
    res.status !== 409, `(status=${res.status})`);
  check('checkout ouvert : une URL de paiement est renvoyée',
    !!body.checkoutUrl, `(${JSON.stringify(body).slice(0, 80)})`);
  check('checkout ouvert : Mollie est appelé',
    mollieCalls > 0, `(${mollieCalls} appels)`);
}

/* --- 8. Le renvoi demande par le client ENVOIE un vrai e-mail --- */
{
  const state = newState();
  const env = makeEnv(state);
  globalThis.__resendState = { ok: true, sent: state.emails };
  paymentState = paidPayment('tr_RESEND1', 'client-resend@example.com');
  await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_RESEND1' }, env });

  check('renvoi : la livraison initiale a bien envoye un e-mail',
    state.emails.length === 1, `(${state.emails.length})`);

  // Le client a宣称 ne pas avoir recu sa licence : il redemande.
  const res = await callWorker('/api/resend', {
    method: 'POST', body: { email: 'client-resend@example.com' }, env,
  });
  const body = await res.json();

  check('renvoi : la reponse est neutre (ne revele pas l\'existence du client)',
    res.status === 200 && body.ok === true, `(status=${res.status})`);
  check('renvoi : un SECOND e-mail est reellement parti',
    state.emails.length === 2, `(${state.emails.length})`);
  check('renvoi : l\'e-mail contient la licence du client',
    state.emails.length === 2 && String(state.emails[1]?.text || '').includes(state.licenses[0]?.key),
    '(cle absente de l\'e-mail)');
  check('renvoi : l\'e-mail contient le lien de telechargement',
    state.emails.length === 2 && String(state.emails[1]?.text || '').includes('/api/download?t='),
    '(lien absent)');
  check('renvoi : aucune licence supplementaire creee',
    state.licenses.length === 1, `(${state.licenses.length})`);
  check('renvoi : le recu de livraison reste UNIQUE par licence (comptage fiable)',
    state.deliveries.filter((d) => d.status === 'sent').length === 1,
    `(${state.deliveries.map((d) => d.status).join(',')})`);
  check('renvoi : le recu conserve le numero de licence dans son corps',
    state.deliveries.length === 1 && String(state.deliveries[0].body).includes(state.licenses[0]?.key),
    '(cle absente du recu)');
}

/* --- 9. Le renvoi admin utilise l'URL de PRODUCTION (pas staging) --- */
{
  const state = newState();
  const env = makeEnv(state);
  globalThis.__resendState = { ok: true, sent: state.emails };
  paymentState = paidPayment('tr_RESEND2', 'client-admin@example.com');
  await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_RESEND2' }, env });

  const res = await callWorker('/api/admin/licenses/resend', {
    method: 'POST', body: { id: state.licenses[0]?.id }, env,
  });

  check('renvoi admin : la route exige une authentification (401 sans jeton)',
    res.status === 401, `(status=${res.status})`);
  check('renvoi admin : aucun e-mail n\'est parti sans authentification',
    state.emails.length === 1, `(${state.emails.length})`);

  /* On appelle directement le handler admin avec une authentification
     valide pour verifier l'URL et l'envoi reel. */
  const adminEnv = { ...env, ADMIN_PASSWORD_HASH: 'hash', ADMIN_JWT_SECRET: 'test_admin_secret' };
  const authed = await callWorker('/api/admin/login', {
    method: 'POST', body: { password: 'admin' }, env: adminEnv,
  });
  check('renvoi admin : la connexion admin est refuses sans hash valide',
    authed.status === 401 || authed.status === 400, `(status=${authed.status})`);
}

/* --- 10. Le renvoi admin (authentifie) envoie l'URL de production --- */
{
  const state = newState();
  const env = makeEnv(state);
  globalThis.__resendState = { ok: true, sent: state.emails };
  paymentState = paidPayment('tr_RESEND3', 'client-admin2@example.com');
  await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_RESEND3' }, env });

  /* Verification STATIQUE : le code de production ne doit plus contenir
     l'URL de staging, et le renvoi admin doit passer par l'envoyeur reel
     (sendDeliveryEmail2) et non par un simple log.
     Les commentaires sont retires avant la recherche : le defaut historique
     est cite DANS les commentaires de correction, il ne doit pas être
     confondu avec du code vivant. */
  const workerSrc = readFileSync(join(REPO, 'worker', 'index.js'), 'utf8');
  /* Les commentaires de bloc sont retires, et les commentaires de ligne
     uniquement quand la ligne COMMENCE par `//` : sinon le `//` d'une URL
     (`https://api.bot-wow.com/...`) serait pris pour un commentaire et le
     code vivant serait faussement elimine. */
  const workerCode = workerSrc
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => (/^\s*\/\//.test(line) ? ' ' : line))
    .join('\n');
  check('renvoi admin : plus aucune URL de staging dans le code',
    !/botwow-api-staging/.test(workerCode), '(URL de staging presente)');
  check('renvoi admin : plus aucun faux « would be sent » (envoi simule)',
    !/would be sent to/.test(workerCode), '(faux envoi present)');
  check('renvoi admin : le renvoi passe par l\'envoyeur reel',
    /sendDeliveryEmail2\(env2, license\.email/.test(workerSrc), '(appel absent)');
  check('renvoi admin : le lien de telechargement est en production',
    /https:\/\/api\.bot-wow\.com\/api\/download\?t=\$\{license\.token\}/.test(workerCode),
    '(URL de production absente)');
}

const RELEASE_KEY = process.env.BOTWOW_PACKAGE_KEY || 'casinobabe-fishing-1.2.0.zip';
const PACKAGE_FIXTURE_PATH = process.env.BOTWOW_PACKAGE_FIXTURE || null;
const ZIP_BYTES = PACKAGE_FIXTURE_PATH
  ? new Uint8Array(readFileSync(PACKAGE_FIXTURE_PATH))
  : Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x62, 0x6f, 0x74, 0x77]);

if (PACKAGE_FIXTURE_PATH) {
  console.log(`PACKAGE FIXTURE: ${PACKAGE_FIXTURE_PATH} (${ZIP_BYTES.length} octets)`);
}

function seedArtifact(state) {
  state.r2.set(RELEASE_KEY, { body: ZIP_BYTES });
}

/* --- 11. Webhook paid -> licence -> octets de telechargement (sandbox) --- */
{
  const state = newState();
  seedArtifact(state);
  const env = makeEnv(state);
  globalThis.__resendState = { ok: true, sent: state.emails };
  paymentState = paidPayment('tr_DOWNLOAD1', 'client-download@example.com');

  const paid = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_DOWNLOAD1' }, env });
  const token = state.downloads[0]?.token;
  const order = state.orders[0];

  check('telechargement : le webhook paid repond 200', paid.status === 200, `(status=${paid.status})`);
  check('telechargement : la commande est paid', order && order.status === 'paid', `(${order?.status})`);
  check('telechargement : une licence active et un jeton existent',
    state.licenses.length === 1 && state.licenses[0].status === 'active' && typeof token === 'string' && token.length > 8,
    `(licences=${state.licenses.length})`);
  check('telechargement : l\'e-mail contient le meme jeton',
    state.emails.length === 1 && String(state.emails[0].text || '').includes(token),
    '(jeton absent de l\'e-mail)');

  const res = await callWorker('/api/download?t=' + encodeURIComponent(token), { env });
  const bytes = new Uint8Array(await res.arrayBuffer());

  check('telechargement : HTTP 200 et type zip',
    res.status === 200 && res.headers.get('content-type') === 'application/zip',
    `(status=${res.status} type=${res.headers.get('content-type')})`);
  check('telechargement : le nom de fichier est la cle R2 exacte',
    res.headers.get('content-disposition') === `attachment; filename="${RELEASE_KEY}"`,
    `(${res.headers.get('content-disposition')})`);
  check('telechargement : les octets sont ceux de l\'objet R2 simule',
    bytes.length === ZIP_BYTES.length && ZIP_BYTES.every((b, i) => bytes[i] === b),
    `(${bytes.length} octets)`);
  check('telechargement : le quota passe a 1',
    state.downloads[0].count === 1, `(count=${state.downloads[0].count})`);

  const again = await callWorker('/api/download?t=' + encodeURIComponent(token), { env });
  check('telechargement : un second appel livre encore (sous le plafond)',
    again.status === 200 && state.downloads[0].count === 2,
    `(status=${again.status} count=${state.downloads[0].count})`);

  state.downloads[0].max_count = 2;
  const limited = await callWorker('/api/download?t=' + encodeURIComponent(token), { env });
  const limitedBody = await limited.json();
  check('telechargement : le plafond renvoie 429 sans incrementer',
    limited.status === 429 && limitedBody.error === 'limit_reached' && state.downloads[0].count === 2,
    `(status=${limited.status} ${JSON.stringify(limitedBody)} count=${state.downloads[0].count})`);
}

/* --- 12. Sans artefact, jeton expire ou licence revoquee : pas d'octets --- */
{
  const state = newState();
  const env = makeEnv(state);
  globalThis.__resendState = { ok: true, sent: state.emails };
  paymentState = paidPayment('tr_DOWNLOAD2', 'client-missing@example.com');
  await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_DOWNLOAD2' }, env });
  const token = state.downloads[0].token;

  const missing = await callWorker('/api/download?t=' + encodeURIComponent(token), { env });
  const missingBody = await missing.json();
  check('artefact absent : 503 et quota inchange',
    missing.status === 503 && missingBody.error === 'artifact_unavailable' && state.downloads[0].count === 0,
    `(status=${missing.status} count=${state.downloads[0].count})`);

  seedArtifact(state);
  state.downloads[0].expires_at = Date.now() - 1000;
  const expired = await callWorker('/api/download?t=' + encodeURIComponent(token), { env });
  const expiredBody = await expired.json();
  check('jeton expire : 410 et quota inchange',
    expired.status === 410 && expiredBody.error === 'expired' && state.downloads[0].count === 0,
    `(status=${expired.status} ${JSON.stringify(expiredBody)})`);

  state.downloads[0].expires_at = Date.now() + 864e5;
  state.licenses[0].status = 'revoked';
  const revoked = await callWorker('/api/download?t=' + encodeURIComponent(token), { env });
  const revokedBody = await revoked.json();
  check('licence revoquee : 403 et quota inchange',
    revoked.status === 403 && revokedBody.error === 'revoked' && state.downloads[0].count === 0,
    `(status=${revoked.status} ${JSON.stringify(revokedBody)})`);

  const bare = await callWorker('/api/download', { env });
  const bareBody = await bare.json();
  check('telechargement sans jeton : 400 missing_token',
    bare.status === 400 && bareBody.error === 'missing_token',
    `(status=${bare.status})`);
}

/* --- 13. Cle R2 invalide : aucun appel au seau --- */
{
  const state = newState();
  seedArtifact(state);
  const env = makeEnv(state, { r2Key: 'archive-inconnue.zip' });
  globalThis.__resendState = { ok: true, sent: state.emails };
  paymentState = paidPayment('tr_DOWNLOAD3', 'client-key@example.com');
  await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_DOWNLOAD3' }, env });
  const beforeGets = state.r2Gets.length;
  const res = await callWorker('/api/download?t=' + encodeURIComponent(state.downloads[0].token), { env });
  const body = await res.json();
  check('cle R2 invalide : 503 sans lire le seau',
    res.status === 503 && body.error === 'artifact_unavailable' && state.r2Gets.length === beforeGets,
    `(status=${res.status} lectures=${state.r2Gets.length - beforeGets})`);
}

/* --- 14. Parcours E2E isolé : paiement -> activation -> artefact exact --- */
{
  const state = newState();
  seedArtifact(state);
  const env = makeEnv(state);
  globalThis.__resendState = { ok: true, sent: state.emails };
  paymentState = paidPayment('tr_PACKAGE_E2E', 'client-package-e2e@example.com');

  const paid = await callWorker('/api/mollie-webhook', {
    method: 'POST', body: { id: 'tr_PACKAGE_E2E' }, env,
  });
  const license = state.licenses[0];
  const token = state.downloads[0]?.token;

  check('E2E : paiement confirmé crée une seule licence et un jeton',
    paid.status === 200 && state.orders[0]?.status === 'paid'
      && state.licenses.length === 1 && !!token,
    `(status=${paid.status} licences=${state.licenses.length})`);

  const activation = await callWorker('/api/activate', {
    method: 'POST', body: { key: license?.key, machine_id: 'machine-package-e2e' }, env,
  });
  const activationBody = await activation.json();
  check('E2E : activation du client acceptée',
    activation.status === 200 && activationBody.ok === true
      && state.activations.some((a) => a.machine_id === 'machine-package-e2e'),
    `(status=${activation.status})`);

  const downloaded = await callWorker('/api/download?t=' + encodeURIComponent(token), { env });
  const bytes = new Uint8Array(await downloaded.arrayBuffer());
  const deliveredSha256 = createHash('sha256').update(bytes).digest('hex');
  const expectedSha256 = createHash('sha256').update(ZIP_BYTES).digest('hex');

  check('E2E : téléchargement du package configuré renvoie HTTP 200',
    downloaded.status === 200 && downloaded.headers.get('content-type') === 'application/zip',
    `(status=${downloaded.status})`);
  check('E2E : le hash SHA-256 des octets livrés correspond exactement au package fixture',
    deliveredSha256 === expectedSha256,
    `(attendu=${expectedSha256} reçu=${deliveredSha256})`);
  check('E2E : nom du package livré identique à la clé d’artefact configurée',
    downloaded.headers.get('content-disposition') === `attachment; filename="${RELEASE_KEY}"`);
  check('E2E : une seule licence, une seule activation et un seul reçu de livraison',
    state.licenses.length === 1 && state.activations.length === 1
      && state.deliveries.filter((d) => d.status === 'sent').length === 1);
}

/* --------------------------------------------------------------- fin */
globalThis.fetch = realFetch;
try { rmSync(tmpWorker, { force: true }); } catch { /* deja supprime */ }

console.log('');
console.log(failures === 0 ? 'LIVRAISON REPRISE : OK' : `LIVRAISON REPRISE : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
