#!/usr/bin/env node
/**
 * Exercise Worker delivery paths with synthetic data and mocked providers.
 * No real email, payment, or production database is used.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const workerSource = readFileSync(join(REPO, 'worker', 'index.js'), 'utf8');
const tmpWorker = join(HERE, '.worker-log-redaction.mjs');
writeFileSync(tmpWorker, workerSource);
const workerMod = await import('file:///' + tmpWorker.replace(/\\/g, '/') + '?t=' + Date.now());

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log('  ok   ' + name);
  else { failures += 1; console.log('  FAIL ' + name + ' ' + detail); }
}
function makeState() {
  return { calls: [], events: new Set(), licenseKeys: [], downloadTokens: [], deliveries: [] };
}
function makeEnv(state, resendKey = null, failMarker = false) {
  const db = {
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      let args = [];
      const stmt = {
        bind(...values) { args = values; return stmt; },
        async run() {
          state.calls.push({ sql: normalized, args });
          if (/INSERT INTO webhook_events/i.test(normalized)) {
            if (state.events.has(args[0])) throw new Error('UNIQUE constraint failed: webhook_events.id');
            state.events.add(args[0]);
          }
          if (/INSERT INTO licenses/i.test(normalized)) state.licenseKeys.push(args[0]);
          if (/INSERT INTO downloads/i.test(normalized)) state.downloadTokens.push(args[0]);
          if (/INSERT INTO deliveries/i.test(normalized)) state.deliveries.push(args);
          if (failMarker && /INSERT INTO webhook_events/i.test(normalized)) {
            throw new Error('SENSITIVE-ERROR-SENTINEL synthetic-buyer@example.test LICENCE-SECRET TOKEN-SECRET');
          }
          return { meta: { last_row_id: 1, changes: 1 } };
        },
        async first() {
          state.calls.push({ sql: normalized, args });
          if (/FROM licenses l/i.test(normalized)) {
            return { key: 'RESEND-LICENCE-SECRET', lang: 'fr', status: 'active', token: 'RESEND-DOWNLOAD-TOKEN-SECRET' };
          }
          if (/FROM webhook_events/i.test(normalized) && state.events.has(args[0])) return { id: args[0] };
          return null;
        },
        async all() { return { results: [] }; }
      };
      return stmt;
    },
    async batch(stmts) { await Promise.all(stmts.map((s) => s.run())); return []; }
  };
  const kv = { get: async () => null, put: async () => {}, delete: async () => {} };
  const telemetry = {
    prepare(sql) {
      return { bind: (...args) => ({ run: async () => { state.calls.push({ sql, args }); return { success: true }; } }) };
    }
  };
  return {
    DB: db,
    TELEMETRY_DB: telemetry,
    RATE_LIMIT: kv,
    R2_BINARIES: { get: async () => null },
    MOLLIE_API_KEY: 'test-mollie-key',
    MOLLIE_WEBHOOK_SECRET: 'test-webhook-secret',
    ADMIN_JWT_SECRET: 'test-admin-secret',
    RESEND_API_KEY: resendKey,
    state
  };
}
async function captureConsole(fn) {
  const output = [];
  const original = { log: console.log, warn: console.warn, error: console.error };
  const render = (value) => value instanceof Error ? (value.stack || value.message)
    : typeof value === 'string' ? value : JSON.stringify(value);
  console.log = (...args) => output.push(args.map(render).join(' '));
  console.warn = (...args) => output.push(args.map(render).join(' '));
  console.error = (...args) => output.push(args.map(render).join(' '));
  try { return { value: await fn(), output }; }
  finally { console.log = original.log; console.warn = original.warn; console.error = original.error; }
}
async function callWorker(path, env, body, contentType = 'application/x-www-form-urlencoded') {
  return workerMod.default.fetch(new Request('https://api.bot-wow.com' + path, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body
  }), env, {});
}
const realFetch = globalThis.fetch;
let failMollie = false;
let resendCalls = 0;
globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  if (target.startsWith('https://api.mollie.com/v2/payments/')) {
    if (failMollie) throw new Error('SENSITIVE-ERROR-SENTINEL synthetic-buyer@example.test LICENCE-SECRET TOKEN-SECRET');
    return new Response(JSON.stringify({
      id: 'tr_synthetic_test',
      status: 'paid',
      amount: { value: '20.00', currency: 'EUR' },
      metadata: { email: 'synthetic-buyer@example.test', lang: 'fr', product: 'bot-wow-lifetime', journey_id: 'journey_test_123' }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (target === 'https://api.resend.com/emails') {
    resendCalls += 1;
    return new Response(JSON.stringify({ id: 'email_synthetic_test' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, options);
};
const sensitiveValues = [
  'synthetic-buyer@example.test',
  'RESEND-LICENCE-SECRET',
  'RESEND-DOWNLOAD-TOKEN-SECRET',
  'SENSITIVE-ERROR-SENTINEL',
  'https://api.bot-wow.com/api/download?t='
];
try {
  const paidState = makeState();
  const paidCapture = await captureConsole(() => callWorker('/api/mollie-webhook', makeEnv(paidState), 'id=tr_synthetic_test'));
  const paidLogs = paidCapture.output.join('\n');
  check('synthetic paid webhook is handled', paidCapture.value.status === 200);
  check('paid webhook reaches the license creation path', paidState.licenseKeys.length === 1 && paidState.downloadTokens.length === 1);
  check('paid webhook logs contain no email, licence key, token, or token URL',
    sensitiveValues.slice(0, 3).every((value) => !paidLogs.includes(value)) && !paidLogs.includes(sensitiveValues[4]), paidLogs);
  check('delivery failure is persisted for retry when provider credentials are absent', paidState.deliveries.length === 1);

  const resendState = makeState();
  const resendEnv = makeEnv(resendState, 'test-resend-key');
  const resendCapture = await captureConsole(() => callWorker('/api/resend', resendEnv,
    JSON.stringify({ email: 'synthetic-buyer@example.test' }), 'application/json'));
  const resendLogs = resendCapture.output.join('\n');
  check('resend endpoint returns its privacy-safe response', resendCapture.value.status === 200);
  check('resend invokes the mocked email provider', resendCalls === 1);
  check('resend logs contain no recipient, licence key, token, or token URL',
    !resendLogs.includes('synthetic-buyer@example.test')
      && !resendLogs.includes('RESEND-LICENCE-SECRET')
      && !resendLogs.includes('RESEND-DOWNLOAD-TOKEN-SECRET')
      && !resendLogs.includes('https://api.bot-wow.com/api/download?t='), resendLogs);

  failMollie = true;
  const failureState = makeState();
  const failureCapture = await captureConsole(() => callWorker('/api/mollie-webhook', makeEnv(failureState), 'id=tr_synthetic_test'));
  const failureLogs = failureCapture.output.join('\n');
  check('Mollie lookup failure returns retryable server error', failureCapture.value.status === 500);
  check('Mollie lookup error details are not copied to logs',
    !sensitiveValues.some((value) => failureLogs.includes(value)), failureLogs);

  const forbiddenPatterns = [
    /console\.log\(["']\[EMAIL\] Key:/,
    /console\.log\(["']\[EMAIL\] Download URL:/,
    /console\.log\(["']\[EMAIL\] Delivery email would be sent to:/,
    /console\.log\(.Order fulfilled:.*email.*licenseKey/,
    /console\.log\(["']\[ADMIN\] Paid order:["'],\s*\{\s*email,\s*key/
  ];
  check('source contains no known unsafe log patterns', forbiddenPatterns.every((pattern) => !pattern.test(workerSource)));
} finally {
  globalThis.fetch = realFetch;
  rmSync(tmpWorker, { force: true });
}
if (failures) process.exitCode = 1;
else console.log('PASS: Worker log redaction and mocked resend checks');
