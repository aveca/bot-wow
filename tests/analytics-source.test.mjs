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

console.log('\\n=== ANALYTICS : checkout intent gating ===');
async function checkoutClickEvents(cta, checkoutEnabled) {
  const sent = [];
  const listeners = {};
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
    referrer: '',
    addEventListener(type, handler) {
      (listeners[type] ||= []).push(handler);
    },
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
      if (selector === '[data-checkout-enabled="true"]' && checkoutEnabled) return element;
      return null;
    }
  };
  for (const handler of listeners.click || []) handler({ target });
  return (await Promise.all(sent)).map(body => JSON.parse(body).event);
}

const statusEvents = await checkoutClickEvents('nav-buy', false);
check(
  'status CTA nav-buy is not checkout intent',
  !statusEvents.includes('checkout_requested'),
  '(' + statusEvents.join(', ') + ')'
);
const legacyEvents = await checkoutClickEvents('hero-offer', false);
check(
  'legacy CTA identifiers cannot create checkout intent',
  !legacyEvents.includes('checkout_requested'),
  '(' + legacyEvents.join(', ') + ')'
);
const liveEvents = await checkoutClickEvents('checkout-primary', true);
check(
  'explicitly enabled checkout CTA creates one checkout_requested event',
  liveEvents.filter(event => event === 'checkout_requested').length === 1,
  '(' + liveEvents.join(', ') + ')'
);

console.log(failures === 0 ? '\nANALYTICS SOURCES : OK' : `\nANALYTICS SOURCES : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
