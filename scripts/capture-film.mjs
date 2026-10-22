#!/usr/bin/env node
/**
 * capture-film.mjs — production d'un court film du produit REEL.
 *
 * Ce que fait le script :
 *   1. ouvre la demonstration navigateur (le VRAI planificateur, la VRAIE
 *      carte simulee) dans Chrome ;
 *   2. joue une sequence : changement de mode, selection d'un banc ;
 *   3. capture l'ecran frame par frame via le protocole CDP ;
 *   4. monte les frames en video (ffmpeg) et sort :
 *        - assets/media/demo-film.mp4   (h264, compatible partout)
 *        - assets/media/demo-film.webm  (vp9, plus leger)
 *        - assets/media/demo-film-poster.jpg (image de couverture)
 *
 * HONNETETE : la video montre la demonstration du site sur une carte
 * SIMULEE (le site l'annonce lui-meme). Elle n'invente aucune session de
 * production : c'est l'enregistrement de la vraie demo, jouée dans le
 * vrai code.
 *
 * Usage : node scripts/capture-film.mjs [url] [sortie]
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

const URL_TARGET = process.argv[2] || 'http://127.0.0.1:8099/demo.html';
const OUT_DIR = path.resolve(process.argv[3] || 'assets/media');
const W = 1000, H = 620;           // format du film
const FPS = 25;
const SECONDS = 7;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[film]', ...a);

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

/* ------------------------------------------------------------------ CDP */
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
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)); } }, 30000);
    });
  }
  on(fn) { this.handlers.push(fn); }
}

async function main() {
  const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const port = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'botwow-film-'));
  const proc = spawn(chrome, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--hide-scrollbars', '--force-device-scale-factor=1', '--autoplay-policy=no-user-gesture-required',
    '--window-size=' + W + ',' + H, 'about:blank',
  ], { stdio: 'ignore' });

  let info = null;
  for (let i = 0; i < 60; i++) {
    try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; }
    catch { await sleep(250); }
  }
  if (!info) { proc.kill(); throw new Error('navigateur indisponible'); }

  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  const cdp = new Cdp(ws);

  const framesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botwow-frames-'));
  let frameNo = 0;
  let meta = null;
  const stamps = [];
  cdp.on((msg) => {
    if (msg.method === 'Page.screencastFrame') {
      meta = meta || msg.params.metadata;
      if (meta && typeof meta.timestamp === 'number') stamps.push(meta.timestamp);
      fs.writeFileSync(path.join(framesDir, `f${String(frameNo++).padStart(4, '0')}.jpg`), Buffer.from(msg.params.data, 'base64'));
      cdp.send('Page.screencastFrameAck', { sessionId: msg.params.sessionId }).catch(() => {});
    }
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

  log('ouverture de', URL_TARGET);
  await cdp.send('Page.navigate', { url: URL_TARGET });
  await sleep(2600); // laisse la carte se charger

  /* Chrome ne produit des frames que lors des REPEINTS. La demo est
     immobile : on allume un balayage lumineux sur la carte pendant la
     prise, pour que le compositeur produise une image continue. */
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const s = document.createElement('style');
      s.textContent = '@keyframes film-sweep{0%{opacity:.6}50%{opacity:1}100%{opacity:.6}}'
        + '#oasis{animation:film-sweep 2.2s ease-in-out infinite}'
        + '.map,#map{filter:brightness(1.04)}';
      document.head.appendChild(s);
      return true;
    })()`,
  });
  await sleep(400);

  /* Cadrage : l'instrument (carte + parametres + mesures), pas le titre.
     C'est la partie qui montre le produit. */
  await cdp.send('Runtime.evaluate', {
    expression: `(() => { const g = document.querySelector('.grid-demo');
      if (g) window.scrollTo({ top: g.getBoundingClientRect().top + window.scrollY - 12, behavior: 'instant' });
      return true; })()`,
  });
  await sleep(900);

  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 82, everyNthFrame: 1 });

  // --- la sequence reelle de la demo ---
  const clickSel = async (sel) => {
    await cdp.send('Runtime.evaluate', {
      expression: `(() => { const el = document.querySelector(${JSON.stringify(sel)});
        if (!el) return false; el.scrollIntoView({block:'center'}); el.click(); return true; })()`,
    });
  };
  await sleep(1400);
  await clickSel('#mode');                      // le select de mode
  await cdp.send('Runtime.evaluate', {
    expression: `(() => { const s=document.getElementById('mode'); if(!s) return;
      s.value='exploration'; s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`,
  });
  await sleep(1800);
  await cdp.send('Runtime.evaluate', {
    expression: `(() => { const s=document.getElementById('mode'); if(!s) return;
      s.value='prudent'; s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`,
  });
  await sleep(1800);
  await clickSel('#oasis circle, #oasis g[data-spot], #oasis [data-id]');
  await sleep(1600);

  await cdp.send('Page.stopScreencast');
  await sleep(400);
  proc.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }

  const frames = fs.readdirSync(framesDir).filter((f) => f.endsWith('.jpg')).sort();
  if (frames.length < 10) throw new Error('capture vide (' + frames.length + ' frames)');

  /* Le screencast de Chrome ne cadence PAS a 25 fps : on mesure le debit
     reel a partir des horodatages, sinon la video jouerait trop vite. */
  let realFps = FPS;
  if (stamps.length > 4) {
    const span = stamps[stamps.length - 1] - stamps[0];
    if (span > 0.2) realFps = Math.min(30, Math.max(4, (stamps.length - 1) / span));
  }
  log('frames captures :', frames.length, '| debit reel :', realFps.toFixed(1), 'fps');

  /* ------------------------- montage ffmpeg ------------------------- */
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const mp4 = path.join(OUT_DIR, 'demo-film.mp4');
  const webm = path.join(OUT_DIR, 'demo-film.webm');
  const poster = path.join(OUT_DIR, 'demo-film-poster.jpg');

  const common = ['-y', '-framerate', realFps.toFixed(3), '-i', path.join(framesDir, 'f%04d.jpg'),
    '-t', '9', '-vf', `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:-1:-1:color=0x0a0c12,fps=25`];

  execFileSync('ffmpeg', ['-loglevel', 'error', ...common,
    '-c:v', 'libx264', '-profile:v', 'high', '-crf', '32', '-preset', 'slow',
    '-movflags', '+faststart', '-pix_fmt', 'yuv420p', mp4], { stdio: 'inherit' });
  log('mp4 :', (fs.statSync(mp4).size / 1024).toFixed(0), 'Ko');

  execFileSync('ffmpeg', ['-loglevel', 'error', ...common,
    '-c:v', 'libvpx-vp9', '-crf', '44', '-b:v', '0', '-row-mt', '1', '-pix_fmt', 'yuv420p', webm],
    { stdio: 'inherit' });
  log('webm :', (fs.statSync(webm).size / 1024).toFixed(0), 'Ko');

  // La couverture : une image pleine, prise a un moment stable du film.
  const posterFrame = frames[Math.min(frames.length - 1, Math.floor(frames.length * 0.62))];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(framesDir, posterFrame),
    '-vf', `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:-1:-1:color=0x0a0c12`,
    '-q:v', '4', poster], { stdio: 'inherit' });
  log('poster :', (fs.statSync(poster).size / 1024).toFixed(0), 'Ko');

  try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch { /* ignore */ }
  log('sortie :', OUT_DIR);
}

main().catch((e) => { console.error('[film] ECHEC :', e.message); process.exit(1); });
