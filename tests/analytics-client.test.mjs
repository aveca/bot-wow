#!/usr/bin/env node
/**
 * analytics-client.test.mjs — les evenements client sont envoyes une fois,
 * sous la forme simple acceptee par /api/track. Aucun lot n'est rejoue au
 * pagehide ; si sendBeacon refuse la mise en file, fetch prend le relais.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../assets/analytics.js', import.meta.url), 'utf8');

function loadClient({ beaconResult = true, doNotTrack = '0', fetchAvailable = true } = {}) {
  const beacons = [];
  const fetches = [];
  const windowListeners = {};
  const documentListeners = {};
  const window = {
    doNotTrack,
    addEventListener(name, handler) { windowListeners[name] = handler; },
  };
  if (fetchAvailable) {
    window.fetch = (url, options) => {
      fetches.push({ url, options });
      return Promise.resolve({ ok: true });
    };
  }
  const navigator = { doNotTrack };
  navigator.sendBeacon = (url, blob) => {
    beacons.push({ url, blob });
    return beaconResult;
  };
  const document = {
    readyState: 'complete',
    documentElement: { lang: 'en' },
    addEventListener(name, handler) { documentListeners[name] = handler; },
  };
  vm.runInNewContext(source, {
    window,
    navigator,
    document,
    location: { pathname: '/', search: '' },
    Blob,
    console,
  }, { filename: 'assets/analytics.js' });
  return { window, navigator, document, beacons, fetches, windowListeners, documentListeners };
}

async function decodeBeacons(beacons) {
  return Promise.all(beacons.map(async ({ blob }) => JSON.parse(await blob.text())));
}

console.log('=== ANALYTICS CLIENT : envoi individuel sans doublon pagehide ===');

{
  const client = loadClient();
  assert.equal(client.beacons.length, 1, 'le page_view initial est envoye une fois');
  client.window.botwowTrack('cta_click', { cta: 'hero-buy', step: 'hero' });
  assert.equal(client.beacons.length, 2, 'le clic CTA produit un seul envoi supplementaire');

  const payloads = await decodeBeacons(client.beacons);
  assert.deepEqual(payloads.map((p) => p.event), ['page_view', 'cta_click']);
  assert.ok(payloads.every((p) => !('batch' in p)), 'chaque requete contient un evenement, pas un lot');

  assert.equal(typeof client.windowListeners.pagehide, 'function', 'le nettoyage pagehide est branche');
  client.windowListeners.pagehide();
  assert.equal(client.beacons.length, 2, 'pagehide ne renvoie pas les evenements deja envoyes');
  assert.equal(client.fetches.length, 0, 'aucun POST de lot n est ajoute au depart de page');
}

{
  const client = loadClient({ beaconResult: false });
  assert.equal(client.beacons.length, 1, 'sendBeacon est tente pour le page_view');
  assert.equal(client.fetches.length, 1, 'fetch prend le relais si sendBeacon refuse');
  client.window.botwowTrack('cta_click', { cta: 'hero-buy', step: 'hero' });
  assert.equal(client.fetches.length, 2, 'le CTA est envoye une seule fois via fetch');

  const bodies = client.fetches.map(({ options }) => JSON.parse(options.body));
  assert.deepEqual(bodies.map((p) => p.event), ['page_view', 'cta_click']);
  assert.ok(bodies.every((p) => !('batch' in p)), 'fetch envoie aussi un evenement individuel');

  client.windowListeners.pagehide();
  assert.equal(client.fetches.length, 2, 'pagehide ne duplique pas les requetes fetch');
}

{
  const client = loadClient({ doNotTrack: '1' });
  assert.equal(client.beacons.length, 0, 'Do Not Track empeche les envois');
  assert.equal(client.fetches.length, 0, 'Do Not Track empeche le fallback fetch');
}

console.log('ANALYTICS CLIENT : OK');
