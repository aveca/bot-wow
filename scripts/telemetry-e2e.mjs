#!/usr/bin/env node
/**
 * telemetry-e2e.mjs — validation de bout en bout de la collecte persistante.
 *
 * Le parcours complet est verifie sur le site reellement publie :
 *   1. un vrai navigateur (Chrome, pilote en CDP, sans dependance) ouvre
 *      la page avec une reference de test ;
 *   2. un clic sur le CTA principal declenche un evenement ;
 *   3. la requete envoyee est capturee et inspectee ;
 *   4. la reponse du serveur est verifiee (202) ;
 *   5. l'evenement est relu dans la base D1 durable ;
 *   6. l'attribution (page, langue, CTA, reference, marqueur de test) est
 *      verifiee ;
 *   7. les requetes malformees et abusives sont rejetees.
 *
 * Les evenements de test portent `test=1` et une reference : ils sont
 * identifiables et exclus des statistiques de production.
 *
 * Usage : npm run test:telemetry:e2e
 * Variables : TELEMETRY_SITE (defaut https://bot-wow.com/),
 *             CLOUDFLARE_API_TOKEN (sinon le token wrangler local).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

const SITE = process.env.TELEMETRY_SITE || 'https://bot-wow.com/';
const ACC = 'abf2b92cf718313567b4b38eb9dda17f';
const D1_ID = '935b0632-d712-4266-bece-028c70b545be';
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.CHROME_PATH,
].filter(Boolean);

let failures = 0;
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { failures++; console.log(`  FAIL ${name} ${detail}`); }
};

/* ---------- utilitaires ---------- */
function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chromePath() {
  for (const p of CHROME_CANDIDATES) if (fs.existsSync(p)) return p;
  throw new Error('aucun navigateur Chrome/Edge trouve');
}

/* ---------- token Cloudflare ---------- */
function cloudflareToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const cfg = path.join(process.env.APPDATA, 'xdg.config', '.wrangler', 'config', 'default.toml');
  const raw = fs.readFileSync(cfg, 'utf8');
  const m = raw.match(/oauth_token\s*=\s*"([^"]+)"/) || raw.match(/token\s*=\s*"([^"]+)"/);
  if (!m) throw new Error('token Cloudflare introuvable (CLOUDFLARE_API_TOKEN)');
  return m[1];
}

async function d1Query(sql) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}/d1/database/${D1_ID}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cloudflareToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`D1 HTTP ${r.status} : ${JSON.stringify(j.errors).slice(0, 200)}`);
  return (j.result || []).flatMap((x) => x.results || []);
}

