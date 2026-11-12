#!/usr/bin/env node
/**
 * Le Payment Link public n'écrit pas metadata.product=bot-wow-lifetime ni
 * metadata.email. Le webhook doit quand même délivrer une licence, une seule
 * fois, si le lien, le prix ou metadata.product=BOT-WOW correspond.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const LINK = 'plink_1UaG0TRnrMmUAHDtXMyagAIa';
const PRICE = 'price_1UaG0TRnrMmUAHDtO3r6xVq4';

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

const source = readFileSync(join(REPO, 'worker', 'index.js'), 'utf8');
check('constante du Payment Link', source.includes(`var STRIPE_PAYMENT_LINK_ID = "${LINK}";`));
check('constante du prix', source.includes(`var STRIPE_PAYMENT_LINK_PRICE_ID = "${PRICE}";`));
check('lecture de session avec line items', source.includes('expand[]=line_items'));

const tmpWorker = join(HERE, '.worker-under-test.mjs');
writeFileSync(tmpWorker, source);
const workerMod = await import('file:///' + tmpWorker.replace(/\\/g, '/') + '?t=' + Date.now());

const realFetch = globalThis.fetch;
let sessionState = null;
let fetchedUrl = '';
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith('https://api.stripe.com/v1/checkout/sessions/')) {
    fetchedUrl = u;
    return new Response(JSON.stringify(sessionState), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, opts);
};

function makeEnv(state) {
  const db = {
    prepare(sql) {
      const key = sql.replace(/\s+/g, ' ').trim();
      const exec = (args) => {
        state.sql.push(key);
        if (/INSERT INTO webhook_events/i.test(key)) {
          if (state.events.has(args[0])) throw new Error('UNIQUE constraint failed: webhook_events.id');
          state.events.add(args[0]);
        }
        if (/INSERT INTO orders/i.test(key)) {
          state.orders.set(args[0], { id: args[0], provider_id: args[1], email: args[2] });
        }
        if (/INSERT INTO licenses/i.test(key)) {
          state.licenses.push({ key: args[0], order_id: args[1], email: args[2] });
          return { meta: { last_row_id: state.licenses.length } };
        }
        if (/INSERT INTO downloads/i.test(key)) {
          state.downloads.push({ token: args[0], license_id: args[1] });
        }
        return { meta: { last_row_id: 1 } };
      };
      return {
        bind(...args) {
          return {
            run: async () => exec(args),
            first: async () => {
              if (/FROM orders/i.test(key)) {
                return state.orders.get(args[0]) || [...state.orders.values()].find((order) => order.provider_id === args[1]) || null;
              }
              if (/FROM licenses/i.test(key)) {
                const found = state.licenses.find((license) => {
                  const order = [...state.orders.values()].find((item) => item.id === license.order_id);
                  return order && order.provider_id === args[0];
                });
                return found ? { id: state.licenses.indexOf(found) + 1, key: found.key } : null;
              }
              if (/FROM downloads/i.test(key)) {
                return state.downloads.find((item) => item.license_id === args[0]) || null;
              }
              return null;
            },
            all: async () => [],
          };
        },
      };
    },
    batch: async () => [],
  };
  return {
    DB: db,
    TELEMETRY_DB: {
      prepare() {
        return { bind() { return { run: async () => ({ success: true }) }; } };
      },
    },
    RATE_LIMIT: { get: async () => null, put: async () => {} },
    R2_BINARIES: { get: async () => null },
    STRIPE_SECRET_KEY: 'sk_test_unit',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    RESEND_API_KEY: '',
    ADMIN_JWT_SECRET: 'test_admin_secret',
    LICENSE_SECRET: 'test_license_secret',
    state,
  };
}

function freshState() {
  return { sql: [], events: new Set(), orders: new Map(), licenses: [], downloads: [] };
}

function paidSession(id, extra = {}) {
  return {
    id,
    payment_status: 'paid',
    amount_total: 2000,
    currency: 'eur',
    livemode: false,
    metadata: {},
    ...extra,
  };
}

async function postWebhook(env, sessionId) {
  const payload = JSON.stringify({
    id: 'evt_' + sessionId,
    type: 'checkout.session.completed',
    data: { object: { id: sessionId } },
  });
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(t + '.' + payload).digest('hex');
  return workerMod.default.fetch(new Request('https://api.bot-wow.com/api/stripe-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${sig}` },
    body: payload,
  }), env, {});
}

console.log('=== WEBHOOK PAYMENT LINK ===');

{
  const state = freshState();
  const env = makeEnv(state);
  sessionState = paidSession('cs_link', {
    payment_link: LINK,
    customer_details: { email: 'Buyer@Stripe.test' },
    metadata: { product: 'BOT-WOW', fulfillment: 'manual' },
  });
  const res = await postWebhook(env, 'cs_link');
  check('lien public : 200', res.status === 200, `(status=${res.status})`);
  check('lien public : la session est lue avec les line items', fetchedUrl.includes('expand[]=line_items'));
  check('lien public : une licence', state.licenses.length === 1, `(n=${state.licenses.length})`);
  check('lien public : e-mail customer_details', state.licenses[0] && state.licenses[0].email === 'buyer@stripe.test');
}

{
  const state = freshState();
  const env = makeEnv(state);
  sessionState = paidSession('cs_price', {
    customer_email: 'Price@Stripe.test',
    line_items: { data: [{ price: { id: PRICE } }] },
  });
  const res = await postWebhook(env, 'cs_price');
  check('prix public : 200', res.status === 200, `(status=${res.status})`);
  check('prix public : une licence', state.licenses.length === 1, `(n=${state.licenses.length})`);
  check('prix public : e-mail customer_email', state.licenses[0] && state.licenses[0].email === 'price@stripe.test');
}

{
  const state = freshState();
  const env = makeEnv(state);
  sessionState = paidSession('cs_label', {
    customer_details: { email: 'other@stripe.test' },
    customer_email: 'fallback@stripe.test',
    metadata: { product: 'BOT-WOW', email: 'Meta@Stripe.test' },
  });
  const res = await postWebhook(env, 'cs_label');
  check('metadata BOT-WOW : 200', res.status === 200, `(status=${res.status})`);
  check('metadata.email prime sur customer_details', state.licenses[0] && state.licenses[0].email === 'meta@stripe.test');
}

{
  const state = freshState();
  const env = makeEnv(state);
  sessionState = paidSession('cs_api', {
    metadata: { email: 'api@stripe.test', lang: 'fr', product: 'bot-wow-lifetime' },
  });
  const res = await postWebhook(env, 'cs_api');
  check('checkout API existant : toujours une licence', res.status === 200 && state.licenses.length === 1);
}

{
  const state = freshState();
  const env = makeEnv(state);
  sessionState = paidSession('cs_bad_amount', {
    payment_link: LINK,
    amount_total: 100,
    customer_details: { email: 'bad@stripe.test' },
  });
  const res = await postWebhook(env, 'cs_bad_amount');
  check('montant différent : 400', res.status === 400, `(status=${res.status})`);
  check('montant différent : aucune licence', state.licenses.length === 0);
}

{
  const state = freshState();
  const env = makeEnv(state);
  sessionState = paidSession('cs_bad_currency', {
    payment_link: LINK,
    currency: 'usd',
    customer_details: { email: 'bad@stripe.test' },
  });
  const res = await postWebhook(env, 'cs_bad_currency');
  check('devise différente : 400', res.status === 400, `(status=${res.status})`);
  check('devise différente : aucune licence', state.licenses.length === 0);
}

{
  const state = freshState();
  const env = makeEnv(state);
  sessionState = paidSession('cs_unpaid', {
    payment_link: LINK,
    payment_status: 'unpaid',
    customer_details: { email: 'wait@stripe.test' },
  });
  const res = await postWebhook(env, 'cs_unpaid');
  check('impayé : 200 sans licence', res.status === 200 && state.licenses.length === 0, `(status=${res.status}, n=${state.licenses.length})`);
}

{
  const state = freshState();
  const env = makeEnv(state);
  sessionState = paidSession('cs_other', {
    payment_link: 'plink_other',
    metadata: { product: 'something-else' },
    customer_details: { email: 'other@stripe.test' },
    line_items: { data: [{ price: { id: 'price_other' } }] },
  });
  const res = await postWebhook(env, 'cs_other');
  check('autre produit : 200 sans licence', res.status === 200 && state.licenses.length === 0);
}

{
  const state = freshState();
  const env = makeEnv(state);
  sessionState = paidSession('cs_no_mail', { payment_link: LINK, metadata: {} });
  const res = await postWebhook(env, 'cs_no_mail');
  check('sans e-mail : 400', res.status === 400, `(status=${res.status})`);
  check('sans e-mail : aucune licence', state.licenses.length === 0);
}

{
  const state = freshState();
  const env = makeEnv(state);
  sessionState = paidSession('cs_retry', {
    payment_link: LINK,
    customer_details: { email: 'retry@stripe.test' },
  });
  const first = await postWebhook(env, 'cs_retry');
  const second = await postWebhook(env, 'cs_retry');
  check('rejeu Stripe : les deux réponses sont 200', first.status === 200 && second.status === 200, `(${first.status}, ${second.status})`);
  check('rejeu Stripe : une seule licence', state.licenses.length === 1, `(n=${state.licenses.length})`);
}

console.log(failures ? `PAYMENT LINK : ${failures} ECHEC(S)` : 'PAYMENT LINK : OK');
process.exit(failures ? 1 : 0);
