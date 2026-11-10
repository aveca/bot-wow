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

const homeEn = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const homeFr = await readFile(new URL('../fr/index.html', import.meta.url), 'utf8');
check(
  'English homepage labels nav CTA as status, not purchase',
  homeEn.includes('data-cta-id="nav-status"') && !homeEn.includes('data-cta-id="nav-buy"')
);
check(
  'French homepage labels nav CTA as status, not purchase',
  homeFr.includes('data-cta-id="nav-status"') && !homeFr.includes('data-cta-id="nav-buy"')
);

async function checkoutClickEvents(cta) {
  const sent = [];
  const listeners = {};
  const store = new Map();
  const sessionStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, value); }
  };
  const window = { BOTWOW_TRACK_ENDPOINT: '/api/track', doNotTrack: '0', addEventListener() {} };
  const document = {
    documentElement: { lang: 'en' },
    readyState: 'complete',
    referrer: '',
    addEventListener(type, handler) { (listeners[type] ||= []).push(handler); },
    querySelector() { return null; }
  };
  const navigator = {
    doNotTrack: '0',
    sendBeacon(_url, blob) { sent.push(blob.text()); return true; }
  };
  const location = { search: '', pathname: '/', hostname: 'bot-wow.com' };
  runInNewContext(client, {
    window, document, navigator, location, sessionStorage,
    Blob, Date, Math, JSON, Object, String, Number, RegExp, console
  });
  sent.length = 0;
  const element = {
    getAttribute(name) {
      if (name === 'data-cta-id') return cta;
      if (name === 'data-track') return 'cta_click';
      return null;
    },
    closest() { return null; }
  };
  const target = {
    closest(selector) {
      if (selector === '[data-track]') return element;
      if (selector.includes('[data-cta-id="' + cta + '"]')) return element;
      return null;
    }
  };
  for (const handler of listeners.click || []) handler({ target });
  return (await Promise.all(sent)).map(body => JSON.parse(body).event);
}
const statusEvents = await checkoutClickEvents('nav-status');
check(
  'status navigation click does not emit checkout_requested',
  !statusEvents.includes('checkout_requested'),
  '(' + statusEvents.join(', ') + ')'
);

console.log(failures === 0 ? '\nANALYTICS SOURCES : OK' : `\nANALYTICS SOURCES : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
