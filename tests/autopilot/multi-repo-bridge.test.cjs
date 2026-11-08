#!/usr/bin/env node
/**
 * multi-repo-bridge.test.cjs — tests déterministes (sans réseau, sans écriture
 * hors mémoire) du bridge multi-dépôt de BOT-WOW.
 *
 * PORT depuis `aveca/sargagame` (PR #1349, merge commit
 * `87702066a79c03ff930500a2bad524df58c1f6f7`), fichier
 * `scripts/autopilot/multi-repo-bridge.test.cjs`.
 *
 * Adaptation BOT-WOW : les RÔLES sont inversés. Dans Sargagame, `LOCAL` était
 * `aveca/sargagame` ; dans BOT-WOW, `LOCAL` est `aveca/bot-wow` et `OTHER` est
 * `aveca/sargagame`. Les assertions portent donc sur ce qui compte ici :
 * une mission Sargagame n'est JAMAIS enfilée dans la queue BOT-WOW.
 *
 * Aucun appel `gh` réel : l'exécutable est injecté. Aucune écriture disque :
 * la queue, la sauvegarde, les fiches d'opportunité ET la création des dossiers
 * de mémoire sont injectées — les tests ne laissent aucun dossier `.ai/` dans
 * le dépôt.
 *
 * Couvre :
 *   1. requiredContract : contrat complet / incomplet / mission historique
 *   2. isAllowedRepo : allowlist stricte (exactement les deux dépôts)
 *   3. fingerprint : déterministe, qualifié par le dépôt, clé historique
 *   4. isAlreadyKnown : idempotence sur clé canonique, clé historique et id
 *   5. toOpportunity : dépôt hors allowlist, dépôt déclaré incohérent, mission
 *      historique (champ `id` seul) acceptée, humanGate => human
 *   6. ingestMultiRepo : routage strict, aucun statut distant, human non
 *      enfilé, dry-run sans écriture, statuts locaux corrélés
 *   7. detectLocalRepo : override d'environnement, remote hors allowlist et
 *      origin absent rejetés, fallback uniquement hors checkout Git
 *   8. parseArgs
 *   9. aucune écriture sur le disque pendant toute la suite
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const os = require('os');

const bridge = require('../../scripts/autopilot/multi-repo-bridge.cjs');

/** Racine du dépôt BOT-WOW (ce fichier : tests/autopilot/… → ../../..). */
const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** État du dossier de mémoire AVANT la suite (peut déjà exister après un import réel). */
const AI_DIR = path.join(REPO_ROOT, '.ai');
const aiBefore = fs.existsSync(AI_DIR);
const aiEntriesBefore = aiBefore ? fs.readdirSync(AI_DIR).sort().join(',') : '';

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log('  ok   ' + name);
  else {
    failures += 1;
    console.log('  FAIL ' + name + ' ' + detail);
  }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Dépôt local de ce checkout : BOT-WOW. */
const LOCAL = 'aveca/bot-wow';
/** Dépôt distant autorisé : Sargagame (ses missions restent chez lui). */
const OTHER = 'aveca/sargagame';

function taskBlock(overrides = {}) {
  return {
    id: 'T-1',
    task_id: 'T-1',
    title: 'Tâche de test',
    mode: 'agent',
    source: 'chatgpt',
    priority: 'high',
    confidence: 'observed',
    evidence: 'preuve',
    rollback: 'revert du commit',
    humanGate: false,
    moneyPath: false,
    acceptance: 'critères ok',
    repository_full_name: LOCAL,
    issue_number: 1336,
    filesToRead: [],
    filesToModify: ['README.md'],
    ...overrides,
  };
}

function issue(number, task, repo = LOCAL) {
  const body = 'AUTOPILOT_TASK\n```json\n' + JSON.stringify(task, null, 2) + '\n```';
  return {
    number,
    url: `https://github.com/${repo}/issues/${number}`,
    title: '[AUTOPILOT] test',
    body,
    createdAt: '2026-11-06T00:00:00Z',
  };
}

// ── 1. requiredContract ──────────────────────────────────────────────────────

