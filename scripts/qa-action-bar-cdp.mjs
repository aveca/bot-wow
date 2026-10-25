#!/usr/bin/env node
/**
 * qa-action-bar-cdp.mjs — QA visuelle de la barre d'action desktop.
 *
 * Verifie le comportement REEL dans le navigateur (pas seulement le code) :
 *  1. a l'ouverture (hero visible) : la barre est masquee sur desktop ;
 *  2. apres avoir depasse le hero : la barre apparait, en bas a droite ;
 *  3. sur mobile : visible des l'ouverture ;
 *  4. le lien de la barre cible bien la section d'achat.
 *
 * Sortie : .qa-captures/action-bar/<etat>/<viewport>.png + .json
 *
 * Usage : node scripts/qa-action-bar-cdp.mjs [urlDeBase]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

const BASE = process.argv[2] || 'http://127.0.0.1:8099';
const CDP = 'http://127.0.0.1:9333';
const OUT = join(process.cwd(), '.qa-captures');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = join(tmpdir(), 'botwow-qa-chrome-profile');

const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900, mobile: false },
  { name: 'mobile-390x844', width: 390, height: 844, mobile: true },
];
const ROUTE = '/';

mkdirSync(OUT, { recursive: true });

/* --------------------------------------------------------------- client CDP */
function connectCDP(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: res, reject: rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message));
        else res(msg.result);
      }
    };
    ws.onerror = () => reject(new Error('WebSocket CDP en erreur'));
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const mid = ++id;
          pending.set(mid, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      },
      close: () => ws.close(),
    });
  });
}

async function startChrome() {
  mkdirSync(PROFILE, { recursive: true });
  const child = spawn(CHROME, [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--noerrdialogs', '--disable-gpu',
    `--remote-debugging-port=${new URL(CDP).port}`,
    `--user-data-dir=${PROFILE}`, 'about:blank',
  ], { stdio: 'ignore', detached: false });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 300));
    try { const res = await fetch(CDP + '/json/version'); if (res.ok) return child; } catch { /* pas pret */ }
  }
  throw new Error('Chrome CDP na pas demarré');
}

async function openTab(url) {
  const res = await fetch(CDP + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  if (!res.ok) throw new Error(`CDP /json/new -> ${res.status}`);
  return res.json();
}
async function closeTab(targetId) {
  await fetch(CDP + '/json/close/' + targetId).catch(() => {});
}

/** Mesure l'etat de la barre a un scroll donne, et capture l'ecran. */
async function probe(cdp, vp, scrollY, stateName) {
  await cdp.send('Runtime.evaluate', { expression: `window.scrollTo(0, ${scrollY}); window.scrollY`, returnByValue: true });
  await new Promise((r) => setTimeout(r, 900));
  const m = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const b = document.querySelector('.mbar');
      if (!b) return JSON.stringify({ present: false });
      const cs = getComputedStyle(b);
      const r = b.getBoundingClientRect();
      const link = b.querySelector('a');
      return JSON.stringify({
        present: true,
        isOn: b.classList.contains('is-on'),
        display: cs.display,
        opacity: cs.opacity,
        pointerEvents: cs.pointerEvents,
        rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) },
        inViewport: r.top < innerHeight && r.bottom > 0,
        text: b.textContent.replace(/\\s+/g, ' ').trim(),
        linkHref: link ? link.getAttribute('href') : null,
        scrollY: Math.round(window.scrollY),
      });
    })()`,
    returnByValue: true,
  });
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  return { state: stateName, scrollY, metrics: JSON.parse(m.result.value), png: Buffer.from(shot.data, 'base64') };
}

/**
 * Verdict pour un etat donne.
 * - desktop, hero visible : la barre DOIT etre masquee (display none ou opacity 0)
 * - desktop, apres le hero : la barre DOIT etre visible et dans l'ecran
 * - mobile, les deux etats : la barre DOIT etre visible (permanente)
 */
function verdict(vp, probeResult) {
  const md = probeResult.metrics;
  if (!md.present) return { ok: false, why: 'barre absente du DOM' };
  const visible = md.display !== 'none' && Number(md.opacity) > 0.5;
  if (vp.mobile) {
    return { ok: visible, why: visible ? 'mobile : visible (attendu)' : 'mobile : invisible (inattendu)' };
  }
  if (probeResult.state === 'haut') {
    return { ok: !visible, why: visible ? 'desktop : visible sur le hero (inattendu)' : 'desktop : masquee sur le hero (attendu)' };
  }
  return {
    ok: visible && md.inViewport,
    why: (visible ? 'visible' : 'invisible') + (md.inViewport ? ' et dans l ecran' : ' et HORS ecran'),
  };
}

/* ------------------------------------------------------------------- boucle */
console.log('QA barre d\'action (comportement reel)...');
const chrome = await startChrome();
let failed = 0;

for (const vp of VIEWPORTS) {
  const dir = join(OUT, 'action-bar', vp.name);
  mkdirSync(dir, { recursive: true });
  const target = await openTab(BASE + ROUTE);
  let cdp;
  try {
    cdp = await connectCDP(target.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width, height: vp.height, deviceScaleFactor: 1,
      mobile: vp.mobile, screenWidth: vp.width, screenHeight: vp.height,
    });
    await cdp.send('Page.navigate', { url: BASE + ROUTE });
    await new Promise((r) => setTimeout(r, 2200));

    // Etat 1 : hero visible (haut de page)
    const haut = await probe(cdp, vp, 0, 'haut');
    // Etat 2 : apres le hero (la barre doit apparaitre sur desktop)
    const apres = await probe(cdp, vp, 1600, 'apres-hero');

    for (const p of [haut, apres]) {
      const v = verdict(vp, p);
      writeFileSync(join(dir, p.state + '.png'), p.png);
      writeFileSync(join(dir, p.state + '.json'), JSON.stringify({ viewport: vp.name, ...p.metrics, verdict: v }, null, 2));
      console.log(`  ${vp.name.padEnd(18)} ${p.state.padEnd(11)} ${v.ok ? 'ok  ' : 'FAIL'} ${v.why}${p.metrics.linkHref ? ' lien=' + p.metrics.linkHref : ''}`);
      if (!v.ok) failed++;
    }
  } catch (e) {
    failed++;
    console.log(`  ${vp.name.padEnd(18)} ECHEC ${e.message}`);
  } finally {
    if (cdp) cdp.close();
    await closeTab(target.id);
  }
}

try { chrome.kill(); } catch { /* deja arrete */ }
console.log('');
console.log(failed === 0 ? 'QA BARRE D ACTION : OK' : `QA BARRE D ACTION : ${failed} ECHEC(S)`);
process.exit(failed === 0 ? 0 : 1);
