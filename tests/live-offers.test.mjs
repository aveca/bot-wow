#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLANNER = 'https://buy.stripe.com/4gM4gB62W4749MO78C63K01';
const STUDIO = 'https://buy.stripe.com/eVqdRb8b4dHE6AC50u63K02';
const BUY = ['buy.html', 'fr/buy.html', 'es/buy.html'];
const SKIP = new Set(['node_modules', '.git', '_site', 'artifacts', 'backups', 'tests', 'reports']);

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log('  ok   ' + name);
  else { failures += 1; console.log('  FAIL ' + name + (detail ? ' ' + detail : '')); }
};

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

for (const file of BUY) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  check(file + ' : lien LIVE Planner', html.includes(PLANNER));
  check(file + ' : lien LIVE Studio', html.includes(STUDIO));
  check(file + ' : ancre #planner', /id="planner"/.test(html));
  check(file + ' : ancre #studio', /id="studio"/.test(html));
  check(file + ' : pas de mailto de liste d’attente', !/subject=BOT-WOW%20(liste|waitlist|offers)/i.test(html));
}

for (const full of walk(ROOT)) {
  const rel = path.relative(ROOT, full);
  const html = fs.readFileSync(full, 'utf8');
  const flat = html.toLowerCase();
  check(rel + ' : pas de « no paid offer »', !flat.includes('no paid offer'));
  check(rel + ' : pas de « waitlist »', !flat.includes('waitlist'));
}

console.log(failures ? `\nOFFRES LIVE : ${failures} ECHEC(S)` : '\nOFFRES LIVE : OK');
process.exit(failures ? 1 : 0);