console.log('=== 1. requiredContract ===');
{
  const c1 = bridge.requiredContract(taskBlock());
  check('contrat complet valide', c1.ok === true, JSON.stringify(c1.missing));
  check('contrat complet non legacy', c1.legacy === false);

  const c2 = bridge.requiredContract({ id: 'T-2', title: 'X', mode: 'agent' });
  check('contrat incomplet détecté', c2.ok === false);
  check('champs manquants listés', c2.missing.includes('task_id') && c2.missing.includes('priority'));
  check('contrat incomplet marqué legacy', c2.legacy === true);
}

// ── 2. isAllowedRepo ─────────────────────────────────────────────────────────

console.log('=== 2. isAllowedRepo ===');
{
  check('aveca/bot-wow autorisé', bridge.isAllowedRepo(OTHER) === true);
  check('aveca/sargagame autorisé', bridge.isAllowedRepo(LOCAL) === true);
  check('dépôt inconnu rejeté', bridge.isAllowedRepo('aveca/autre-repo') === false);
  check('chaîne vide rejetée', bridge.isAllowedRepo('') === false);
  check('dépôt hors allowlist rejeté', bridge.isAllowedRepo('aveca/sargagame-privé') === false);
  check(
    'allowlist fermée : exactement les deux dépôts autorisés',
    Array.isArray(bridge.ALLOWED_REPOS)
    && bridge.ALLOWED_REPOS.length === 2
    && bridge.ALLOWED_REPOS.includes('aveca/bot-wow')
    && bridge.ALLOWED_REPOS.includes('aveca/sargagame'),
    JSON.stringify(bridge.ALLOWED_REPOS),
  );
  check(
    'repli du dépôt local = BOT-WOW (jamais Sargagame)',
    bridge.DEFAULT_LOCAL_REPO === 'aveca/bot-wow',
    String(bridge.DEFAULT_LOCAL_REPO),
  );
}

// ── 3. fingerprint ───────────────────────────────────────────────────────────

console.log('=== 3. fingerprint ===');
{
  const f1 = bridge.fingerprint(OTHER, 1336, 'T-1');
  const f2 = bridge.fingerprint(OTHER, 1336, 'T-1');
  const f3 = bridge.fingerprint(LOCAL, 1336, 'T-1');
  const f4 = bridge.fingerprint(OTHER, 1337, 'T-1');
  check('déterministe', f1 === f2);
  check('qualifié par le dépôt', f1 !== f3);
  check('intègre le numéro d\'issue', f1 !== f4);
  check('format canonique', f1 === 'chatgpt-issue|aveca/sargagame|1336|T-1');
  check(
    'clé historique sans dépôt',
    bridge.legacyFingerprint(1336, 'T-1') === 'chatgpt-issue|1336|T-1',
  );
}

// ── 4. isAlreadyKnown (idempotence) ──────────────────────────────────────────

console.log('=== 4. isAlreadyKnown ===');
{
  const known = bridge.buildKnownIndex({
    opportunities: [
      // importée par bridge.cjs : clé historique + id
      { id: 'T-OLD', fingerprint: 'chatgpt-issue|1336|T-OLD' },
      // importée par le bridge multi-dépôt : clé canonique
      { id: 'T-NEW', fingerprint: 'chatgpt-issue|aveca/sargagame|1400|T-NEW' },
    ],
  });
  check('clé historique reconnue', bridge.isAlreadyKnown(known, LOCAL, 1336, 'T-OLD') === true);
  check('clé canonique reconnue', bridge.isAlreadyKnown(known, LOCAL, 1400, 'T-NEW') === true);
  check('id seul reconnu (dédup bridge.cjs)', bridge.isAlreadyKnown(known, LOCAL, 9999, 'T-OLD') === true);
  check('tâche inconnue non reconnue', bridge.isAlreadyKnown(known, LOCAL, 1336, 'T-FRESH') === false);
  check(
    'même task_id dans un AUTRE dépôt reste distinct (clé qualifiée par dépôt)',
    bridge.isAlreadyKnown(bridge.buildKnownIndex({ opportunities: [] }), OTHER, 1, 'T-X') === false,
  );
  // Cas où SEULE la clé d'empreinte permet de reconnaître la tâche : l'entrée
  // en queue porte une clé historique mais un id différent de celui que la
  // mission déclare aujourd'hui.
  {
    const k2 = bridge.buildKnownIndex({
      opportunities: [{ id: 'T-DIFFERENT', fingerprint: 'chatgpt-issue|1336|T-SHARED' }],
    });
    check(
      'clé historique reconnue malgré un id différent',
      bridge.isAlreadyKnown(k2, LOCAL, 1336, 'T-SHARED') === true,
    );
    check(
      'id différent seul ne suffit pas à reconnaître la tâche',
      bridge.isAlreadyKnown(k2, LOCAL, 1336, 'T-AUTRE') === false,
    );
  }
}

