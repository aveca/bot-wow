#!/usr/bin/env node
/**
 * audit-viewports.mjs — mesure reelle des pages dans un vrai navigateur.
 *
 * Sert de boucle de verification : on ne juge pas une page sur une capture
 * statique, on mesure la position reelle des elements (position du CTA
 * principal, hauteur du hero, debordement horizontal), on releve les
 * erreurs de console, les requetes echouees et les reponses HTTP >= 400.
 *
 * Aucune dependance : Chrome est pilote en CDP (WebSocket natif de Node).
 *
 * Usage :
 *   node scripts/audit-viewports.mjs <url> [label]
 *   node scripts/audit-viewports.mjs https://bot-wow.com/ prod
 *
 * Variables d'environnement :
 *   AUDIT_VIEWPORTS  "360x800,390x844,768x1024,1440x900" (defaut)
 *   AUDIT_OUT       dossier de sortie des captures (defaut captures/)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

const TARGET = process.argv[2] || 'https://bot-wow.com/';
const LABEL = process.argv[3] || 'audit';
const VIEWPORTS = (process.env.AUDIT_VIEWPORTS || '360x800,390x844,768x1024,1440x900')
  .split(',').map((v) => {
    const [w, h] = v.trim().split('x').map(Number);
    return { w, h };
  });
const OUT = path.resolve(process.env.AUDIT_OUT || 'captures');
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

async function chromePath() {
  for (const p of CHROME_CANDIDATES) if (fs.existsSync(p)) return p;
  throw new Error('aucun navigateur trouve');
}

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      } else if (msg.method) for (const h of this.handlers) h(msg);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`timeout ${method}`)); } }, 30000);
    });
  }
  on(fn) { this.handlers.push(fn); }
}

/* Mesures relevees dans la page : position reelle des elements. */
const PROBE = `(() => {
  const pick = (sel) => document.querySelector(sel);
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { top: Math.round(r.top + window.scrollY), bottom: Math.round(r.bottom + window.scrollY), height: Math.round(r.height), width: Math.round(r.width) }; };
  const cta = pick('.hero-cta .btn') || pick('[data-track="cta_click"]');
  const ctaAll = [...document.querySelectorAll('.hero-cta .btn')].map((b) => ({
    id: b.getAttribute('data-cta-id') || b.textContent.trim().slice(0, 28), ...box(b) }));
  const h1 = pick('h1');
  const hero = pick('.hero');
  const doc = document.documentElement;
  const parts = {};
  for (const sel of ['.topbar', 'nav', 'nav .logo', 'nav .langs', 'nav .nav-right', '.hero .badge', '.hero h1', '.hero .lead', '.hero .benefits', '.hero-cta', '.radar-panel']) {
    const el = pick(sel);
    if (el) { const b = box(el); parts[sel] = { top: b.top, height: b.height, bottom: b.bottom }; }
  }
  const nav = pick('nav');
  const navBox = nav ? box(nav) : null;
  const heroPad = hero ? getComputedStyle(hero).paddingTop : null;
  const h1Style = h1 ? (() => {
    const cs = getComputedStyle(h1);
    const range = document.createRange();
    range.selectNodeContents(h1);
    return {
      fontSize: cs.fontSize, lineHeight: cs.lineHeight, marginBottom: cs.marginBottom,
      lines: range.getClientRects().length,
      width: Math.round(h1.getBoundingClientRect().width),
      text: h1.innerHTML.replace(/\\s+/g, ' ').trim().slice(0, 90),
    };
  })() : null;
  const overflow = doc.scrollWidth - doc.clientWidth;
  const offenders = [];
  if (overflow > 1) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.right > doc.clientWidth + 1 || r.left < -1) {
        offenders.push((el.tagName + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).slice(0,2).join('.') : '')).slice(0, 60));
        if (offenders.length >= 6) break;
      }
    }
  }
  return JSON.stringify({
    title: document.title,
    lang: doc.lang,
    hasTrack: typeof window.botwowTrack === 'function',
    trackCalls: (window.__botwowTrackCalls || 0),
    h1Count: document.querySelectorAll('h1').length,
    h1Text: h1 ? h1.textContent.replace(/\\s+/g, ' ').trim().slice(0, 70) : null,
    h1Box: box(h1),
    heroBox: box(hero),
    parts,
    navBox,
    heroPad,
    h1Style,
    ctaBox: box(cta),
    ctaAll,
    overflow,
    offenders,
    scrollHeight: document.body.scrollHeight,
  });
})()`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const exe = await chromePath();
  const port = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'botwow-audit-'));
  const proc = spawn(exe, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--hide-scrollbars', '--force-device-scale-factor=1',
    'about:blank',
  ], { stdio: 'ignore' });

  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { await fetch(`http://127.0.0.1:${port}/json/version`); ready = true; break; }
    catch { await sleep(250); }
  }
  if (!ready) { proc.kill(); throw new Error('navigateur indisponible'); }

  const report = [];
  try {
    for (const vp of VIEWPORTS) {
      const r = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
      const target = await r.json();
      const ws = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((res, rej) => {
        ws.addEventListener('open', res, { once: true });
        ws.addEventListener('error', rej, { once: true });
      });
      const cdp = new Cdp(ws);
      const errors = [];
      const failed = [];
      const badResponses = [];
      cdp.on((msg) => {
        if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
          errors.push(msg.params.type + ': ' + msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ').slice(0, 160));
        }
        if (msg.method === 'Runtime.exceptionThrown') {
          errors.push('exception: ' + (msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || '').slice(0, 160));
        }
        if (msg.method === 'Network.loadingFailed') {
          failed.push(msg.params.errorText + ' ' + (msg.params.type || ''));
        }
        if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) {
          badResponses.push(msg.params.response.status + ' ' + msg.params.response.url.slice(0, 110));
        }
      });

      await cdp.send('Network.enable');
      await cdp.send('Page.enable');
      await cdp.send('Runtime.enable');
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.w < 700,
      });

      await cdp.send('Page.navigate', { url: TARGET });
      await sleep(2600);
      const probe = await cdp.send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
      const data = JSON.parse(probe.result.value);

      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const file = path.join(OUT, `${LABEL}-${vp.w}x${vp.h}.png`);
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));

      const ctaTop = data.ctaBox ? data.ctaBox.top : null;
      const inFold = ctaTop !== null && ctaTop < vp.h;
      report.push({
        vp: `${vp.w}x${vp.h}`, ...data, ctaTop, inFold,
        errors, failed, badResponses, shot: file,
      });

      console.log(`\n--- ${vp.w}x${vp.h} ---`);
      console.log(`  h1 (${data.h1Count}) : ${data.h1Text}`);
      console.log(`  collecte presente : ${data.hasTrack ? 'OUI' : 'NON'}`);
      console.log(`  h1 top=${data.h1Box ? data.h1Box.top : '-'} height=${data.h1Box ? data.h1Box.height : '-'}`);
      console.log(`  h1 style : ${data.h1Style ? `font=${data.h1Style.fontSize} line=${data.h1Style.lineHeight} lignes=${data.h1Style.lines} largeur=${data.h1Style.width}` : '-'}`);
      console.log(`  hero height=${data.heroBox ? data.heroBox.height : '-'} padding-top=${data.heroPad} nav=${data.navBox ? data.navBox.height : '-'}`);
      for (const [k, v] of Object.entries(data.parts || {})) {
        console.log(`    ${k.padEnd(16)} top=${String(v.top).padStart(5)} h=${String(v.height).padStart(4)} bottom=${v.bottom}`);
      }
      console.log(`  CTA principal top=${ctaTop} -> ${inFold ? 'DANS l ecran' : 'HORS ecran'} (viewport ${vp.h})`);
      for (const c of data.ctaAll) console.log(`    - ${c.id} top=${c.top} bottom=${c.bottom}`);
      console.log(`  debordement horizontal : ${data.overflow}px ${data.offenders.length ? '-> ' + data.offenders.join(' | ') : ''}`);
      console.log(`  scroll total=${data.scrollHeight}px`);
      if (errors.length) console.log(`  erreurs console (${errors.length}) : ${errors.slice(0, 4).join(' | ')}`);
      if (failed.length) console.log(`  requetes echouees (${failed.length}) : ${failed.slice(0, 4).join(' | ')}`);
      if (badResponses.length) console.log(`  reponses >= 400 (${badResponses.length}) : ${badResponses.slice(0, 4).join(' | ')}`);

      ws.close();
    }
  } finally {
    proc.kill();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  fs.writeFileSync(path.join(OUT, `${LABEL}-report.json`), JSON.stringify(report, null, 2));
  console.log(`\ncaptures : ${OUT} (${LABEL}-*.png)`);
  const blocked = report.filter((r) => !r.inFold);
  if (blocked.length) {
    console.log(`\nCTA hors ecran sur ${blocked.length} viewport(s) : ${blocked.map((r) => r.vp).join(', ')}`);
  }
}

main().catch((e) => { console.error('ECHEC :', e.message); process.exit(1); });
