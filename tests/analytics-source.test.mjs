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
async function clickEventsFor(attributes) {
  const sent = [];
  const clickHandlers = [];
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
      if (type === 'click') clickHandlers.push(handler);
    },
    querySelector() { return null; }
  };
  const navigator = {
    doNotTrack: '0',
    sendBeacon(_url, blob) { sent.push(blob); return true; }
  };
  const location = {
    search: '?telemetry_dedup=0',
    pathname: '/',
    hostname: 'bot-wow.com'
  };
  runInNewContext(client, {
    window, document, navigator, location, sessionStorage,
    Blob, Date, Math, JSON, Object, String, Number, RegExp, console
  });
  // Ignore the page_view emitted during initialization.
  sent.length = 0;
  const element = {
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attributes, name)
        ? String(attributes[name]) : null;
    },
    closest(selector) {
      if (selector === '[data-track]' && attributes['data-track']) return this;
      if (selector === '[data-checkout-action="request"]'
          && attributes['data-checkout-action'] === 'request') return this;
      return null;
    }
  };
  for (const handler of clickHandlers) handler({ target: element });
  return Promise.all(sent.map(async blob => JSON.parse(await blob.text())));
}

console.log('=== ANALYTICS : checkout intent is explicit ===');
const disabledNavEvents = await clickEventsFor({
  'data-track': 'cta_click',
  'data-cta-id': 'nav-buy'
});
check('disabled nav-buy never emits checkout_requested',
  !disabledNavEvents.some(event => event.event === 'checkout_requested'));
check('disabled nav-buy remains measured as a generic click',
  disabledNavEvents.some(event => event.event === 'cta_click' && event.props.cta === 'nav-buy'));

const demoEvents = await clickEventsFor({
  'data-track': 'cta_click',
  'data-cta-id': 'hero-demo'
});
check('demo CTA never emits checkout_requested',
  !demoEvents.some(event => event.event === 'checkout_requested'));

const activeCheckoutEvents = await clickEventsFor({
  'data-track': 'cta_click',
  'data-cta-id': 'buy-submit',
  'data-checkout-action': 'request'
});
const checkoutIntents = activeCheckoutEvents.filter(event => event.event === 'checkout_requested');
check('explicit active checkout marker emits one intent with its CTA id',
  checkoutIntents.length === 1 && checkoutIntents[0].props.step === 'buy-submit');

console.log(failures === 0 ? '\nANALYTICS SOURCES : OK' : `\nANALYTICS SOURCES : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