// ── 5. toOpportunity ─────────────────────────────────────────────────────────

console.log('=== 5. toOpportunity ===');
{
  const iss = issue(1336, taskBlock());

  const o1 = bridge.toOpportunity(taskBlock(), iss, 'aveca/inconnu');
  check('dépôt inconnu rejeté', o1.rejected === true, JSON.stringify(o1.reason));

  const o2 = bridge.toOpportunity(taskBlock({ repository_full_name: OTHER }), iss, LOCAL);
  check('dépôt déclaré incohérent rejeté', o2.rejected === true, JSON.stringify(o2.reason));

  const o3 = bridge.toOpportunity(taskBlock(), iss, LOCAL);
  check('contrat valide accepté', o3.rejected === undefined && o3.status === 'new');
  check('repository_full_name renseigné', o3.repository_full_name === LOCAL);
  check('issue_number renseigné', o3.issue_number === 1336);
  check('actionable agent (pas humanGate)', o3.actionable === 'agent');
  check('clé canonique', o3.fingerprint === 'chatgpt-issue|aveca/bot-wow|1336|T-1');
  check('clé historique conservée', o3.legacyFingerprint === 'chatgpt-issue|1336|T-1');
  check('acceptance présente', o3.acceptance === 'critères ok');
  check('rollback présent', o3.rollback === 'revert du commit');

  // Mission au format historique (champ `id` seul) : acceptée, écart signalé.
  const legacyTask = {
    id: 'SARG-PAGES-CODE-ONLY-RELEASE-20261106',
    source: 'chatgpt',
    priority: 'critical',
    mode: 'agent',
    humanGate: false,
    moneyPath: false,
    title: 'Mission historique',
    diagnostic: 'diag',
    acceptance: 'ok',
    rollback: 'revert',
  };
  const o4 = bridge.toOpportunity(legacyTask, issue(1336, legacyTask), LOCAL);
  check('mission historique (id seul) acceptée', o4.rejected === undefined, JSON.stringify(o4.reason));
  check('id de tâche déduit de `id`', o4.id === 'SARG-PAGES-CODE-ONLY-RELEASE-20261106');
  check('écart de contrat signalé', o4.contract.ok === false && o4.contract.missing.includes('task_id'));

  const o5 = bridge.toOpportunity(taskBlock({ humanGate: true }), iss, LOCAL);
  check('humanGate => actionable human', o5.actionable === 'human');
}

// ── 6. ingestMultiRepo ───────────────────────────────────────────────────────

