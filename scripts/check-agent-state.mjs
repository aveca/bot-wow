#!/usr/bin/env node
/**
 * Verifie l'etat partage des agents et, en CI de pull request, qu'un verrou
 * actif ne duplique pas le scope d'une autre PR ouverte.
 *
 * Hors CI (CHECK_OPEN_PR_LOCKS different de 1), seul le depot local est lu.
 * Aucun secret n'est affiche.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIRS, FILES } from './build-site.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

const REQUIRED = [
  'PROJECT_STATE.md',
  'agents/README.md',
  'agents/tasks.md',
  'agents/blockers.md',
  'agents/decisions.md',
  'agents/deployments.md',
  'agents/test-results.md',
  'agents/locks.md',
];

for (const rel of REQUIRED) {
  if (!fs.existsSync(path.join(ROOT, rel))) failures.push(`fichier manquant : ${rel}`);
}

if (FILES.includes('PROJECT_STATE.md') || FILES.includes('agents/README.md')) {
  failures.push('PROJECT_STATE ou agents/README est dans la liste publiee');
}
if (DIRS.includes('agents') || DIRS.includes('reports')) {
  failures.push('un repertoire interne est publie par build-site');
}

const STATE_MARKERS = [
  '## Verite courante',
  '## Achat ferme',
  '## Routes API',
  '## Livraison sandbox',
  '## Prochaine action',
];
const statePath = path.join(ROOT, 'PROJECT_STATE.md');
if (fs.existsSync(statePath)) {
  const state = fs.readFileSync(statePath, 'utf8');
  for (const marker of STATE_MARKERS) {
    if (!state.includes(marker)) failures.push(`PROJECT_STATE.md sans ${marker}`);
  }
  if (/sk_live_|sk_test_|re_[A-Za-z0-9]{10,}|MOLLIE_API_KEY\s*[:=]\s*['"][^'"]+/.test(state)) {
    failures.push('PROJECT_STATE.md contient un motif de secret');
  }
}

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function parseLocks(markdown, label) {
  const rows = [];
  const lines = markdown.split(/\r?\n/).filter((line) => line.trim().startsWith('|'));
  if (lines.length < 2) {
    failures.push(`${label} : table de verrous absente`);
    return rows;
  }
  const header = splitRow(lines[0]);
  const expected = ['id', 'scope', 'agent', 'branch', 'status', 'expires', 'result'];
  if (expected.some((name, i) => header[i] !== name)) {
    failures.push(`${label} : en-tete attendu ${expected.join(' | ')}`);
    return rows;
  }
  for (const line of lines.slice(1)) {
    if (/^\|\s*-+/.test(line.trim())) continue;
    const cells = splitRow(line);
    if (cells.length < expected.length) {
      failures.push(`${label} : ligne incomplete`);
      continue;
    }
    const row = Object.fromEntries(expected.map((name, i) => [name, cells[i]]));
    if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(row.id)) failures.push(`${label} : id invalide ${row.id}`);
    if (!['active', 'done', 'released'].includes(row.status)) {
      failures.push(`${label} : statut invalide ${row.status}`);
    }
    if (Number.isNaN(Date.parse(row.expires))) failures.push(`${label} : expiration illisible ${row.expires}`);
    row.scopes = row.scope.split(',').map((s) => s.trim()).filter(Boolean);
    if (row.scopes.length === 0) failures.push(`${label} : scope vide pour ${row.id}`);
    rows.push(row);
  }
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.id)) failures.push(`${label} : id duplique ${row.id}`);
    seen.add(row.id);
  }
  const active = new Map();
  for (const row of rows.filter((r) => r.status === 'active')) {
    for (const scope of row.scopes) {
      if (active.has(scope)) {
        failures.push(`${label} : scope actif en double ${scope} (${active.get(scope)} et ${row.id})`);
      }
      active.set(scope, row.id);
    }
  }
  return rows;
}

const locksPath = path.join(ROOT, 'agents', 'locks.md');
const localLocks = fs.existsSync(locksPath)
  ? parseLocks(fs.readFileSync(locksPath, 'utf8'), 'agents/locks.md')
  : [];

if (process.env.CHECK_OPEN_PR_LOCKS === '1') {
  const repo = process.env.GITHUB_REPOSITORY || 'aveca/bot-wow';
  const ownBranch = process.env.GITHUB_HEAD_REF || '';
  let prs = [];
  try {
    const raw = execFileSync('gh', [
      'pr', 'list', '--repo', repo, '--state', 'open', '--limit', '80',
      '--json', 'number,headRefName,url',
    ], { encoding: 'utf8' });
    prs = JSON.parse(raw);
  } catch (error) {
    failures.push(`lecture des PR ouvertes impossible : ${error.message}`);
    prs = [];
  }
  const localActive = new Map();
  for (const row of localLocks.filter((r) => r.status === 'active')) {
    for (const scope of row.scopes) localActive.set(scope, row.id);
  }
  for (const pr of prs) {
    if (ownBranch && pr.headRefName === ownBranch) continue;
    let remote = '';
    try {
      remote = execFileSync('gh', [
        'api', '-H', 'Accept: application/vnd.github.raw',
        `/repos/${repo}/contents/agents/locks.md?ref=${encodeURIComponent(pr.headRefName)}`,
      ], { encoding: 'utf8' });
    } catch {
      continue;
    }
    const remoteRows = parseLocks(remote, `PR #${pr.number}`);
    for (const row of remoteRows.filter((r) => r.status === 'active')) {
      for (const scope of row.scopes) {
        if (localActive.has(scope)) {
          failures.push(`scope actif deja pris : ${scope} (${localActive.get(scope)} et PR #${pr.number} ${row.id})`);
        }
      }
    }
  }
}

if (failures.length) {
  console.error('AGENT STATE : ECHEC');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}
console.log('AGENT STATE : OK');
