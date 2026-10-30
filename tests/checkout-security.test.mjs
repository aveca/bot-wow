#!/usr/bin/env node
/**
 * checkout-security.test.mjs — protections du checkout Mollie.
 *
 * Appelle le VRAI Worker (worker/index.js) avec un D1 simule, un KV **stateful**
 * (pour que le rate limit s'engage reellement) et un `fetch` intercepte pour
 * Mollie. Verifie :
 *
 *  1. le rate limit du checkout est bien 5 requetes / 5 min / IP ;
 *  2. le depassement repond 429 + Retry-After, sans creer de paiement ;
 *  3. le budget est par IP (une autre IP n'est pas penalisee) ;
 *  4. la locale envoyee a Mollie est une locale ISO 15897 valide
 *     (fr_FR / en_US / de_DE / es_ES / pt_PT, repli en_US) ;
 *  5. aucune reponse ne laisse fuiter un secret ;
 *  6. les entrees invalides sont refusees sans toucher a Mollie.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

/* ---------------------------------------------------------- environnement */
function makeEnv(state) {
  const db = {
    prepare(sql) {
      const key = sql.replace(/\s+/g, ' ').trim();
      const exec = {
        bind: (...args) => ({
          run: async () => { state.calls.push({ sql: key, args }); return { meta: { last_row_id: 0 } }; },
          first: async () => {
            state.calls.push({ sql: key, args });
            if (/FROM mollie_customers/i.test(key)) return null;
            return null;
          },
          all: async () => [],
        }),
      };
      return exec;
    },
    batch: async () => [],
  };

  // KV stateful : le rate limit doit vraiment compter.
  const store = state.kvStore || (state.kvStore = new Map());
  const kv = {
    get: async (k) => {
      const v = store.get(k);
      if (v === undefined) return null;
      try { return JSON.parse(v); } catch { return v; }
    },
    put: async (k, v) => { store.set(k, v); },
    delete: async (k) => { store.delete(k); },
  };

  return {
    DB: db,
    RATE_LIMIT: kv,
    R2_BINARIES: { get: async () => null },
    MOLLIE_API_KEY: 'test_key_secret_value',
    MOLLIE_WEBHOOK_SECRET: 'test_webhook_secret_value',
    ADMIN_JWT_SECRET: 'test_admin_secret_value',
    RELEASE_STATUS: 'open',
    state,
  };
}

/* --------------------------------------------------------------- Worker */
const tmpWorker = join(HERE, '.worker-under-test.mjs');
writeFileSync(tmpWorker, readFileSync(join(REPO, 'worker', 'index.js'), 'utf8'));
const workerMod = await import('file:///' + tmpWorker.replace(/\\/g, '/') + '?t=' + Date.now());