console.log('=== 6. ingestMultiRepo ===');
{
  // 6a. Routage strict : une mission Sargagame n'est PAS enfilée chez BOT-WOW.
  {
    const queue = { opportunities: [] };
    const saved = [];
    const written = [];
    const statuses = [];
    let ensureDirsCalls = 0;

    const localTask = taskBlock({ id: 'T-LOCAL', task_id: 'T-LOCAL', issue_number: 2000, repository_full_name: LOCAL });
    const remoteTask = taskBlock({ id: 'T-REMOTE', task_id: 'T-REMOTE', issue_number: 125, repository_full_name: OTHER });

    const result = bridge.ingestMultiRepo({
      dry: false,
      log: () => {},
      localRepo: LOCAL,
      queue,
      saveQueue: (q) => saved.push(q),
      writeOpportunityFile: (o) => written.push(o.id),
      ensureDirs: () => { ensureDirsCalls += 1; },
      publishStatus: (repo, issueNumber, status, details, opts) => {
        statuses.push({ repo, issueNumber, status, taskId: opts && opts.taskId });
        return true;
      },
      loadIssues: (repo) =>
        repo === LOCAL ? [issue(2000, localTask)] : [issue(125, remoteTask, OTHER)],
    });

    check('dépôt local détecté', result.localRepo === LOCAL);
    check('dossiers de mémoire créés une seule fois (mode réel)', ensureDirsCalls === 1, String(ensureDirsCalls));
    check('mission locale importée', result.imported === 1, JSON.stringify(result.perRepo));
    check('mission distante RELAYÉE', result.relayed === 1, JSON.stringify(result.perRepo));
    check('mission distante absente de la queue locale', queue.opportunities.length === 1);
    check('seule la mission locale est enfilée', queue.opportunities[0].id === 'T-LOCAL');
    check('fiche d\'opportunité écrite pour la mission locale', written.join(',') === 'T-LOCAL');
    check('queue sauvegardée une fois', saved.length === 1);
    check(
      'statut publié uniquement sur l\'issue locale BOT-WOW',
      statuses.some((s) => s.repo === LOCAL && s.issueNumber === 2000 && s.status === 'imported')
      && !statuses.some((s) => s.repo === OTHER),
      JSON.stringify(statuses),
    );
    check(
      'statut corrélé au task ID',
      statuses.every((s) => s.taskId === 'T-LOCAL' || s.taskId === 'T-REMOTE'),
      JSON.stringify(statuses),
    );
    check('mission relayée listée', result.relayedTasks.length === 1 && result.relayedTasks[0].repo === OTHER);
    check(
      'tâches importées listées',
      result.importedTasks.length === 1
      && result.importedTasks[0].taskId === 'T-LOCAL'
      && result.importedTasks[0].repo === LOCAL,
      JSON.stringify(result.importedTasks),
    );
    check(
      'tâches annoncées en dry-run distinguées des appliquées',
      result.wouldImportTasks.length === 1 && result.importedTasks.length === 1,
      JSON.stringify(result.wouldImportTasks),
    );
  }

  // 6b. Idempotence : un second passage n'importe rien.
  {
    const queue = { opportunities: [] };
    const t = taskBlock({ id: 'T-IDEM', task_id: 'T-IDEM', issue_number: 3000 });
    const issues = { [LOCAL]: [issue(3000, t)], [OTHER]: [] };
    const opts = {
      dry: false,
      log: () => {},
      localRepo: LOCAL,
      queue,
      saveQueue: () => {},
      writeOpportunityFile: () => {},
      ensureDirs: () => {},
      publishStatus: () => true,
      loadIssues: (repo) => issues[repo] || [],
    };
    const first = bridge.ingestMultiRepo(opts);
    const second = bridge.ingestMultiRepo(opts);
    check('1er passage importe', first.imported === 1);
    check('2e passage importe 0', second.imported === 0, JSON.stringify(second.perRepo));
    check('2e passage ignore la tâche connue', second.ignored === 1);
    check('une seule entrée en queue', queue.opportunities.length === 1);
  }

  // 6c. Une tâche déjà importée par bridge.cjs (clé historique) n'est pas réimportée.
  {
    const queue = {
      opportunities: [{ id: 'T-LEGACY', fingerprint: 'chatgpt-issue|4000|T-LEGACY' }],
    };
    const t = taskBlock({ id: 'T-LEGACY', task_id: 'T-LEGACY', issue_number: 4000 });
    const result = bridge.ingestMultiRepo({
      dry: false,
      log: () => {},
      localRepo: LOCAL,
      queue,
      saveQueue: () => {},
      writeOpportunityFile: () => {},
      ensureDirs: () => {},
      publishStatus: () => true,
      loadIssues: (repo) => (repo === LOCAL ? [issue(4000, t)] : []),
    });
    check('tâche bridge.cjs non réimportée', result.imported === 0, JSON.stringify(result.perRepo));
    check('tâche bridge.cjs comptée ignorée', result.ignored === 1);
    check('queue inchangée', queue.opportunities.length === 1);
  }

  // 6d. Une tâche humanGate n'est jamais enfilée pour exécution.
  {
    const queue = { opportunities: [] };
    const statuses = [];
    const t = taskBlock({ id: 'T-HG', task_id: 'T-HG', issue_number: 5000, humanGate: true });
    const result = bridge.ingestMultiRepo({
      dry: false,
      log: () => {},
      localRepo: LOCAL,
      queue,
      saveQueue: () => {},
      writeOpportunityFile: () => {},
      ensureDirs: () => {},
      publishStatus: (repo, issueNumber, status) => {
        statuses.push(status);
        return true;
      },
      loadIssues: (repo) => (repo === LOCAL ? [issue(5000, t)] : []),
    });
    check('humanGate non importée', result.imported === 0);
    check('humanGate comptée ignorée', result.ignored === 1);
    check('humanGate absente de la queue', queue.opportunities.length === 0);
    check('statut blocked publié', statuses.includes('blocked'));
  }

  // 6e. Dry-run : aucune écriture, aucun statut, aucun import persisté.
  {
    const queue = { opportunities: [] };
    let saveCalled = 0;
    let writeCalled = 0;
    let statusCalled = 0;
    let ensureDirsCalls = 0;
    const t = taskBlock({ id: 'T-DRY', task_id: 'T-DRY', issue_number: 6000 });
    const result = bridge.ingestMultiRepo({
      dry: true,
      log: () => {},
      localRepo: LOCAL,
      queue,
      saveQueue: () => { saveCalled += 1; },
      writeOpportunityFile: () => { writeCalled += 1; },
      ensureDirs: () => { ensureDirsCalls += 1; },
      publishStatus: () => { statusCalled += 1; return true; },
      loadIssues: (repo) => (repo === LOCAL ? [issue(6000, t)] : []),
    });
    check('dry-run : aucun import appliqué', result.imported === 0);
    check('dry-run : import annoncé sans être appliqué', result.wouldImport === 1);
    check('dry-run : aucune tâche appliquée', result.importedTasks.length === 0);
    check('dry-run : tâche annoncée listée', result.wouldImportTasks.length === 1);
    check('dry-run : queue non sauvegardée', saveCalled === 0);
    check('dry-run : aucune fiche écrite', writeCalled === 0);
    check('dry-run : aucun statut publié', statusCalled === 0);
    check('dry-run : aucun dossier créé', ensureDirsCalls === 0, String(ensureDirsCalls));
    check('dry-run : queue inchangée', queue.opportunities.length === 0);
  }

  // 6f. Échec de publication d'un statut : il est compté, pas avalé.
  {
    const queue = { opportunities: [] };
    const t = taskBlock({ id: 'T-FAIL', task_id: 'T-FAIL', issue_number: 7000 });
    const result = bridge.ingestMultiRepo({
      dry: false,
      log: () => {},
      localRepo: LOCAL,
      queue,
      saveQueue: () => {},
      writeOpportunityFile: () => {},
      ensureDirs: () => {},
      publishStatus: () => false,
      loadIssues: (repo) => (repo === LOCAL ? [issue(7000, t)] : []),
    });
    check('échec de publication compté', result.statusFailures === 1, JSON.stringify(result));
    check('la tâche reste importée', result.imported === 1);
  }

  // 6h. Dépôt distant TOUJOURS en lecture seule, même si un appelant tente
  //     explicitement de réactiver la publication historique. Deux passages
  //     successifs ne produisent aucun commentaire/statut distant.
  {
    const queue = { opportunities: [] };
    const statuses = [];
    const localTask = taskBlock({ id: 'T-LOCAL-RO', task_id: 'T-LOCAL-RO', issue_number: 8000, repository_full_name: LOCAL });
    const remoteTask = taskBlock({ id: 'T-REMOTE-RO', task_id: 'T-REMOTE-RO', issue_number: 8001, repository_full_name: OTHER });
    const options = {
      dry: false,
      log: () => {},
      localRepo: LOCAL,
      queue,
      saveQueue: () => {},
      writeOpportunityFile: () => {},
      ensureDirs: () => {},
      relayStatus: true,
      publishStatus: (repo, issueNumber, status) => {
        statuses.push({ repo, issueNumber, status });
        return true;
      },
      loadIssues: (repo) =>
        repo === LOCAL ? [issue(8000, localTask)] : [issue(8001, remoteTask, OTHER)],
    };
    const first = bridge.ingestMultiRepo(options);
    const second = bridge.ingestMultiRepo(options);
    check('lecture seule : mission distante relayée au 1er passage', first.relayed === 1, JSON.stringify(first.perRepo));
    check('lecture seule : mission distante relayée au 2e passage', second.relayed === 1, JSON.stringify(second.perRepo));
    check('lecture seule : mission distante jamais enfilée', queue.opportunities.length === 1);
    check('lecture seule : aucun statut publié sur le dépôt distant', !statuses.some((s) => s.repo === OTHER), JSON.stringify(statuses));
    check('lecture seule : statut local publié une seule fois', statuses.filter((s) => s.repo === LOCAL && s.issueNumber === 8000).length === 1, JSON.stringify(statuses));
    check('lecture seule : aucun échec de publication compté', first.statusFailures === 0 && second.statusFailures === 0);
}

  // La fonction publique de statut refuse elle-même tout dépôt distant.
  {
    let ghCalls = 0;
    let remoteWriteRejected = false;
    try {
      bridge.publishStatus(OTHER, 8100, 'started', 'test', {
        gh: () => { ghCalls += 1; return ''; },
      });
    } catch (e) {
      remoteWriteRejected = /publication distante interdite/.test(e.message);
    }
    check('publishStatus bloque un dépôt distant avant tout appel gh', remoteWriteRejected && ghCalls === 0);
  }

}

