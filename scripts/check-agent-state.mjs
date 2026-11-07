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
import {
  classifyRemoteFetchError,
  findScopeConflicts,
  parseLockTable,
  summarizeRemoteFetchError,
} from './agent-lock-gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
/** Instantane unique : toutes les comparaisons d'expiration utilisent ce `now`. */
const NOW = Date.now();

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

/**
 * Parse la table des verrous et reporte ses problemes dans `failures`.
 * La lecture elle-meme est pure et testee dans `tests/agent-state-locks.test.mjs`.
 */
function parseLocks(markdown, label) {
  const { rows, problems } = parseLockTable(markdown, label, NOW);
  for (const problem of problems) failures.push(problem);
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
  for (const pr of prs) {
    if (ownBranch && pr.headRefName === ownBranch) continue;
    // Lecture de `agents/locks.md` sur la branche de la PR.
    //   - 404         : le fichier n'existe pas sur cette branche => ABSENCE.
    //                    La PR est ignoree pour cette comparaison (ce n'est
    //                    ni une erreur, ni une preuve de conflit).
    //   - autre erreur : elle reste VISIBLE. Elle ne doit jamais etre
    //                    transformee en succes silencieux.
    let remote = '';
    try {
      remote = execFileSync('gh', [
        'api', '-H', 'Accept: application/vnd.github.raw',
        `/repos/${repo}/contents/agents/locks.md?ref=${encodeURIComponent(pr.headRefName)}`,
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      if (classifyRemoteFetchError(error) === 'absent') continue;
      failures.push(
        `lecture de agents/locks.md impossible pour PR #${pr.number} : ${summarizeRemoteFetchError(error)}`,
      );
      continue;
    }
    const remoteRows = parseLocks(remote, `PR #${pr.number}`);
    // Un verrou distant de MEME identite (id + agent + branch) est un verrou
    // herite du meme base commit : pas un conflit. Un autre verrou actif et
    // non expire sur le meme scope reste un conflit reel.
    for (const conflict of findScopeConflicts({
      localRows: localLocks,
      remoteRows,
      prNumber: pr.number,
      now: NOW,
    })) {
      failures.push(conflict.message);
    }
  }
}

if (failures.length) {
  console.error('AGENT STATE : ECHEC');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}
console.log('AGENT STATE : OK');