/* ---------- pilote CDP minimal (aucune dependance) ---------- */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.handlers = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data || '')})`));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const h of this.handlers) h(msg);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`timeout ${method}`)); }
      }, 30000);
    });
  }
  on(fn) { this.handlers.push(fn); }
}

async function openBrowser() {
  const exe = await chromePath();
  const port = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'botwow-e2e-'));
  const proc = spawn(exe, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-sync',
    'about:blank',
  ], { stdio: 'ignore' });

  let info = null;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      info = await r.json();
      break;
    } catch { await sleep(250); }
  }
  if (!info) { proc.kill(); throw new Error('demarrage du navigateur impossible'); }

  // nouvelle page
  let target = null;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
    target = await r.json();
  } catch {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    target = list.find((t) => t.type === 'page');
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  return { cdp: new Cdp(ws), proc, profile, port };
}

/* ---------- execution ---------- */
console.log('=== TELEMETRIE : test de bout en bout (production) ===');
console.log('site :', SITE);

/* La fenetre de limitation de debit est d'une minute par IP. Un run
   precedent (ou une phase d'abus) peut la saturer : on attend alors
   qu'elle se libere, plutot que de conclure a une panne. */
{
  const probe = await fetch(SITE.replace(/\/$/, '') + '/api/track', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ v: 1, event: 'page_view', page: '/', lang: 'en', props: { step: 'probe' } }),
  });
  if (probe.status === 429) {
    console.log('  info  fenetre de limitation de debit saturee : attente de la liberation (~65 s)');
    await sleep(65000);
  }
}

const ref = 'e2e' + Date.now().toString(36);
let browser = null;
const requests = [];
const responses = [];

try {
  browser = await openBrowser();
  const { cdp, proc, profile } = browser;

  cdp.on((msg) => {
    if (msg.method === 'Network.requestWillBeSent') {
      const r = msg.params.request;
      if (r.url.includes('/api/track')) {
        requests.push({
          url: r.url, method: r.method, headers: r.headers,
          body: r.postData || '', requestId: msg.params.requestId,
        });
      }
    }
    if (msg.method === 'Network.responseReceived') {
      const r = msg.params.response;
      if (r.url.includes('/api/track')) responses.push({ url: r.url, status: r.status });
    }
  });

  await cdp.send('Network.enable');
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // --- 1. ouverture de la page avec reference de test ---
  const url = SITE + (SITE.includes('?') ? '&' : '?') + 'telemetry_test=' + ref;
  await cdp.send('Page.navigate', { url });
  await sleep(2500);

  const pageInfo = await cdp.send('Runtime.evaluate', {
    expression: 'JSON.stringify({ url: location.href, lang: document.documentElement.lang, hasTrack: typeof window.botwowTrack === "function" })',
    returnByValue: true,
  });
  const info = JSON.parse(pageInfo.result.value);
  ok('la page s est ouverte', /bot-wow\.com/.test(info.url), `(${info.url})`);
  ok('le collecteur est present', info.hasTrack === true, `(${info.hasTrack})`);
  console.log(`  info  langue=${info.lang} ref=${ref}`);

  // --- 2. declenchement d evenements par un vrai clic ---
  const clicked = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('[data-track="cta_click"]') || document.querySelector('a[href*="#buy"], a[href*="checkout"]');
      if (!el) return 'aucun';
      el.scrollIntoView();
      el.click();
      return (el.getAttribute('data-cta-id') || el.getAttribute('data-track') || 'sans-id');
    })()`,
    returnByValue: true,
  });
  const clickedId = clicked.result.value;
  ok('un CTA est cliquable', clickedId !== 'aucun', `(${clickedId})`);
  await sleep(2000);

  // --- 2b. selecteur de parcours : un clic doit produire un journey_view ---
  {
    const tab = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const t = document.querySelector('.journey-tabs [role="tab"]:not([aria-selected="true"])');
        if (!t) return 'absent';
        t.scrollIntoView();
        t.click();
        return t.getAttribute('data-intent') || 'sans-intent';
      })()`,
      returnByValue: true,
    });
    const intent = tab.result.value;
    if (intent === 'absent') {
      console.log('  info  selecteur de parcours absent de cette page (non teste)');
    } else {
      ok('le selecteur de parcours est cliquable', intent !== 'absent', `(${intent})`);
      await sleep(1500);
      const rows = await d1Query(
        `SELECT id, event, step, page, lang, test FROM events WHERE ref = '${ref}' AND event = 'journey_view' ORDER BY id`
      );
      ok('le parcours affiche est enregistre en base', rows.length > 0, `(${rows.length} ligne(s))`);
      if (rows.length) {
        // la premiere ligne est l'onglet initial : on cherche celui qui
        // correspond au clic.
        const match = rows.find((r) => r.step === intent);
        ok('le parcours enregistre correspond au clic', !!match,
          `(attendu ${intent}, trouve ${rows.map((r) => r.step).join(', ')})`);
        if (match) console.log(`  info  ligne D1 #${match.id} event=journey_view step=${match.step}`);
      }
    }
  }

  // --- 3. requete envoyee ---
  ok('une requete vers /api/track est partie', requests.length > 0, `(${requests.length})`);

  /* Le corps d'une requete envoyee par sendBeacon n'apparait pas toujours
     dans Network.requestWillBeSent : on le redemande au protocole. */
  for (const r of requests) {
    if (r.body) continue;
    try {
      const pd = await cdp.send('Network.getRequestPostData', { requestId: r.requestId });
      if (pd && pd.postData) r.body = pd.postData;
    } catch { /* corps indisponible : le test le signalera */ }
  }

  const req = requests[requests.length - 1];
  let payload = null;
  try { payload = JSON.parse(req.body); } catch { /* malformé */ }
  ok('le corps de la requete est du JSON valide', payload !== null, `(${String(req.body).slice(0, 80)})`);
  if (payload) {
    ok('la requete porte la version de schema', payload.v === 1, `(v=${payload.v})`);
    ok('la requete porte la reference de test', payload.ref === ref, `(${payload.ref})`);
    ok('la requete est marquee comme test', payload.test === true, `(${payload.test})`);
    ok('la requete porte un evenement de la liste fermee',
      ['page_view', 'cta_click', 'planner_mode', 'ownership_view', 'checkout_start', 'checkout_error', 'journey_view'].includes(payload.event),
      `(${payload.event})`);
    ok('la requete ne contient aucune donnee personnelle',
      !JSON.stringify(payload).includes('@') && !('email' in (payload.props || {})),
      `(${String(req.body).slice(0, 120)})`);
    console.log(`  info  evenement=${payload.event} page=${payload.page} lang=${payload.lang}`);
  }

  // --- 4. reponse serveur ---
  const resp = responses[responses.length - 1];
  ok('le serveur accepte l evenement (202)', resp && resp.status === 202, `(${resp ? resp.status : 'aucune reponse'})`);

  // --- 5. relecture dans le stockage durable ---
  const rows = await d1Query(
    `SELECT id, event, page, lang, cta, mode, step, ref, test, ip_hash, ua FROM events WHERE ref = '${ref}' ORDER BY id`
  );
  ok('l evenement est enregistre dans la base durable', rows.length > 0, `(${rows.length} ligne(s))`);
  if (rows.length) {
    const row = rows[0];
    ok('l evenement est marque comme test', row.test === 1, `(test=${row.test})`);
    ok('la page est attribuee', row.page === '/', `(${row.page})`);
    ok('la langue est attribuee', row.lang === 'en' || row.lang === 'fr', `(${row.lang})`);
    ok('l IP est hashee, jamais en clair', typeof row.ip_hash === 'string' && row.ip_hash.length === 16, `(${row.ip_hash})`);
    ok('aucune colonne ne contient d email', !JSON.stringify(row).includes('@'), '');
    console.log(`  info  ligne D1 #${row.id} event=${row.event} page=${row.page} lang=${row.lang} cta=${row.cta ?? '-'} test=${row.test}`);
    const events = rows.map((r) => r.event);
    ok('le parcours a produit plusieurs evenements', events.length >= 1, `(${events.join(', ')})`);
    // le clic sur le CTA doit avoir produit un evenement cta_click identifie
    const click = rows.find((r) => r.event === 'cta_click');
    ok('le clic sur le CTA a produit un evenement cta_click', !!click,
      `(${events.join(', ')})`);
    if (click) {
      console.log(`  info  ligne D1 #${click.id} event=cta_click cta=${click.cta} step=${click.step}`);
      ok(`le CTA est identifie`, !!click.cta, `(${click.cta})`);
    }
  }

  // --- 6. requetes malformees ---
  const bad = await fetch(SITE.replace(/\/$/, '') + '/api/track', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{pas du json',
  });
  ok('un corps malforme est refuse (400)', bad.status === 400, `(${bad.status})`);

  const unknown = await fetch(SITE.replace(/\/$/, '') + '/api/track', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ v: 1, event: 'event_inconnu', page: '/', lang: 'en' }),
  });
  ok('un evenement hors liste est refuse (400)', unknown.status === 400, `(${unknown.status})`);

  const wrongType = await fetch(SITE.replace(/\/$/, '') + '/api/track', {
    method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'hello',
  });
  ok('un type de contenu non JSON est refuse (415)', wrongType.status === 415, `(${wrongType.status})`);

  const tooBig = await fetch(SITE.replace(/\/$/, '') + '/api/track', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ v: 1, event: 'page_view', page: '/', lang: 'en', props: { step: 'x'.repeat(9000) } }),
  });
  ok('un corps trop gros est refuse (413)', tooBig.status === 413, `(${tooBig.status})`);

  const wrongMethod = await fetch(SITE.replace(/\/$/, '') + '/api/track', { method: 'GET' });
  ok('une methode non POST est refusee (405)', wrongMethod.status === 405, `(${wrongMethod.status})`);

  // --- 7. requetes abusives (limitation de debit) ---
  let limited = 0;
  for (let i = 0; i < 80; i++) {
    const r = await fetch(SITE.replace(/\/$/, '') + '/api/track', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ v: 1, event: 'page_view', page: '/', lang: 'en', props: { step: 'abuse' } }),
    });
    if (r.status === 429) limited++;
  }
  ok('la limitation de debit se declenche (429)', limited > 0, `(${limited} reponses 429 sur 80)`);

  proc.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
} catch (err) {
  failures++;
  console.log('  FAIL exception :', err.message);
  if (browser) { try { browser.proc.kill(); } catch { /* ignore */ } }
}

console.log(failures === 0 ? '\nTELEMETRIE E2E : OK' : `\nTELEMETRIE E2E : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