// ── 7. detectLocalRepo (variable d'environnement, remote, repli) ────────────

console.log('=== 7. detectLocalRepo ===');
{
  const previous = process.env.AUTOPILOT_LOCAL_REPO;
  try {
    process.env.AUTOPILOT_LOCAL_REPO = LOCAL;
    check('override BOT-WOW respecté hors checkout Git', bridge.detectLocalRepo(os.tmpdir(), { isGitWorktree: () => false }) === LOCAL);

    process.env.AUTOPILOT_LOCAL_REPO = OTHER;
    let sargagameOverrideRejected = false;
    try { bridge.detectLocalRepo(os.tmpdir(), { isGitWorktree: () => false }); } catch (e) {
      sargagameOverrideRejected = /doit désigner BOT-WOW/.test(e.message);
    }
    check('override Sargagame rejeté dans le bridge BOT-WOW', sargagameOverrideRejected);

    process.env.AUTOPILOT_LOCAL_REPO = 'aveca/pas-autorise';
    let invalidEnvRejected = false;
    try { bridge.detectLocalRepo(os.tmpdir(), { isGitWorktree: () => false }); } catch (e) {
      invalidEnvRejected = /hors allowlist/.test(e.message);
    }
    check('override hors allowlist rejeté explicitement', invalidEnvRejected);

    process.env.AUTOPILOT_LOCAL_REPO = LOCAL;
    let mismatchRejected = false;
    try {
      bridge.detectLocalRepo(REPO_ROOT, {
        isGitWorktree: () => true,
        getOrigin: () => 'https://github.com/aveca/sargagame.git',
      });
    } catch (e) {
      mismatchRejected = /ne correspond pas au checkout BOT-WOW/.test(e.message);
    }
    check('override BOT-WOW ne peut pas masquer un origin Sargagame', mismatchRejected);

    delete process.env.AUTOPILOT_LOCAL_REPO;

    const fallbackRepo = bridge.detectLocalRepo(os.tmpdir(), { isGitWorktree: () => false });
    check('fallback BOT-WOW uniquement hors checkout Git', fallbackRepo === LOCAL, String(fallbackRepo));

    const allowedHttps = bridge.detectLocalRepo(REPO_ROOT, {
      isGitWorktree: () => true,
      getOrigin: () => 'https://github.com/aveca/bot-wow.git',
    });
    check('remote HTTPS BOT-WOW reconnu', allowedHttps === LOCAL, allowedHttps);

    let sargagameOriginRejected = false;
    try {
      bridge.detectLocalRepo(REPO_ROOT, {
        isGitWorktree: () => true,
        getOrigin: () => 'git@github.com:aveca/sargagame.git',
      });
    } catch (e) {
      sargagameOriginRejected = /ne correspond pas au checkout BOT-WOW/.test(e.message);
    }
    check('remote Sargagame ne peut pas être le checkout local BOT-WOW', sargagameOriginRejected);

    let thirdPartyRejected = false;
    try {
      bridge.detectLocalRepo(REPO_ROOT, {
        isGitWorktree: () => true,
        getOrigin: () => 'https://github.com/third-party/other-repo.git',
      });
    } catch (e) {
      thirdPartyRejected = /hors allowlist/.test(e.message);
    }
    check('remote GitHub tiers rejeté sans fallback', thirdPartyRejected);

    let missingOriginRejected = false;
    try {
      bridge.detectLocalRepo(REPO_ROOT, {
        isGitWorktree: () => true,
        getOrigin: () => { throw new Error('origin missing'); },
      });
    } catch (e) {
      missingOriginRejected = /remote origin illisible/.test(e.message);
    }
    check('origin illisible dans un checkout Git rejeté', missingOriginRejected);

    let nonGithubRejected = false;
    try {
      bridge.detectLocalRepo(REPO_ROOT, {
        isGitWorktree: () => true,
        getOrigin: () => 'https://gitlab.com/aveca/bot-wow.git',
      });
    } catch (e) {
      nonGithubRejected = /hôte remote origin non autorisé/.test(e.message);
    }
    check('hôte distant hors GitHub rejeté', nonGithubRejected);

    let wrongLocalRepoRejected = false;
    try {
      bridge.ingestMultiRepo({
        localRepo: OTHER,
        dry: true,
        loadIssues: () => [],
        queue: { opportunities: [] },
      });
    } catch (e) {
      wrongLocalRepoRejected = /ne peut tourner que dans/.test(e.message);
    }
    check('ingestMultiRepo refuse un checkout local Sargagame', wrongLocalRepoRejected);
  } finally {
    if (previous === undefined) delete process.env.AUTOPILOT_LOCAL_REPO;
    else process.env.AUTOPILOT_LOCAL_REPO = previous;
  }
}
// ── 8. parseArgs ─────────────────────────────────────────────────────────────

