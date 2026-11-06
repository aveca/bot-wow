#!/usr/bin/env node
/**
 * Candidate overlay test: exact v50 baseline + only non-financial changes.
 * The candidate is generated in a temp directory; production is never called.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const baselinePath = join(ROOT, 'reports/operations/baselines/botwow-api-v50-2026-10-27.index.js');
const overlayPath = join(ROOT, 'worker/patches/botwow-api-v50-nonfinancial-overlay.json');
const baseline = readFileSync(baselinePath, 'utf8');
const overlay = JSON.parse(readFileSync(overlayPath, 'utf8'));
let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log('  ok   ' + name);
  else { failures++; console.log('  FAIL ' + name + ' ' + detail); }
}
function sha(s) { return createHash('sha256').update(s, 'utf8').digest('hex'); }
function extractFunction(src, name) {
  let start = src.indexOf('async function ' + name + '(');
  if (start < 0) start = src.indexOf('function ' + name + '(');
  if (start < 0) return null;
  let end = src.indexOf('\n__name(' + name + ',', start);
  if (end < 0) end = src.indexOf('\n__name2(' + name + ',', start);
  return end < 0 ? null : src.slice(start, end).trim();
}
function replaceFunction(src, name, replacement) {
  let start = src.indexOf('async function ' + name + '(');
  if (start < 0) start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('Missing baseline function: ' + name);
  const fn = extractFunction(src, name);
  if (!fn) throw new Error('Cannot delimit baseline function: ' + name);
  const marker2 = src.indexOf('\n__name2(' + name + ',', start);
  const marker1 = src.indexOf('\n__name(' + name + ',', start);
  const marker = marker2 >= 0 ? marker2 : marker1;
  if (marker < 0) throw new Error('Missing function name marker: ' + name);
  const lineEnd = src.indexOf('\n', marker + 1);
  const end = lineEnd < 0 ? src.length : lineEnd + 1;
  return { source: src.slice(0, start) + replacement + '\n' + src.slice(end), original: fn };
}
function declaration(src, name) {
  const re = new RegExp('(var|let|const)\\s+' + name + '\\s*=');
  const m = re.exec(src);
  if (!m) return null;
  const end = src.indexOf(';', m.index);
  return end < 0 ? null : src.slice(m.index, end + 1).trim();
}
function apiRoutes(src) {
  return src.split('\n').filter((line) =>
    line.includes('path === "/api/') || line.includes('path.startsWith("/api/')
  );
}

check('baseline version id is v50', overlay.baseline.version === 50 && overlay.baseline.version_id === 'c3dcc842-c422-42d3-9828-405f30d70b5f');
check('baseline SHA-256 matches captured production source', sha(baseline) === overlay.baseline.sha256, sha(baseline));

let candidate = baseline;
for (const item of overlay.replacements) {
  const replaced = replaceFunction(candidate, item.name, item.replacement);
  candidate = replaced.source;
}
for (const item of overlay.route_replacements) {
  const count = candidate.split(item.from).length - 1;
  check('single landing dispatch replacement', count === item.expected_count, 'count=' + count);
  candidate = candidate.split(item.from).join(item.to);
}

check('legacy landing function removed', !candidate.includes('async function handleLanding('));
check('canonical redirect helper installed', candidate.includes('function redirectToCanonicalSite(request)'));
check('legacy landing dispatch removed', !candidate.includes('return handleLanding(request, env22);'));
check('download uses configured R2 key only', candidate.includes('env2.R2_OBJECT_KEY') && !candidate.includes('Casinababe-v1.0.38.zip'));
check('download checks R2 before quota reservation', candidate.indexOf('R2_BINARIES.get(objectKey)') >= 0 && candidate.indexOf('R2_BINARIES.get(objectKey)') < candidate.indexOf('UPDATE downloads SET count = count + 1'));
check('download quota update is atomic', candidate.includes('UPDATE downloads SET count = count + 1 WHERE token = ? AND count < max_count'));
check('download filename follows the served object key', candidate.includes('const safeFilename = objectKey;') && candidate.includes('"Content-Disposition": "attachment; filename=') && candidate.includes(' + safeFilename + '));
check('checkout release gate remains present', extractFunction(candidate, 'handleCheckout')?.includes('RELEASE_STATUS') === true);
check('all API route declarations remain byte-identical', JSON.stringify(apiRoutes(candidate)) === JSON.stringify(overlay.preserved_api_route_lines));

for (const name of overlay.preserved_functions) {
  const before = extractFunction(baseline, name);
  const after = extractFunction(candidate, name);
  if (before === null && after === null) continue;
  check('function unchanged: ' + name, before !== null && after !== null && sha(before) === sha(after));
}
for (const name of overlay.preserved_declarations) {
  const before = declaration(baseline, name);
  const after = declaration(candidate, name);
  check('declaration unchanged: ' + name, before !== null && after !== null && sha(before) === sha(after));
}

const temp = mkdtempSync(join(tmpdir(), 'botwow-v50-overlay-'));
let workerMod;
try {
  const workerDir = join(temp, 'worker');
  const testsDir = join(temp, 'tests');
  mkdirSync(workerDir, { recursive: true });
  mkdirSync(testsDir, { recursive: true });
  const candidatePath = join(workerDir, 'worker-under-test.mjs');
  writeFileSync(candidatePath, candidate);
  writeFileSync(join(workerDir, 'index.js'), candidate);
  workerMod = await import('file://' + candidatePath.replace(/\\/g, '/') + '?t=' + Date.now());

  const landing = await workerMod.default.fetch(
    new Request('https://api.bot-wow.com/bot-wow-gold?utm_source=overlay'),
    {}, {}
  );
  check('legacy landing returns HTTP 308', landing.status === 308, 'status=' + landing.status);
  check('legacy landing redirects to canonical path and query',
    landing.headers.get('location') === 'https://bot-wow.com/bot-wow-gold?utm_source=overlay',
    'location=' + landing.headers.get('location'));

  async function downloadCase(object, changes = 1, key = 'casinobabe-fishing-1.2.0.zip') {
    const state = { events: [], quotaWrites: 0 };
    const env = {
      R2_OBJECT_KEY: key,
      RATE_LIMIT: { get: async () => null, put: async () => {} },
      DB: {
        prepare(sql) {
          return {
            bind() {
              return {
                first: async () => {
                  state.events.push('select');
                  return {
                    token: 'tok_test', lic_status: 'active', license_key: 'LIC-TEST',
                    expires_at: Date.now() + 60000, count: 0, max_count: 1
                  };
                },
                run: async () => {
                  state.events.push('quota');
                  state.quotaWrites++;
                  return { meta: { changes } };
                }
              };
            }
          };
        }
      },
      R2_BINARIES: {
        get: async (objectKey) => {
          state.events.push('r2:' + objectKey);
          return object;
        }
      }
    };
    const response = await workerMod.default.fetch(
      new Request('https://api.bot-wow.com/api/download?t=tok_test'), env, {}
    );
    return { response, state };
  }

  const missing = await downloadCase(null);
  check('missing R2 artifact returns 503', missing.response.status === 503, 'status=' + missing.response.status);
  check('missing R2 artifact does not consume quota', missing.state.quotaWrites === 0);
  check('missing R2 artifact checks only the configured key',
    missing.state.events.filter(x => x.startsWith('r2:')).join(',') === 'r2:casinobabe-fishing-1.2.0.zip');

  const present = await downloadCase({ body: new Response('PK\\u0003\\u0004test').body });
  check('present R2 artifact returns ZIP 200', present.response.status === 200, 'status=' + present.response.status);
  check('Content-Disposition matches the configured artifact',
    present.response.headers.get('content-disposition') === 'attachment; filename="casinobabe-fishing-1.2.0.zip"',
    'header=' + present.response.headers.get('content-disposition'));
  check('R2 lookup precedes atomic quota reservation',
    present.state.events.indexOf('r2:casinobabe-fishing-1.2.0.zip') >= 0 &&
    present.state.events.indexOf('r2:casinobabe-fishing-1.2.0.zip') < present.state.events.indexOf('quota'),
    'events=' + present.state.events.join('>'));

  const exhausted = await downloadCase({ body: new Response('PK\\u0003\\u0004test').body }, 0);
  check('atomic quota exhaustion returns 429', exhausted.response.status === 429, 'status=' + exhausted.response.status);
  check('atomic quota exhaustion never serves ZIP',
    !(exhausted.response.headers.get('content-type') || '').includes('application/zip'));

  const invalid = await downloadCase(null, 1, 'Casinababe-v1.0.38.zip');
  check('invalid legacy artifact key returns 503', invalid.response.status === 503, 'status=' + invalid.response.status);
  check('invalid legacy artifact key never queries R2',
    !invalid.state.events.some(x => x.startsWith('r2:')));

  // Run the existing payment/security suites against the generated v50 candidate,
  // not against main. These tests make no real Mollie request (fetch is intercepted).
  for (const name of ['payment-flow.test.mjs', 'checkout-security.test.mjs', 'worker-fulfillment-reconciliation.test.mjs']) {
    copyFileSync(join(ROOT, 'tests', name), join(testsDir, name));
    const run = spawnSync('node', [join(testsDir, name)], {
      cwd: temp, encoding: 'utf8', timeout: 120000
    });
    check('candidate executes ' + name, run.status === 0,
      'exit=' + run.status + '\n' + (run.stdout || '') + '\n' + (run.stderr || ''));
  }
} catch (error) {
  check('candidate runtime test completed', false, error && error.stack ? error.stack : String(error));
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log(failures === 0 ? 'V50 SAFE OVERLAY: PASS' : 'V50 SAFE OVERLAY: ' + failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);
