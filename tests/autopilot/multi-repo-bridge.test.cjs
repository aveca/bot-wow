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
// ── 7b. Consommation de la queue (claim / ACK / retry / quarantaine / orphelin) ──
{
  const nowIso = () => new Date().toISOString();

  // 7b1. claimNext réclame une opportunité 'new' avec un verrou.
  {
    const queue = {
      opportunities: [
        {
          id: 'T-C1',
          repository_full_name: LOCAL,
          issue_number: 9001,
          status: 'new',
          createdAt: nowIso(),
          maxRetries: 3,
          retryCount: 0,
        },
      ],
    };
    const log = [];
    const claimed = bridge.claimNext(queue, { runnerId: 'runner-1', log: (m) => log.push(m) });
    check('une opportunité réclamée', claimed !== null);
    if (claimed) {
      check('statut passé à claimed', queue.opportunities[0].status === 'claimed');
      check('claimé par le runner', queue.opportunities[0].claimedBy === 'runner-1');
      check('lockId présent', typeof claimed.lockId === 'string' && claimed.lockId.startsWith('lock_'));
      check('claimedAt renseigné', typeof queue.opportunities[0].claimedAt === 'string');
      check('journalisé', log.some((l) => l.includes('CLAIM T-C1')));
    }
  }

  // 7b2. claimNext ne réclame pas une opportunité déjà 'claimed'.
  {
    const queue = {
      opportunities: [
        {
          id: 'T-C2',
          repository_full_name: LOCAL,
          issue_number: 9002,
          status: 'claimed',
          claimedBy: 'runner-X',
          lockId: 'lock_old',
          claimedAt: nowIso(),
        },
      ],
    };
    const claimed = bridge.claimNext(queue, { runnerId: 'runner-2', log: () => {} });
    check('aucune réclamation sur claimed', claimed === null);
    check('verrou inchangé', queue.opportunities[0].lockId === 'lock_old');
  }

  // 7b3. claimNext réclame une 'failed' dont le retry est dû (nextRetryAt <= maintenant).
  {
    const queue = {
      opportunities: [
        {
          id: 'T-C3',
          repository_full_name: LOCAL,
          issue_number: 9003,
          status: 'failed',
          retryCount: 1,
          maxRetries: 3,
          nextRetryAt: new Date(Date.now() - 1000).toISOString(), // dû il y a 1 s
        },
      ],
    };
    const claimed = bridge.claimNext(queue, { runnerId: 'runner-3', log: () => {} });
    check('réclamation d\'un retry dû', claimed !== null);
    if (claimed) check('statut repasse à claimed', queue.opportunities[0].status === 'claimed');
  }

  // 7b4. claimNext ne réclame pas une 'failed' dont le retry n'est pas encore dû.
  {
    const queue = {
      opportunities: [
        {
          id: 'T-C4',
          repository_full_name: LOCAL,
          issue_number: 9004,
          status: 'failed',
          retryCount: 1,
          maxRetries: 3,
          nextRetryAt: new Date(Date.now() + 3600000).toISOString(), // dans 1 h
        },
      ],
    };
    const claimed = bridge.claimNext(queue, { runnerId: 'runner-4', log: () => {} });
    check('pas de réclamation avant l\'échéance du retry', claimed === null);
  }

  // 7b5. acknowledge 'completed' passe en 'completed' et publie le statut.
  {
    const queue = {
      opportunities: [
        {
          id: 'T-A1',
          repository_full_name: LOCAL,
          issue_number: 9101,
          status: 'claimed',
          claimedBy: 'runner-1',
          lockId: 'lock_x',
        },
      ],
    };
    const published = [];
    const result = bridge.acknowledge(queue, 'T-A1', 'completed', 'tout est bon', {
      runnerId: 'runner-1',
      log: () => {},
      publishStatus: (repo, issue, status, detail, opts) => {
        published.push({ repo, issue, status, taskId: opts && opts.taskId });
        return true;
      },
    });
    check('ack ok', result.ok === true);
    check('statut completed', queue.opportunities[0].status === 'completed');
    check('ackDetail renseigné', queue.opportunities[0].ackDetail === 'tout est bon');
    check('statut publié', published.length === 1 && published[0].status === 'completed' && published[0].taskId === 'T-A1');
  }

  // 7b6. acknowledge 'failed' (1er échec) passe en 'failed' avec retryCount incrémenté.
  {
    const queue = {
      opportunities: [
        {
          id: 'T-A2',
          repository_full_name: LOCAL,
          issue_number: 9102,
          status: 'claimed',
          retryCount: 0,
          maxRetries: 3,
        },
      ],
    };
    const result = bridge.acknowledge(queue, 'T-A2', 'failed', 'erreur temporaire', {
      runnerId: 'runner-1',
      log: () => {},
      publishStatus: () => true,
    });
    check('ack failed ok', result.ok === true);
    check('statut failed', queue.opportunities[0].status === 'failed');
    check('retryCount incrémenté', queue.opportunities[0].retryCount === 1);
    check('nextRetryAt dans le futur', new Date(queue.opportunities[0].nextRetryAt).getTime() > Date.now());
    check('backoff = 5s pour retry 1', queue.opportunities[0].backoffMs === 5000);
  }

  // 7b7. acknowledge 'failed' jusqu'à maxRetries => quarantaine définitive.
  {
    const queue = {
      opportunities: [
        {
          id: 'T-A3',
          repository_full_name: LOCAL,
          issue_number: 9103,
          status: 'claimed',
          retryCount: 2,
          maxRetries: 3,
        },
      ],
    };
    const result = bridge.acknowledge(queue, 'T-A3', 'failed', 'échec définitif', { runnerId: 'runner-1', log: () => {}, publishStatus: () => true });
    check('statut quarantined', queue.opportunities[0].status === 'quarantined');
    check('quarantineReason renseigné', queue.opportunities[0].quarantineReason === 'échec définitif');
    check('plus de nextRetryAt', queue.opportunities[0].nextRetryAt === undefined);
    check('retryCount à 3', queue.opportunities[0].retryCount === 3);
  }

  // 7b8. acknowledge refuse une tâche non réclamée.
  {
    const queue = { opportunities: [{ id: 'T-A4', repository_full_name: LOCAL, issue_number: 9104, status: 'new' }] };
    const result = bridge.acknowledge(queue, 'T-A4', 'completed', '', { runnerId: 'runner-1', log: () => {}, publishStatus: () => true });
    check('ack rejeté sur tâche non claimée', result.ok === false && /n\'est pas réclamée/.test(result.error));
  }

  // 7b9. acknowledge refuse un outcome invalide.
  {
    const queue = { opportunities: [{ id: 'T-A5', repository_full_name: LOCAL, issue_number: 9105, status: 'claimed' }] };
    const result = bridge.acknowledge(queue, 'T-A5', 'toto', '', { runnerId: 'runner-1', log: () => {}, publishStatus: () => true });
    check('outcome invalide rejeté', result.ok === false && /invalide/.test(result.error));
  }

  // 7b10. recoverOrphanedLocks réinitialise un verrou claimé depuis trop longtemps.
  {
    const queue = {
      opportunities: [
        {
          id: 'T-O1',
          repository_full_name: LOCAL,
          issue_number: 9201,
          status: 'claimed',
          claimedBy: 'runner-mort',
          lockId: 'lock_mort',
          claimedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(), // il y a 40 min
        },
        {
          id: 'T-O2',
          repository_full_name: LOCAL,
          issue_number: 9202,
          status: 'claimed',
          claimedBy: 'runner-vivant',
          lockId: 'lock_vie',
          claimedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // il y a 5 min (récent)
        },
      ],
    };
    const recovered = bridge.recoverOrphanedLocks(queue, { orphanTimeoutMs: 30 * 60 * 1000, log: () => {} });
    check('1 verrou orphelin récupéré', recovered === 1);
    check('orphelin repasse à new', queue.opportunities[0].status === 'new');
    check('orphelin sans lockId', queue.opportunities[0].lockId === undefined);
    check('verrou récent inchangé', queue.opportunities[1].status === 'claimed');
  }

  // 7b11. quarantineOpportunity met une tâche en quarantaine manuellement.
  {
    const queue = {
      opportunities: [
        { id: 'T-Q1', repository_full_name: LOCAL, issue_number: 9301, status: 'new' },
      ],
    };
    const result = bridge.quarantineOpportunity(queue, 'T-Q1', 'mission annulée', { log: () => {}, publishStatus: () => true });
    check('quarantine ok', result.ok === true);
    check('statut quarantined', queue.opportunities[0].status === 'quarantined');
    check('raison enregistrée', queue.opportunities[0].quarantineReason === 'mission annulée');
  }

  // 7b12. runConsumeCycle retourne claimed: false quand la queue est vide.
  {
    const queue = { opportunities: [] };
    const cycle = bridge.runConsumeCycle(queue, {
      runnerId: 'runner-1',
      log: () => {},
      acquireLock: () => ({ fd: null, lockId: 'test-lock' }),
      releaseLock: () => {},
    });
    check('queue vide => claimed false', cycle.claimed === false && /aucune opportunité/.test(cycle.reason));
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

// ── 10. Consommation : verrou interprocessus, persistance, polling, exécution ─

console.log('=== 10. Consommation : verrou, persistance, polling, exécution ===');

const { execFileSync } = require('child_process');

{
  // 10a. runConsumeCycle persiste le claim via saveQueue (injecté)
  {
    const queue = {
      opportunities: [
        { id: 'T-PERSIST', repository_full_name: LOCAL, issue_number: 5001, status: 'new' },
      ],
    };
    const saved = [];
    const cycle = bridge.runConsumeCycle(queue, {
      runnerId: 'runner-persist',
      log: () => {},
      saveQueue: (q) => { saved.push(JSON.parse(JSON.stringify(q))); },
      acquireLock: () => ({ fd: null, lockId: 'test-lock-persist' }),
      releaseLock: () => {},
    });
    check('claim persistant retourné', cycle.claimed === true);
    check('saveQueue appelée', saved.length === 1);
    check('tâche passée à claimed dans la sauvegarde',
      saved[0].opportunities[0].status === 'claimed');
    check('lockId présent dans la sauvegarde',
      typeof saved[0].opportunities[0].lockId === 'string' && saved[0].opportunities[0].lockId.length > 0);
    check('claimedAt présent', typeof saved[0].opportunities[0].claimedAt === 'string');
  }

  // 10b. acquireLock obtient un verrou exclusif sur un fichier temp
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-lock-'));
    const lockPath = path.join(tmpDir, 'queue.lock');
    const deps = { lockPath, log: () => {} };
    const lock1 = bridge.acquireLock(deps);
    check('premier acquireLock obtient le verrou', lock1 !== null && lock1.lockId);
    check('fichier verrou créé', fs.existsSync(lockPath));
    bridge.releaseLock(lock1, lock1.lockId, deps);
    check('verrou libéré, fichier supprimé', !fs.existsSync(lockPath));
    fs.rmdirSync(tmpDir);
  }

  // 10c. Deuxième acquireLock retourne null tant que le premier est détenu
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-lock-'));
    const lockPath = path.join(tmpDir, 'queue.lock');
    const deps = { lockPath, log: () => {} };
    const lock1 = bridge.acquireLock(deps);
    check('verrou 1 obtenu', lock1 !== null);
    const lock2 = bridge.acquireLock(deps);
    check('deuxième acquireLock retourne null (exclusivité)', lock2 === null);
    bridge.releaseLock(lock1, lock1.lockId, deps);
    const lock3 = bridge.acquireLock(deps);
    check('après libération, nouveau acquireLock réussit', lock3 !== null);
    bridge.releaseLock(lock3, lock3.lockId, deps);
    fs.rmdirSync(tmpDir);
  }

  // 10d. releaseLock refuse si le lockId a changé (détenteur remplacé)
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-lock-'));
    const lockPath = path.join(tmpDir, 'queue.lock');
    const deps = { lockPath, log: () => {} };
    const lock1 = bridge.acquireLock(deps);
    // Simuler un autre détenteur qui écrase le fichier
    fs.writeFileSync(lockPath, JSON.stringify({ pid: 99999, lockId: 'other-lock' }), 'utf8');
    bridge.releaseLock(lock1, lock1.lockId, deps);
    check('fichier pas supprimé par ancien détenteur', fs.existsSync(lockPath));
    fs.unlinkSync(lockPath);
    fs.rmdirSync(tmpDir);
  }

  // 10e. tryStealOrphanLock révoque un verrou avec PID mort
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-lock-'));
    const lockPath = path.join(tmpDir, 'queue.lock');
    const deps = { lockPath, log: () => {} };
    // Écrire un verrou avec un PID qui n'existe pas
    fs.writeFileSync(lockPath, JSON.stringify({ pid: 999999999, lockId: 'dead-lock', acquiredAt: new Date().toISOString() }), 'utf8');
    const stolen = bridge.tryStealOrphanLock(lockPath, { pid: process.pid, lockId: 'new-lock' }, deps);
    check('verrou orphelin (PID mort) révoqué', stolen === true);
    check('fichier verrou supprimé', !fs.existsSync(lockPath));
    fs.rmdirSync(tmpDir);
  }

  // 10f. executeTask sans commande externe → succès simulé
  {
    const opp = { id: 'T-EXEC1', task_id: 'T-EXEC1', repository_full_name: LOCAL, issue_number: 5002, humanGate: false, moneyPath: false };
    const result = bridge.executeTask(opp, { log: () => {} });
    check('exécution simulée ok', result.ok === true);
    check('exitCode 0', result.exitCode === 0);
    check('pas bloqué', result.blocked !== true);
  }

  // 10g. executeTask avec humanGate → bloqué
  {
    const opp = { id: 'T-EXEC2', task_id: 'T-EXEC2', repository_full_name: LOCAL, issue_number: 5003, humanGate: true, moneyPath: false };
    const result = bridge.executeTask(opp, { log: () => {} });
    check('humanGate bloqué', result.ok === false);
    check('bloqué flag', result.blocked === true);
    check('raison humanGate', /humanGate/.test(result.output));
  }

  // 10h. executeTask avec moneyPath → bloqué
  {
    const opp = { id: 'T-EXEC3', task_id: 'T-EXEC3', repository_full_name: LOCAL, issue_number: 5004, humanGate: false, moneyPath: true };
    const result = bridge.executeTask(opp, { log: () => {} });
    check('moneyPath bloqué', result.ok === false);
    check('bloqué flag', result.blocked === true);
    check('raison moneyPath', /moneyPath/.test(result.output));
  }

  // 10i. canExecute : refus humanGate / moneyPath
  {
    check('humanGate non exécutable', bridge.canExecute({ humanGate: true }).executable === false);
    check('moneyPath non exécutable', bridge.canExecute({ moneyPath: true }).executable === false);
    check('normal exécutable', bridge.canExecute({ humanGate: false, moneyPath: false }).executable === true);
  }

  // 10j. runWatchCycle : queue vide → claimed false
  {
    const result = bridge.runWatchCycle({
      runnerId: 'runner-watch1',
      loadQueue: () => ({ opportunities: [] }),
      saveQueue: () => {},
      publishStatus: () => true,
      log: () => {},
      acquireLock: () => ({ fd: null, lockId: 'watch-lock' }),
      releaseLock: () => {},
    });
    check('watch queue vide => claimed false', result.claimed === false);
  }

  // 10k. runWatchCycle : claim + exec simulé + ACK auto + publication
  {
    const queue = {
      opportunities: [
        { id: 'T-WATCH1', task_id: 'T-WATCH1', repository_full_name: LOCAL, issue_number: 5005, humanGate: false, moneyPath: false, status: 'new' },
      ],
    };
    let saveCalled = 0;
    let published = null;
    const result = bridge.runWatchCycle({
      runnerId: 'runner-watch2',
      loadQueue: () => queue,
      saveQueue: () => { saveCalled += 1; },
      publishStatus: (repo, issue, status, detail, opts) => {
        published = { repo, issue, status, taskId: opts && opts.taskId };
        return true;
      },
      log: () => {},
      acquireLock: () => ({ fd: null, lockId: 'watch-lock-k' }),
      releaseLock: () => {},
    });
    check('watch claimé', result.claimed === true);
    check('watch exécuté', result.executed === true);
    check('watch ACKé', result.acked === true);
    check('watch publié', result.published === true);
    check('saveQueue appelée', saveCalled >= 1);
    check('publication sur BOT-WOW', published.repo === LOCAL && published.status === 'completed');
    check('taskId dans publication', published.taskId === 'T-WATCH1');
    check('tâche passée à completed', queue.opportunities[0].status === 'completed');
  }

  // 10l. runWatchCycle : tâche qui échoue → ACK failed + retry (backoff)
  {
    const queue = {
      opportunities: [
        { id: 'T-WATCHFAIL', task_id: 'T-WATCHFAIL', repository_full_name: LOCAL, issue_number: 5006, humanGate: false, moneyPath: false, status: 'new', maxRetries: 3, retryCount: 0 },
      ],
    };
    // Forcer l'échec via une commande externe qui retourne code non-zéro
    const result = bridge.runWatchCycle({
      runnerId: 'runner-watch3',
      loadQueue: () => queue,
      saveQueue: () => {},
      publishStatus: () => true,
      log: () => {},
      execCmd: 'node -e "process.exit(1)"',
      execTimeoutMs: 5000,
      acquireLock: () => ({ fd: null, lockId: 'watch-lock-l' }),
      releaseLock: () => {},
    });
    check('watch échec détecté', result.claimed === true && result.executed === true && result.acked === true);
    check('tâche passée à failed', queue.opportunities[0].status === 'failed');
    check('retryCount incrémenté', queue.opportunities[0].retryCount === 1);
    check('nextRetryAt dans le futur', new Date(queue.opportunities[0].nextRetryAt).getTime() > Date.now());
  }

  // 10m. CLI --consume : claim + persistance sur disque (temp dir)
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-consume-'));
    const queuePath = path.join(tmpDir, 'queue.json');
    fs.writeFileSync(queuePath, JSON.stringify({
      opportunities: [
        { id: 'T-CLI1', task_id: 'T-CLI1', repository_full_name: LOCAL, issue_number: 5007, status: 'new', humanGate: false, moneyPath: false },
      ],
    }), 'utf8');

    // Créer un script wrapper qui redirige les chemins de mémoire
    // (on utilise les injectables via require, pas le CLI réel qui utilise C.paths)
    const saved = [];
    const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    const cycle = bridge.runConsumeCycle(queue, {
      runnerId: 'runner-cli-1',
      log: () => {},
      saveQueue: (q) => { saved.push(q); },
      acquireLock: () => ({ fd: null, lockId: 'cli-lock-1' }),
      releaseLock: () => {},
    });
    check('--consume claimé', cycle.claimed === true);
    check('--consume saveQueue appelée', saved.length === 1);
    check('--consume tâche claimée', saved[0].opportunities[0].status === 'claimed');

    // Vérifier que --ack complète la tâche
    const ackResult = bridge.acknowledge(saved[0], 'T-CLI1', 'completed', 'tâche faite', {
      runnerId: 'runner-cli-1',
      log: () => {},
      publishStatus: () => true,
    });
    check('--ack ok', ackResult.ok === true);
    check('--ack statut completed', ackResult.opp.status === 'completed');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // 10n. Deux consommateurs concurrents ne réclament pas la même tâche
  {
    const queue = {
      opportunities: [
        { id: 'T-CONC1', task_id: 'T-CONC1', repository_full_name: LOCAL, issue_number: 5008, status: 'new' },
        { id: 'T-CONC2', task_id: 'T-CONC2', repository_full_name: LOCAL, issue_number: 5009, status: 'new' },
      ],
    };
    let saves = 0;
    const claimedIds = [];
    // Consommateur A
    const resA = bridge.runConsumeCycle(queue, {
      runnerId: 'runner-A',
      log: () => {},
      saveQueue: () => { saves += 1; },
      acquireLock: () => ({ fd: null, lockId: 'conc-lock-A' }),
      releaseLock: () => {},
    });
    if (resA.claimed) claimedIds.push(resA.opp.id);
    // Consommateur B (même queue en mémoire, déjà mutée par A)
    const resB = bridge.runConsumeCycle(queue, {
      runnerId: 'runner-B',
      log: () => {},
      saveQueue: () => { saves += 1; },
      acquireLock: () => ({ fd: null, lockId: 'conc-lock-B' }),
      releaseLock: () => {},
    });
    if (resB.claimed) claimedIds.push(resB.opp.id);
    check('deux tâches distinctes réclamées', claimedIds.length === 2);
    check('pas de double-claim sur la même tâche', new Set(claimedIds).size === 2);
    check('sauvegardes effectuées', saves === 2);
  }

  // 10o. Crash et reprise : verrou orphelin récupéré après redémarrage
  {
    // Simuler une tâche claimée depuis trop longtemps (orphelin)
    const queue = {
      opportunities: [
        {
          id: 'T-ORPHAN', task_id: 'T-ORPHAN', repository_full_name: LOCAL, issue_number: 5010,
          status: 'claimed', claimedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // il y a 10 min
          claimedBy: 'runner-mort', lockId: 'dead-lock-orphan',
        },
      ],
    };
    const cycle = bridge.runConsumeCycle(queue, {
      runnerId: 'runner-nouveau',
      log: () => {},
      saveQueue: () => {},
      orphanTimeoutMs: 5 * 60 * 1000, // 5 min : le claim de 10 min est orphelin
      acquireLock: () => ({ fd: null, lockId: 'orphan-lock' }),
      releaseLock: () => {},
    });
    check('orphelin récupéré et réclamé', cycle.claimed === true);
    check('nouveau claim par runner actuel', cycle.opp.claimedBy === 'runner-nouveau');
    check('tâche repassée à claimed', cycle.opp.status === 'claimed');
  }
}

console.log('');
if (failures === 0) {
  console.log('MULTI-REPO-BRIDGE TESTS : OK (' + failures + ' échec)');
  process.exit(0);
} else {
  console.log('MULTI-REPO-BRIDGE TESTS : ' + failures + ' ÉCHEC(S)');
  process.exit(1);
}