console.log('=== 8. parseArgs ===');
{
  const a = bridge.parseArgs(['--status', 'started', '--repo', LOCAL, '--issue', '1337', '--task', 'T-1']);
  check('option avec valeur', a.status === 'started' && a.repo === LOCAL && a.issue === '1337');
  check('option sans valeur', bridge.parseArgs(['--dry']).dry === true);
  check('forme --clé=valeur', bridge.parseArgs(['--relay-status=false'])['relay-status'] === 'false');
  check('relayStatus distant désactivé par défaut', bridge.resolveRelayStatus({}) === false);
  check('relayStatus reste désactivé par --relay-status=false', bridge.resolveRelayStatus({ 'relay-status': 'false' }) === false);
  check('relayStatus reste désactivé par --relay-status 0', bridge.resolveRelayStatus({ 'relay-status': '0' }) === false);
  check('relayStatus ne peut pas être réactivé par CLI', bridge.resolveRelayStatus({ 'relay-status': 'true' }) === false);
}

// ── 9. Aucune écriture sur le disque pendant la suite ───────────────────────

console.log('=== 9. aucune écriture sur le disque ===');
{
  const aiNow = fs.existsSync(AI_DIR);
  const aiEntriesNow = aiNow ? fs.readdirSync(AI_DIR).sort().join(',') : '';
  check(
    'état du dossier de mémoire inchangé',
    aiNow === aiBefore && aiEntriesNow === aiEntriesBefore,
    `avant=${aiBefore ? aiEntriesBefore : '(absent)'} après=${aiNow ? aiEntriesNow : '(absent)'}`,
  );
}

console.log('');
if (failures === 0) {
  console.log('MULTI-REPO-BRIDGE TESTS : OK (' + failures + ' échec)');
  process.exit(0);
} else {
  console.log('MULTI-REPO-BRIDGE TESTS : ' + failures + ' ÉCHEC(S)');
  process.exit(1);
}
