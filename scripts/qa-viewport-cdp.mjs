#!/usr/bin/env node
/**
 * qa-viewport-cdp.mjs — captures de QA a des tailles de viewport exactes,
 * via Chrome DevTools Protocol (CDP).
 *
 * POURQUOI
 * --------
 * Les outils navigateur de l'environnement sont figes sur une fenetre de
 * taille fixe : impossible de verifier le rendu a 1440x900 (desktop) ni
 * 390x844 (mobile) avec eux seuls. Chrome tourne avec
 * `--remote-debugging-port=9222` : on pilote donc directement CDP, dont
 * `Emulation.setDeviceMetricsOverride` est la seule facon d'imposer une
 * taille de viewport exacte sans dependance externe.
 *
 * Sortie :
 *   .qa-captures/<viewport>/<route>.png      capture d'ecran
 *   .qa-captures/<viewport>/<route>.json     releve (console, reseau, mesures)
 *
 * Usage : node scripts/qa-viewport-cdp.mjs [urlDeBase]
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

const ROUTES = [
  { path: '/', scrollY: 0 },
  { path: '/', scrollY: 1423, label: 'section-demo' },
  { path: '/', scrollY: 4812, label: 'section-roles' },
  { path: '/', scrollY: 6402, label: 'section-compare' },
  { path: '/', scrollY: 8070, label: 'section-prix' },
  { path: '/', scrollY: 11185, label: 'section-final' },
  { path: '/fr/', scrollY: 0 },
  { path: '/fr/', scrollY: 8070, label: 'section-prix' },
  { path: '/demo.html', scrollY: 0 },
  { path: '/fr/demo.html', scrollY: 0 },
  { path: '/compare.html', scrollY: 0 },
  { path: '/faq.html', scrollY: 0 },
];
const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900, mobile: false },
  { name: 'mobile-390x844', width: 390, height: 844, mobile: true },
];

mkdirSync(OUT, { recursive: true });

/* --------------------------------------------------------------- client CDP */
function connectCDP(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    const events = [];
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: res, reject: rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message));
        else res(msg.result);
      } else if (msg.method) {
        events.push(msg);
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
      events,
      close: () => ws.close(),
    });
  });
}