/* ----------------------------------------------------------- fetch simule */
const realFetch = globalThis.fetch;
let mollieCalls = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith('https://api.mollie.com/v2/')) {
    mollieCalls.push({ url: u, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null });
    if (u.endsWith('/payments') && (opts.method || 'GET') === 'POST') {
      return new Response(JSON.stringify({ id: 'tr_test', _links: { checkout: { href: 'https://mollie.test/checkout' } } }),
        { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.endsWith('/customers')) {
      return new Response(JSON.stringify({ id: 'cst_test' }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, opts);
};

async function callWorker(path, { method = 'GET', body = null, env, headers = {} } = {}) {
  const req = new Request('https://api.bot-wow.com' + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return workerMod.default.fetch(req, env, {});
}

function freshState() {
  return { calls: [], kvStore: new Map() };
}

/* ------------------------------------------------------------------ tests */
console.log('=== SECURITE DU CHECKOUT (rate limit, locale, fuites) ===');

/* 1-3. rate limit : 5 par 5 min et par IP */
{
  const state = freshState();
  const env = makeEnv(state);
  mollieCalls = [];
  const ip = { 'cf-connecting-ip': '203.0.113.10' };

  const statuses = [];
  for (let i = 0; i < 6; i++) {
    const res = await callWorker('/api/checkout', {
      method: 'POST', body: { email: `client${i}@test.fr`, lang: 'fr' }, env, headers: ip,
    });
    statuses.push(res.status);
    if (res.status === 429) {
      var retryAfter = res.headers.get('Retry-After');
      var limitedBody = await res.json();
    }
  }
  check('les 5 premieres tentatives de checkout passent', statuses.slice(0, 5).every((s) => s === 200),
    `(statuts ${statuses.join(',')})`);
  check('la 6e tentative est refusee en 429', statuses[5] === 429, `(statut ${statuses[5]})`);
  check('la reponse 429 porte un Retry-After', !!retryAfter && Number(retryAfter) > 0, `(Retry-After=${retryAfter})`);
  check('la reponse 429 indique rate_limited', limitedBody && limitedBody.error === 'rate_limited',
    `(corps ${JSON.stringify(limitedBody)})`);
  check('aucun paiement Mollie cree pour la tentative refusee',
    mollieCalls.filter((c) => c.url.endsWith('/payments') && c.method === 'POST').length === 5,
    `(appels ${mollieCalls.length})`);

  // une autre IP a son propre budget
  mollieCalls = [];
  const res2 = await callWorker('/api/checkout', {
    method: 'POST', body: { email: 'other@test.fr', lang: 'fr' }, env,
    headers: { 'cf-connecting-ip': '198.51.100.77' },
  });
  check('le budget est par IP (une autre IP passe)', res2.status === 200, `(statut ${res2.status})`);
}

/* 4. locale Mollie valide pour chaque langue supportee */
{
  const MOLLIELOCALES = new Set([
    'ca_ES', 'cs_CZ', 'da_DK', 'de_AT', 'de_CH', 'de_DE', 'de_LU', 'el_GR', 'en_BE', 'en_GB',
    'en_NL', 'en_US', 'es_ES', 'fi_FI', 'fr_BE', 'fr_FR', 'fr_LU', 'hu_HU', 'is_IS', 'it_IT',
    'lt_LT', 'lv_LV', 'nb_NO', 'nl_BE', 'nl_NL', 'pl_PL', 'pt_PT', 'sk_SK', 'sl_SI', 'sv_SE', 'tr_TR',
  ]);
  const expectations = [
    // validateLang2 normalise d'abord : une langue inconnue devient "fr"
    // (defaut du site), d'ou fr_FR cote Mollie.
    ['fr', 'fr_FR'], ['en', 'en_US'], ['de', 'de_DE'], ['es', 'es_ES'],
    ['pt', 'pt_PT'],
    // "ru" est accepte par validateLang mais Mollie n'a pas de page hebergee
    // russe : repli sur en_US plutot qu'une locale invalide.
    ['ru', 'en_US'],
    // langue inconnue -> normalisee en "fr" par validateLang2
    ['xx', 'fr_FR'],
  ];
  for (const [lang, expected] of expectations) {
    const state = freshState();
    const env = makeEnv(state);
    mollieCalls = [];
    await callWorker('/api/checkout', {
      method: 'POST', body: { email: 'loc@test.fr', lang }, env,
      headers: { 'cf-connecting-ip': '192.0.2.5' },
    });
    const payment = mollieCalls.find((c) => c.url.endsWith('/payments') && c.method === 'POST');
    const customer = mollieCalls.find((c) => c.url.endsWith('/customers') && c.method === 'POST');
    const loc = payment && payment.body.locale;
    check(`locale Mollie pour lang=${lang} est ${expected}`, loc === expected, `(recu ${loc})`);
    check(`locale client pour lang=${lang} est acceptée par l'API Mollie`,
      !!loc && MOLLIELOCALES.has(loc), `(recu ${loc})`);
    check(`locale client pour lang=${lang} est la meme sur /customers`,
      !customer || customer.body.locale === loc, `(client ${customer && customer.body.locale} / paiement ${loc})`);
  }
}

/* 5. aucune fuite de secret dans les reponses */
{
  const state = freshState();
  const env = makeEnv(state);
  mollieCalls = [];
  const res = await callWorker('/api/checkout', {
    method: 'POST', body: { email: 'secret@test.fr', lang: 'en' }, env,
    headers: { 'cf-connecting-ip': '192.0.2.60' },
  });
  const text = await res.text();
  const secrets = ['test_key_secret_value', 'test_webhook_secret_value', 'test_admin_secret_value', 'MOLLIE_API_KEY'];
  const leaked = secrets.filter((s) => text.includes(s));
  check('la reponse du checkout ne fuite aucun secret', leaked.length === 0, `(fuite ${JSON.stringify(leaked)})`);
}

/* 6. entrees invalides : refus AVANT tout appel a Mollie */
{
  const state = freshState();
  const env = makeEnv(state);
  mollieCalls = [];
  const badEmail = await callWorker('/api/checkout', {
    method: 'POST', body: { email: 'pas-un-email', lang: 'fr' }, env,
    headers: { 'cf-connecting-ip': '192.0.2.90' },
  });
  check('un e-mail invalide est refuse en 400', badEmail.status === 400, `(statut ${badEmail.status})`);

  const badAmount = await callWorker('/api/checkout', {
    method: 'POST', body: { email: 'ok@test.fr', amount: 1 }, env,
    headers: { 'cf-connecting-ip': '192.0.2.91' },
  });
  check('un montant different de la reference est refuse en 400', badAmount.status === 400, `(statut ${badAmount.status})`);
  check('aucun paiement Mollie cree pour une entree invalide',
    mollieCalls.filter((c) => c.url.endsWith('/payments') && c.method === 'POST').length === 0,
    `(appels ${mollieCalls.length})`);

  const badJson = await callWorker('/api/checkout', {
    method: 'POST', env, headers: { 'cf-connecting-ip': '192.0.2.92', 'Content-Type': 'application/json' },
  });
  check('un corps JSON invalide est refuse', badJson.status >= 400 && badJson.status < 500, `(statut ${badJson.status})`);
}

console.log(failures === 0 ? '\nSECURITE DU CHECKOUT : OK' : `\nSECURITE DU CHECKOUT : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
