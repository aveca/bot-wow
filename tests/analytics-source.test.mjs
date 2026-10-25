#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const client = await readFile(new URL('../assets/analytics.js', import.meta.url), 'utf8');
let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures++; console.log(`  FAIL ${name} ${detail}`); }
}

async function sourceFor(search, referrer = '') {
  const sent = [];
  const store = new Map();
  const sessionStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, value); }
  };
  const window = {
    BOTWOW_TRACK_ENDPOINT: '/api/track',
    doNotTrack: '0',
    addEventListener() {}
  };
  const document = {
    documentElement: { lang: 'en' },
    readyState: 'complete',
    referrer,
    addEventListener() {},
    querySelector() { return null; }
  };
  const navigator = {
    doNotTrack: '0',
    sendBeacon(_url, blob) { sent.push(blob.text()); return true; }
  };
  const location = { search, pathname: '/', hostname: 'bot-wow.com' };
  runInNewContext(client, {
    window, document, navigator, location, sessionStorage,
    Blob, Date, Math, JSON, Object, String, Number, RegExp, console
  });
  if (!sent.length) throw new Error(`analytics emitted no event for ${search}`);
  return JSON.parse(await sent[0]).props.source;
}

console.log('=== ANALYTICS : attribution UTM ===');
const cases = [
  ['Reddit', '?utm_source=reddit', 'reddit'],
  ['Discord', '?utm_source=discord', 'discord'],
  ['YouTube alias', '?utm_source=youtube', 'yt'],
  ['YouTube canonical alias', '?utm_source=yt', 'yt'],
  ['Forum', '?utm_source=forum', 'forum'],
  ['Forum plural alias', '?utm_source=forums', 'forum'],
  ['UTM after another parameter', '?utm_campaign=october&utm_source=forum', 'forum'],
  ['Unknown/forged UTM', '?utm_source=tiktok', 'other'],
  ['No UTM and no referrer', '', 'direct']
];
for (const [label, search, expected] of cases) {
  try {
    const actual = await sourceFor(search);
    check(`${label} -> ${expected}`, actual === expected, `(recu ${actual})`);
  } catch (error) {
    check(label, false, error.message);
  }
}
console.log(failures === 0 ? '\nANALYTICS SOURCES : OK' : `\nANALYTICS SOURCES : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
