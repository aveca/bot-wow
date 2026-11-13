#!/usr/bin/env node
/**
 * Accès compagnon : webhook signé, sans clé API Stripe, sans zip.
 * Remboursement et litige révoquent. Un second événement ne livre pas deux fois.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const tmp = join(HERE, '.worker-companion.mjs');
writeFileSync(tmp, readFileSync(join(REPO, 'worker', 'index.js'), 'utf8'));
const worker = await import('file:///' + tmp.replace(/\\/g, '/') + '?t=' + Date.now());

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log('  ok   ' + name);
  else { failures += 1; console.log('  FAIL ' + name + ' ' + detail); }
};

function sign(secret, payload) {
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(t + '.' + payload).digest('hex');
  return { t, sig };
}

function envFor(state) {
  return {
    DB: {
      prepare(sql) {
        const key = sql.replace(/\s+/g, ' ').trim();
        const run = (args) => {
          if (/INSERT INTO webhook_events/i.test(key)) {
            if (state.events.has(args[0])) throw new Error('UNIQUE constraint failed');
            state.events.add(args[0]);
          }
          if (/INSERT INTO orders/i.test(key)) state.orders.push({ id: args[0], provider_id: args[1], metadata: args[5] });
          if (/INSERT INTO licenses/i.test(key)) state.licenses.push({ key: args[0], order_id: args[1], email: args[2], status: args[4] });
          if (/INSERT INTO downloads/i.test(key)) state.downloads.push(args[0]);
          if (/UPDATE licenses SET status = 'revoked'/i.test(key)) {
            for (const lic of state.licenses) if (lic.order_id === args[1]) lic.status = 'revoked';
          }
          return { meta: { last_row_id: state.licenses.length } };
        };
        return { bind(...args) {
          return {
            run: async () => run(args),
            first: async () => {
              if (/FROM orders/i.test(key) && /metadata LIKE/i.test(key)) {
                return state.orders.find((o) => String(o.metadata).includes(String(args[0]).replace(/%/g, '').slice(0, 20))) || state.orders.find((o) => String(o.metadata).includes('pi_')) || null;
              }
              if (/FROM orders/i.test(key)) return state.orders.find((o) => o.id === args[0] || o.provider_id === args[1]) || null;
              if (/FROM licenses/i.test(key) && /WHERE key/i.test(key)) return state.licenses.find((l) => l.key === args[0]) || null;
              if (/FROM licenses/i.test(key)) return state.licenses[0] ? { id: 1, key: state.licenses[0].key } : null;
              if (/FROM downloads/i.test(key)) return null;
              if (/FROM deliveries/i.test(key)) return null;
              return null;
            }
          };
        } };
      }
    },
    TELEMETRY_DB: { prepare() { return { bind() { return { run: async () => ({}) }; } }; } },
    RATE_LIMIT: { get: async () => null, put: async () => {} },
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    RESEND_API_KEY: '',
    state
  };
}

async function post(env, event) {
  const payload = JSON.stringify(event);
  const { t, sig } = sign(env.STRIPE_WEBHOOK_SECRET, payload);
  return worker.default.fetch(new Request('https://api.bot-wow.com/api/stripe-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${sig}` },
    body: payload
  }), env, {});
}

function paid(id, priceKey, cents) {
  return {
    id: 'evt_' + id,
    type: 'checkout.session.completed',
    data: { object: {
      id, payment_status: 'paid', amount_total: cents, currency: 'eur', livemode: false,
      payment_intent: 'pi_' + id.replace(/[^A-Za-z0-9]/g, ''),
      customer_details: { email: 'Buyer@Example.test' },
      metadata: { price_key: priceKey, product: 'BOT-WOW', lang: 'en' }
    } }
  };
}

console.log('=== COMPANION WEBHOOK ===');
{
  const state = { events: new Set(), orders: [], licenses: [], downloads: [] };
  const env = envFor(state);
  const res = await post(env, paid('cs_planner', 'planner', 900));
  check('planner : 200 sans clé API', res.status === 200, String(res.status));
  check('planner : une licence planner', state.licenses.length === 1 && state.licenses[0].status === 'planner' && state.licenses[0].email === 'buyer@example.test');
  check('planner : pas de jeton de téléchargement', state.downloads.length === 0);
  const again = await post(env, paid('cs_planner', 'planner', 900));
  check('planner : rejeu 200 et une seule licence', again.status === 200 && state.licenses.length === 1);
}
{
  const state = { events: new Set(), orders: [], licenses: [], downloads: [] };
  const env = envFor(state);
  const res = await post(env, paid('cs_bad', 'studio', 900));
  check('montant studio incorrect : 400', res.status === 400, String(res.status));
  check('montant studio incorrect : aucune licence', state.licenses.length === 0);
}
{
  const state = { events: new Set(), orders: [], licenses: [], downloads: [] };
  const env = envFor(state);
  await post(env, paid('cs_studio', 'studio', 2900));
  const refund = await post(env, {
    id: 'evt_refund_1', type: 'charge.refunded',
    data: { object: { id: 'ch_1', payment_intent: 'pi_csstudio', refunded: true } }
  });
  check('remboursement : 200', refund.status === 200, String(refund.status));
  check('remboursement : licence révoquée', state.licenses[0] && state.licenses[0].status === 'revoked');
  const repeat = await post(env, {
    id: 'evt_refund_1', type: 'charge.refunded',
    data: { object: { id: 'ch_1', payment_intent: 'pi_csstudio', refunded: true } }
  });
  check('remboursement répété : 200 sans seconde licence', repeat.status === 200 && state.licenses.length === 1);
}
{
  const env = envFor({ events: new Set(), orders: [], licenses: [{ key: 'BOTW-TEST', status: 'planner', order_id: 'ord', email: 'a@b.c' }], downloads: [] });
  const res = await worker.default.fetch(new Request('https://api.bot-wow.com/api/access', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'botw-test' })
  }), env, {});
  const body = await res.json();
  check('accès : la clé planner est acceptée', res.status === 200 && body.tier === 'planner', JSON.stringify(body));
  const denied = await worker.default.fetch(new Request('https://api.bot-wow.com/api/access', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'NOPE' })
  }), env, {});
  check('accès : clé inconnue refusée', denied.status === 404);
}

{
  const state = { events: new Set(), orders: [], licenses: [], downloads: [] };
  const env = envFor(state);
  const event = paid('cs_link_only', 'planner', 900);
  delete event.data.object.metadata.price_key;
  event.data.object.payment_link = 'plink_1UbIoJRnrMmUAHDtGYXfbz3m';
  const res = await post(env, event);
  check('repli payment_link planner : 200', res.status === 200, String(res.status));
  check('repli payment_link planner : licence planner', state.licenses.length === 1 && state.licenses[0].status === 'planner', JSON.stringify(state.licenses));
}
{
  const state = { events: new Set(), orders: [], licenses: [], downloads: [] };
  const env = envFor(state);
  const event = paid('cs_intent_only', 'studio', 2900);
  delete event.data.object.metadata.price_key;
  event.data.object.payment_intent = { id: 'pi_csintentonly', metadata: { price_key: 'studio' } };
  const res = await post(env, event);
  check('repli payment_intent.metadata : licence studio', res.status === 200 && state.licenses[0] && state.licenses[0].status === 'studio', String(res.status));
}

console.log(failures ? `COMPANION : ${failures} ECHEC(S)` : 'COMPANION : OK');
process.exit(failures ? 1 : 0);