async function openTab(url) {
  const res = await fetch(CDP + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  if (!res.ok) throw new Error(`CDP /json/new -> ${res.status}`);
  return res.json();
}

async function closeTab(targetId) {
  await fetch(CDP + '/json/close/' + targetId).catch(() => {});
}

/**
 * Audite une route a une taille de viewport donnee.
 * `route` est soit un chemin (string), soit { path, scrollY, label } pour
 * capturer une section precise de la page.
 * Retourne { png, report } et ecrit les deux fichiers.
 */
async function audit(route, vp) {
  const path = typeof route === 'string' ? route : route.path;
  const url = BASE + path;
  const scrollY = typeof route === 'string' ? 0 : (route.scrollY || 0);
  const routeLabel = typeof route === 'string' ? null : (route.label || null);
  const target = await openTab(url);
  const cdp = await connectCDP(target.webSocketDebuggerUrl);

  try {
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    await cdp.send('Log.enable');

    // Taille de viewport EXACTE (desktop ou mobile)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.mobile,
      screenWidth: vp.width,
      screenHeight: vp.height,
    });

    // Recharger apres l'override pour que la mise en page se recalcule
    await cdp.send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 2000));

    // Positionner la vue sur la section demandee (apres le rechargement)
    if (scrollY > 0) {
      await cdp.send('Runtime.evaluate', {
        expression: `window.scrollTo(0, ${scrollY}); window.scrollY`,
        returnByValue: true,
      });
      await new Promise((r) => setTimeout(r, 600));
    }

    /* --- erreurs console ------------------------------------------------ */
    const consoleErrors = [];
    for (const ev of cdp.events) {
      if (ev.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(ev.params.type)) {
        consoleErrors.push({ type: ev.params.type, text: (ev.params.args || []).map((a) => a.value || a.description || '').join(' ') });
      }
      if (ev.method === 'Runtime.exceptionThrown') {
        consoleErrors.push({ type: 'exception', text: String(ev.params.exceptionDetails?.text || '') + ' — ' + String(ev.params.exceptionDetails?.exception?.description || '').slice(0, 160) });
      }
      if (ev.method === 'Log.entryAdded' && ['error', 'warning'].includes(ev.params.entry.level)) {
        consoleErrors.push({ type: ev.params.entry.level, text: String(ev.params.entry.text || '').slice(0, 200) });
      }
    }

    /* --- erreurs reseau ------------------------------------------------ */
    const networkErrors = [];
    for (const ev of cdp.events) {
      if (ev.method === 'Network.loadingFailed') {
        networkErrors.push({ url: String(ev.params.request?.url || ''), error: ev.params.errorText, type: ev.params.type });
      }
      if (ev.method === 'Network.responseReceived') {
        const st = ev.params.response?.status;
        if (st >= 400) networkErrors.push({ url: String(ev.params.response?.url || ''), status: st });
      }
    }

    /* --- mesures de mise en page -------------------------------------- */
    const measure = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const q = (s) => document.querySelector(s);
        const rect = (el) => el ? (r => ({ top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }))(el.getBoundingClientRect()) : null;
        const hero = q('.hero') || q('section');
        // Le CTA de conversion mesure : bouton de paiement du formulaire
        // (#buyBtn) et, a defaut, le CTA hero (#buy). On mesure le PREMIER
        // dans l'ordre du document, pas le dernier.
        const cta = q('#buyBtn') || q('[data-cta-id="hero-offer"]') || q('[data-cta-id="final-buy"]') || q('.wl button');
        return JSON.stringify({
          viewport: { w: innerWidth, h: innerHeight },
          scrollHeight: document.documentElement.scrollHeight,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
            ? { scrollWidth: document.documentElement.scrollWidth, innerWidth } : null,
          heroRect: rect(hero),
          heroHeight: hero ? Math.round(hero.getBoundingClientRect().height) : null,
          heroCtaRect: rect(hero ? hero.querySelector('[data-cta-id]') : null),
          heroCtaInFirstScreen: (hero && hero.querySelector('[data-cta-id]'))
            ? hero.querySelector('[data-cta-id]').getBoundingClientRect().bottom <= innerHeight : null,
          ctaRect: rect(cta),
          ctaInFirstScreen: cta ? cta.getBoundingClientRect().bottom <= innerHeight : null,
          buyFormVisible: (() => { const f = q('#buyForm'); if (!f) return null; const r = f.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })(),
          emailForm: !!q('input[type="email"]'),
          priceText: (document.body.innerText.match(/20[.,]00\\s*€?|20\\s*€/) || [null])[0],
          oldWaitlistMessage: /Payment not available|waitlist/i.test(document.body.innerText),
          imagesWithoutAlt: [...document.images].filter(i => !i.alt).length,
          lang: document.documentElement.lang,
          title: document.title,
          actionBar: (() => {
            const b = document.querySelector('.mbar');
            if (!b) return null;
            const cs = getComputedStyle(b);
            const r = b.getBoundingClientRect();
            return { display: cs.display, opacity: cs.opacity, hasIsOn: b.classList.contains('is-on'), bottom: Math.round(r.bottom), inViewport: r.top < innerHeight && r.bottom > 0 };
          })(),
        });
      })()`,
      returnByValue: true,
    });
    const metrics = JSON.parse(measure.result.value);

    /* --- capture ------------------------------------------------------- */
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const png = Buffer.from(shot.data, 'base64');

    const report = { route: path, label: routeLabel, scrollY, viewport: vp.name, url, metrics, consoleErrors, networkErrors, pngBytes: png.length };
    return { png, report };
  } finally {
    cdp.close();
    await closeTab(target.id);
  }
}

/* --------------------------------------------------- instance Chrome dediee */
async function startChrome() {
  mkdirSync(PROFILE, { recursive: true });
  const child = spawn(CHROME, [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--noerrdialogs',
    '--disable-gpu',
    `--remote-debugging-port=${new URL(CDP).port}`,
    `--user-data-dir=${PROFILE}`,
    'about:blank',
  ], { stdio: 'ignore', detached: false });

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 300));
    try {
      const res = await fetch(CDP + '/json/version');
      if (res.ok) return child;
    } catch { /* pas encore pret */ }
  }
  throw new Error('Chrome CDP na pas demarre sur le port ' + CDP);
}

console.log('Demarrage de Chrome headless dedie (port CDP ' + new URL(CDP).port + ')...');
const chrome = await startChrome();

/* ------------------------------------------------------------------- boucle */
let failed = 0;
for (const vp of VIEWPORTS) {

  const dir = join(OUT, vp.name);
  mkdirSync(dir, { recursive: true });
  for (const route of ROUTES) {
    try {
      const { png, report } = await audit(route, vp);
      const routeKey = (typeof route === 'string' ? route : route.path).replace(/\//g, '_').replace(/^_|_$/g, '') || 'index';
      const fileBase = report.label ? routeKey + '--' + report.label : routeKey;
      writeFileSync(join(dir, fileBase + '.png'), png);
      writeFileSync(join(dir, fileBase + '.json'), JSON.stringify(report, null, 2));      const flags = [];
      if (report.metrics.horizontalOverflow) flags.push('OVERFLOW-' + report.metrics.horizontalOverflow.scrollWidth);
      if (report.metrics.heroCtaInFirstScreen === false) flags.push('CTA-HERO-HORS-ECRAN');
      if (report.consoleErrors.length) flags.push('CONSOLE:' + report.consoleErrors.length);
      if (report.networkErrors.length) flags.push('RESEAU:' + report.networkErrors.length);
      if (report.metrics.oldWaitlistMessage) flags.push('ANCIEN-MESSAGE-WAITLIST');
      console.log(`  ${vp.name.padEnd(18)} ${fileBase.padEnd(28)} hero=${report.metrics.heroHeight}px ctaHero=${report.metrics.heroCtaInFirstScreen} ${flags.join(' ')}`);
      if (report.metrics.horizontalOverflow) failed++;
    } catch (e) {
      failed++;
      console.log(`  ${vp.name.padEnd(18)} ${String(typeof route === 'string' ? route : route.path).padEnd(28)} ECHEC ${e.message}`);
    }
  }
}

console.log('');
console.log(failed === 0 ? `QA VIEWPORTS : OK (${VIEWPORTS.length * ROUTES.length} captures dans .qa-captures/)` : `QA VIEWPORTS : ${failed} ECHEC(S)`);
try { chrome.kill(); } catch { /* deja arrete */ }
process.exit(failed === 0 ? 0 : 1);
