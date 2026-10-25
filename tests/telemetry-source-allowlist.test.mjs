#!/usr/bin/env node
import { validateEvent } from '../telemetry-worker/index.js';

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures++; console.log(`  FAIL ${name} ${detail}`); }
}

console.log('=== TELEMETRIE : allowlist des sources ===');

const known = ['google', 'yt', 'reddit', 'discord', 'forum', 'direct', 'other'];
for (const source of known) {
  const row = validateEvent({
    v: 1,
    event: 'page_view',
    page: '/',
    lang: 'en',
    props: { step: 'load', source }
  });
  check(`source autorisee : ${source}`, row !== null && row.source === source,
    `(row=${JSON.stringify(row)})`);
}

for (const source of ['tiktok', 'forums', 'https://example.com/?email=a@b.com', 'x'.repeat(80), 17]) {
  const row = validateEvent({
    v: 1,
    event: 'page_view',
    page: '/',
    lang: 'en',
    props: { step: 'load', source }
  });
  check(`source non autorisee normalisee en other : ${String(source).slice(0, 24)}`,
    row !== null && row.source === 'other', `(row=${JSON.stringify(row)})`);
}

console.log(failures === 0 ? '\nTELEMETRIE SOURCES : OK' : `\nTELEMETRIE SOURCES : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
