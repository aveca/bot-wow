#!/usr/bin/env node
/**
 * multi-repo-bridge.cjs — extension multi-dépôt du pont ChatGPT/autopilot.
 *
 * PORT BOT-WOW depuis `aveca/sargagame` (PR #1349, merge commit
 * `87702066a79c03ff930500a2bad524df58c1f6f7`), fichier
 * `scripts/autopilot/multi-repo-bridge.cjs`.
 *
 * Le CONTRAT est repris à l'identique (allowlist fermée, routage strict par
 * dépôt local, déduplication dépôt/issue/task_id, statuts GitHub corrélés,
 * blocage humanGate/moneyPath, aucun runner cloud). Trois adaptations sont
 * nécessaires pour BOT-WOW et sont listées ci-dessous :
 *   1. `DEFAULT_LOCAL_REPO` vaut `aveca/bot-wow` (jamais `aveca/sargagame`) :
 *      un repli silencieux vers Sargagame exécuterait chez nous des missions
 *      qui ne sont pas les nôtres ;
 *   2. le repli est JOURNALISÉ (le dépôt local retenu est visible) ;
 *   3. les dépendances `./lib/common.cjs` et `./lib/memory.cjs` sont portées
 *      en local, en sous-ensemble strict de ce que le pont utilise ;
 *   4. la création des dossiers de mémoire est injectable (`ensureDirs`) pour
 *      que les tests n'écrivent aucun dossier dans le dépôt : le comportement
 *      en production est inchangé (les dossiers sont créés en mode réel).
 *   5. la publication de statuts sur le dépôt distant est DÉSACTIVÉE
 *      en permanence : aveca/sargagame reste en LECTURE SEULE pour BOT-WOW.
 *      Une mission distante est journalisée mais jamais enfilée dans la queue
 *      locale ni publiée sur l'autre dépôt.
 *
 * Dans `aveca/sargagame`, ce module étend `scripts/autopilot/bridge.cjs` du
 * runner Factory V3. BOT-WOW n'a pas de `bridge.cjs` local : ce module EST le
 * pont multi-dépôt du runner BOT-WOW. La déduplication conserve malgré tout la
 * clé historique de `bridge.cjs`, pour rester compatible avec l'autre dépôt.
 *
 * Le CONTRAT du port Sargagame est repris à l'identique :
 *
 *   - une ALLOWLIST stricte : tout autre dépôt est rejeté, jamais exécuté ;
 *   - un ROUTAGE strict : une mission aveca/sargagame reste dans Sargagame.
 *     Elle n'est JAMAIS enfilée dans la queue locale BOT-WOW et aucun statut
 *     ou commentaire n'est publié sur l'issue distante (lecture seule) ;
 *   - une IDEMPOTENCE par dépôt + issue + task_id, compatible avec la clé
 *     existante de bridge.cjs pour qu'aucune tâche ne soit importée deux fois ;
 *   - des STATUTS GitHub corrélés : imported / started / heartbeat / blocked /
 *     completed / failed, publiés uniquement sur les issues BOT-WOW ; aucune
 *     écriture n'est faite sur les issues Sargagame.
 *
 * AUCUN nouveau runner, AUCUNE API LLM payante, AUCUN runner dans le cloud :
 * ce module est une CLI du runner Factory V3 existant.
 *
 * Contrat obligatoire de chaque tâche importée :
 *   repository_full_name, issue_number, task_id, priority, source, mode,
 *   humanGate, moneyPath, acceptance, rollback.
 *
 * Compatibilité : les missions publiées avant l'introduction du contrat complet
 * ne portent que `id` (cf. #1336, #1337). Elles restent acceptées, mais le
 * contrat est vérifié champ par champ et les champs manquants sont signalés
 * dans le rapport (jamais silencieusement complétés).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const C = require('./lib/common.cjs');
const mem = require('./lib/memory.cjs');

/** Dépôts autorisés. Liste fermée : aucun autre dépôt n'est jamais lu. */
const ALLOWED_REPOS = ['aveca/bot-wow', 'aveca/sargagame'];

/**
 * Dépôt de repli uniquement lorsque le répertoire n'est PAS un checkout Git.
 * Dans un checkout Git, un remote absent, illisible ou hors allowlist bloque
 * explicitement : le dépôt local n'est jamais deviné.
 */
const DEFAULT_LOCAL_REPO = 'aveca/bot-wow';

const FENCE = String.fromCharCode(96).repeat(3);
const AUTOPILOT_PREFIX = '[AUTOPILOT]';
const PRIORITY = { critical: 'critical', high: 'high', medium: 'medium', low: 'low' };
const CONFIDENCE = new Set(['proven', 'observed', 'inferred']);

const STATUSES = ['imported', 'started', 'heartbeat', 'blocked', 'completed', 'failed'];
const CONSUMPTION_STATUSES = ['new', 'claimed', 'completed', 'failed', 'quarantined'];
const STATUS_EMOJI = {
  imported: '📥',
  started: '🔄',
  heartbeat: '❤️',
  blocked: '🚫',
  completed: '✅',
  failed: '❌',
  new: '🆕',
  claimed: '🔒',
  quarantined: '🗄️',
};

/** Consommation de la queue : paramètres par défaut. */
const DEFAULT_MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 5000;      // 5 s
const BACKOFF_MULTIPLIER = 3;      // ×3 à chaque échec (5s, 15s, 45s…)
const DEFAULT_ORPHAN_TIMEOUT_MS = 30 * 60 * 1000; // 30 min : verrou orphelin si pas de heartbeat

/** Champs ajoutés au schéma d'opportunité par la consommation. */
const CONSUMPTION_FIELDS = [
  'status', 'claimedAt', 'claimedBy', 'lockId', 'retryCount', 'maxRetries',
  'backoffMs', 'nextRetryAt', 'quarantinedAt', 'quarantineReason',
  'completedAt', 'failedAt', 'error', 'ackDetail',
];

/** Champs exigés par le contrat de mission. */
const REQUIRED_CONTRACT = [
  'repository_full_name',
  'issue_number',
  'task_id',
  'priority',
  'source',
  'mode',
  'humanGate',
  'moneyPath',
  'acceptance',
  'rollback',
];

// ── gh ───────────────────────────────────────────────────────────────────────

/**
 * Exécute `gh`. La résolution d'exécutable est identique à bridge.cjs :
 * chemin primaire sous Windows, `gh` du PATH en repli.
 */
function gh(args, cwd = C.ROOT) {
  const isWin = process.platform === 'win32';
  const primary = isWin ? 'C:\\Program Files\\GitHub CLI\\gh.exe' : '/usr/local/bin/gh';
  const fallback = isWin ? 'gh.exe' : 'gh';

  try {
    return execFileSync(primary, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
      windowsHide: true,
    }).trim();
  } catch (primaryError) {
    try {
      return execFileSync(fallback, args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60000,
        windowsHide: true,
      }).trim();
    } catch (fallbackError) {
      console.log(`[bridge] gh primary (${primary}) failed: ${primaryError.message}.`);
      console.log(`[bridge] gh fallback (${fallback}) also failed: ${fallbackError.message}`);
      throw primaryError;
    }
  }
}

// ── Dépôt local ──────────────────────────────────────────────────────────────

/**
 * Dépôt de ce checkout. C'est lui qui décide de l'exécution : une mission
 * d'un AUTRE dépôt autorisé est relayée, pas exécutée ici.
 */
function detectLocalRepo(cwd = C.ROOT, deps = {}) {
  const overrideRaw = process.env.AUTOPILOT_LOCAL_REPO;
  const override = overrideRaw === undefined ? '' : String(overrideRaw).trim().toLowerCase();
  if (override && !isAllowedRepo(override)) {
    throw new Error(`AUTOPILOT_LOCAL_REPO hors allowlist : ${override}`);
  }
  if (override && override !== DEFAULT_LOCAL_REPO) {
    throw new Error(`AUTOPILOT_LOCAL_REPO doit désigner BOT-WOW, pas ${override}`);
  }

  const isGitWorktree = deps.isGitWorktree || ((dir) =>
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
      windowsHide: true,
    }).trim() === 'true');

  let inWorktree = false;
  try {
    inWorktree = isGitWorktree(cwd) === true;
  } catch (e) {
    const detail = String(e && (e.stderr || e.message) || e);
    if (/not a git repository|must be run in a work tree/i.test(detail)) {
      inWorktree = false;
    } else {
      throw new Error(`détection du checkout Git impossible : ${detail}`);
    }
  }

  if (!inWorktree) {
    if (override) return override;
    console.log(`[bridge] aucun checkout Git détecté : dépôt local par défaut ${DEFAULT_LOCAL_REPO}`);
    return DEFAULT_LOCAL_REPO;
  }

  const getOrigin = deps.getOrigin || ((dir) =>
    execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
      windowsHide: true,
    }).trim());

  let url;
  try {
    url = String(getOrigin(cwd) || '').trim();
  } catch (e) {
    throw new Error(`remote origin illisible dans un checkout Git : ${e.message}`);
  }
  if (!url) throw new Error('remote origin absent dans un checkout Git : détection du dépôt refusée');

  let full;
  const ssh = url.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (ssh) {
    full = `${ssh[1]}/${ssh[2]}`;
  } else {
    let parsed;
    try { parsed = new URL(url); } catch (_) {
      throw new Error(`remote origin non reconnu : ${url}`);
    }
    if (parsed.hostname.toLowerCase() !== 'github.com') {
      throw new Error(`hôte remote origin non autorisé : ${parsed.hostname}`);
    }
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length !== 2) throw new Error(`remote origin GitHub invalide : ${url}`);
    full = `${parts[0]}/${parts[1].replace(/\.git$/i, '')}`;
  }

  full = full.toLowerCase();
  if (!isAllowedRepo(full)) throw new Error(`remote origin hors allowlist : ${full}`);
  if (full !== DEFAULT_LOCAL_REPO) {
    throw new Error(`remote origin ne correspond pas au checkout BOT-WOW : ${full}`);
  }
  if (override && override !== full) {
    throw new Error(`AUTOPILOT_LOCAL_REPO ne correspond pas au remote origin : ${override} != ${full}`);
  }
  return full;
}

// ── Contrat ──────────────────────────────────────────────────────────────────

/** Un dépôt est-il dans l'allowlist ? */
function isAllowedRepo(repoFullName) {
  return ALLOWED_REPOS.includes(String(repoFullName));
}

/**
 * Vérifie le contrat de mission.
 * `legacy` = la tâche ne porte pas encore le contrat complet (missions
 * publiées avant son introduction) : elle reste recevable, mais l'écart est
 * reporté au lieu d'être silencieusement comblé.
 */
function requiredContract(task) {
  const missing = [];
  for (const field of REQUIRED_CONTRACT) {
    if (task[field] === undefined || task[field] === null || task[field] === '') missing.push(field);
  }
  return { ok: missing.length === 0, missing, legacy: missing.length > 0 };
}

/** Identifiant de tâche : `task_id` (contrat) ou `id` (format historique). */
function taskIdOf(task) {
  return String(task.task_id || task.id || '').trim();
}

// ── Clés de déduplication ────────────────────────────────────────────────────

/**
 * Clé canonique : dépôt + issue + task_id.
 * Elle est qualifiée par le dépôt, donc deux missions homonymes dans deux
 * dépôts distincts ne se confondent jamais.
 */
function fingerprint(repoFullName, issueNumber, taskId) {
  return `chatgpt-issue|${repoFullName}|${issueNumber}|${taskId}`;
}

/**
 * Clé historique produite par bridge.cjs : issue + task_id, sans dépôt.
 * Elle est reconnue à la déduplication pour que le pont multi-dépôt ne
 * réimporte jamais une tâche déjà importée par bridge.cjs (et inversement).
 */
function legacyFingerprint(issueNumber, taskId) {
  return `chatgpt-issue|${issueNumber}|${taskId}`;
}

/**
 * Index de ce qui est DÉJÀ connu dans la queue locale.
 * On indexe la clé canonique, la clé historique ET l'id de tâche : la
 * déduplication de bridge.cjs porte sur l'id, il faut donc couvrir les trois
 * espaces de clés pour garantir l'idempotence.
 */
function buildKnownIndex(queue) {
  const fingerprints = new Set();
  const ids = new Set();
  for (const o of (queue && queue.opportunities) || []) {
    if (o.fingerprint) fingerprints.add(String(o.fingerprint));
    if (o.id) ids.add(String(o.id));
    const legacy = o.fingerprint && String(o.fingerprint).indexOf('|') !== -1
      ? String(o.fingerprint).split('|').slice(1).join('|')
      : null;
    if (legacy) fingerprints.add(legacy);
  }
  return { fingerprints, ids };
}

/** Cette tâche est-elle déjà connue ? */
function isAlreadyKnown(known, repoFullName, issueNumber, taskId) {
  return (
    known.fingerprints.has(fingerprint(repoFullName, issueNumber, taskId)) ||
    known.fingerprints.has(legacyFingerprint(issueNumber, taskId)) ||
    known.ids.has(String(taskId))
  );
}

// ── Lecture GitHub ───────────────────────────────────────────────────────────

/** Issues ouvertes `[AUTOPILOT]` d'un dépôt donné. */
function loadOpenAutopilotIssuesForRepo(repoFullName, ghFn = gh) {
  const out = ghFn([
    'issue', 'list',
    '--repo', repoFullName,
    '--state', 'open',
    '--limit', '100',
    '--json', 'number,title,body,url,createdAt',
  ]);
  const issues = JSON.parse(out || '[]');
  return issues.filter((i) => String(i.title || '').startsWith(AUTOPILOT_PREFIX));
}

/** Extrait le bloc JSON `AUTOPILOT_TASK` du corps d'issue. */
function extractTask(body = '') {
  const markerAt = body.indexOf('AUTOPILOT_TASK');
  const from = markerAt >= 0 ? markerAt : 0;
  const start = body.indexOf(FENCE + 'json', from);
  if (start < 0) return null;
  const contentStart = start + (FENCE + 'json').length;
  const end = body.indexOf(FENCE, contentStart);
  if (end < 0) return null;
  try {
    const task = JSON.parse(body.slice(contentStart, end).trim());
    if (!task || typeof task !== 'object') return null;
    if (!taskIdOf(task) || !task.title || !['agent', 'auto'].includes(task.mode)) return null;
    return task;
  } catch (_) {
    return null;
  }
}

function normalizeFiles(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => String(v || '').trim()).filter(Boolean))];
}

function priorityToSeverity(value) {
  return PRIORITY[String(value || '').toLowerCase()] || 'medium';
}

// ── Conversion en opportunité ────────────────────────────────────────────────

/**
 * Construit l'opportunité, ou un motif de rejet.
 *
 * Rejets (jamais d'import partiel) :
 *   - dépôt hors allowlist ;
 *   - dépôt déclaré dans la tâche différent du dépôt qui héberge l'issue
 *     (une mission ne peut pas prétendre appartenir à un autre dépôt) ;
 *   - identifiant de tâche absent.
 */
function toOpportunity(task, issue, repoFullName) {
  if (!isAllowedRepo(repoFullName)) {
    return { rejected: true, reason: 'repository_not_allowed: ' + repoFullName };
  }

  const declaredRepo = task.repository_full_name ? String(task.repository_full_name) : null;
  if (declaredRepo && declaredRepo !== repoFullName) {
    return {
      rejected: true,
      reason: `repository_mismatch: issue=${repoFullName} task=${declaredRepo}`,
    };
  }

  const taskId = taskIdOf(task);
  if (!taskId) return { rejected: true, reason: 'missing_task_id' };

  const contract = requiredContract(task);
  const humanGate = Boolean(task.humanGate || task.moneyPath);
  const hasRecipe = Boolean(task.recipe);
  let actionable = 'agent';
  if (humanGate) actionable = 'human';
  else if (task.mode === 'auto' && hasRecipe) actionable = 'auto';

  const issueNumber = Number(issue.number);
  const issueRef = {
    number: issueNumber,
    url: issue.url || null,
    title: issue.title || null,
    repository_full_name: repoFullName,
  };

  const result = {
    id: taskId,
    fingerprint: fingerprint(repoFullName, issueNumber, taskId),
    legacyFingerprint: legacyFingerprint(issueNumber, taskId),
    title: String(task.title),
    repository_full_name: repoFullName,
    issue_number: issueNumber,
    source: `${String(task.source || 'chatgpt')} issue #${issueNumber} (${repoFullName})`,
    severity: priorityToSeverity(task.priority),
    confidence: CONFIDENCE.has(task.confidence) ? task.confidence : 'observed',
    actionable,
    evidence: String(task.evidence || task.diagnostic || 'n/a'),
    rollback: String(task.rollback || 'revert du commit'),
    expectedImpact: String(task.metric || task.expectedImpact || 'n/a'),
    status: 'new',
    createdAt: issue.createdAt || C.nowIso(),
    scope: { files: normalizeFiles(task.filesToModify) },
    contract: { ok: contract.ok, missing: contract.missing },
    sourceIssue: issueRef,
    acceptance: task.acceptance || 'n/a',
    task: {
      ...task,
      task_id: taskId,
      repository_full_name: repoFullName,
      issue_number: issueNumber,
      filesToRead: normalizeFiles(task.filesToRead),
      filesToModify: normalizeFiles(task.filesToModify),
      humanGate,
    },
  };

  // Initialiser les champs de consommation (état 'new', sans verrou).
  initConsumptionFields(result);
  return result;
}

// ── Statuts GitHub ───────────────────────────────────────────────────────────

/**
 * Publie un statut corrélé sur l'issue de la mission.
 * Retourne true si le commentaire a bien été publié.
 * Une erreur de publication est SIGNALÉE (log + retour false) : elle ne doit
 * jamais disparaître silencieusement.
 */
function publishStatus(repoFullName, issueNumber, status, details = '', options = {}) {
  if (!STATUSES.includes(status)) {
    throw new Error(`statut inconnu: ${status} (attendu: ${STATUSES.join(', ')})`);
  }
  if (repoFullName !== 'aveca/bot-wow') {
    throw new Error(`publication distante interdite par la politique BOT-WOW : ${repoFullName}`);
  }
  const ghFn = options.gh || gh;
  const body = [
    `${STATUS_EMOJI[status]} Autopilot multi-repo — statut : **${status}**`,
    '',
    `- dépôt : ${repoFullName}`,
    `- issue : #${issueNumber}`,
    `- task ID : ${options.taskId || 'n/a'}`,
    options.fingerprint ? `- clé : ${options.fingerprint}` : '',
    details ? `- détail : ${details}` : '',
    '',
    '_Statut publié par multi-repo-bridge.cjs. Aucune intervention manuelle n’est requise pour ce statut._',
  ].filter(Boolean).join('\n');
  try {
    ghFn(['issue', 'comment', String(issueNumber), '--repo', repoFullName, '--body', body]);
    return true;
  } catch (e) {
    console.log(`[bridge] publication du statut "${status}" impossible sur ${repoFullName}#${issueNumber}: ${e.message}`);
    return false;
  }
}

// ── Ingestion ────────────────────────────────────────────────────────────────

/**
 * Ingestion multi-dépôt.
 *
 * @param {object}   options
 * @param {boolean}  options.dry                aucune écriture, aucun statut
 * @param {function} options.log
 * @param {function} options.gh                 injecté dans les tests
 * @param {string}   options.localRepo          dépôt de ce checkout
 * @param {function} options.loadIssues         (repo) => issues[]
 * @param {object}   options.queue              queue injectée (tests)
 * @param {function} options.saveQueue
 * @param {function} options.writeOpportunityFile
 * @param {function} options.publishStatus
 * @param {function} options.ensureDirs         (tests) : création des dossiers
 * @param {boolean}  options.relayStatus        ignoré : BOT-WOW ne publie
 *                                                 jamais sur le dépôt distant
 */
function ingestMultiRepo(options = {}) {
  const dry = options.dry === true;
  const log = options.log || console.log;
  const ghFn = options.gh || gh;
  const localRepo = options.localRepo || detectLocalRepo();
  if (localRepo !== DEFAULT_LOCAL_REPO) {
    throw new Error(`ce bridge BOT-WOW ne peut tourner que dans ${DEFAULT_LOCAL_REPO} (reçu: ${localRepo})`);
  }
  const loadIssues = options.loadIssues || ((repo) => loadOpenAutopilotIssuesForRepo(repo, ghFn));
  const publish = options.publishStatus || publishStatus;
  const loadQueue = options.loadQueue || mem.loadQueue;
  const saveQueue = options.saveQueue || mem.saveQueue;
  const writeOppFile = options.writeOpportunityFile || mem.writeOpportunityFile;
  const ensureDirs = options.ensureDirs || C.ensureDirs;
  // BOT-WOW traite toujours le dépôt distant en lecture seule. L'option
  // historique est ignorée : aucune exécution ne peut publier sur Sargagame.
  const relayStatus = false;

  if (!dry) ensureDirs();

  const queue = options.queue || loadQueue();
  queue.opportunities = queue.opportunities || [];
  const known = buildKnownIndex(queue);

  let imported = 0;
  let wouldImport = 0;
  let relayed = 0;
  let wouldRelay = 0;
  let ignored = 0;
  let rejected = 0;
  let statusFailures = 0;
  const perRepo = {};
  const relayedTasks = [];
  const importedTasks = [];
  const wouldImportTasks = [];

  for (const repoFullName of ALLOWED_REPOS) {
    perRepo[repoFullName] = { issues: 0, imported: 0, wouldImport: 0, relayed: 0, wouldRelay: 0, ignored: 0, rejected: 0 };

    let issues;
    try {
      issues = loadIssues(repoFullName);
    } catch (e) {
      log(`[bridge] dépôt inaccessible ${repoFullName}: ${e.message}`);
      perRepo[repoFullName].rejected += 1;
      rejected += 1;
      continue;
    }
    perRepo[repoFullName].issues = issues.length;

    for (const issue of issues) {
      const task = extractTask(issue.body || '');
      if (!task) {
        ignored += 1;
        perRepo[repoFullName].ignored += 1;
        log(`[bridge] ${repoFullName} issue #${issue.number} ignorée : AUTOPILOT_TASK invalide/absent`);
        continue;
      }

      const opp = toOpportunity(task, issue, repoFullName);
      if (opp.rejected) {
        rejected += 1;
        perRepo[repoFullName].rejected += 1;
        log(`[bridge] ${repoFullName} issue #${issue.number} rejetée : ${opp.reason}`);
        continue;
      }

      if (isAlreadyKnown(known, repoFullName, opp.issue_number, opp.id)) {
        ignored += 1;
        perRepo[repoFullName].ignored += 1;
        continue;
      }

      // ── Routage strict ───────────────────────────────────────────────────
      // Une mission d'un dépôt autorisé qui n'est pas CE dépôt est RELAYÉE :
      // elle reste chez son dépôt d'origine. Elle n'est jamais enfilée dans
      // la queue locale, donc jamais exécutée par ce runner.
      const isLocal = repoFullName === localRepo;
      if (!isLocal) {
        wouldRelay += 1;
        perRepo[repoFullName].wouldRelay += 1;
        known.fingerprints.add(opp.fingerprint);
        known.ids.add(opp.id);
        relayedTasks.push({ repo: repoFullName, issue: opp.issue_number, taskId: opp.id });
        log(`[bridge] relay ${repoFullName} #${opp.issue_number} → ${opp.id} (reste dans ${repoFullName})`);
        if (!dry) {
          relayed += 1;
          perRepo[repoFullName].relayed += 1;
          if (!relayStatus) {
            log(`[bridge] relay ${repoFullName} #${opp.issue_number} → ${opp.id} : statut NON publié (dépôt distant en lecture seule)`);
            continue;
          }
          const ok = publish(
            repoFullName,
            opp.issue_number,
            'imported',
            `mission relayée vers ${repoFullName} (non exécutée ici)`,
            { taskId: opp.id, fingerprint: opp.fingerprint, gh: ghFn },
          );
          if (!ok) statusFailures += 1;
        }
        continue;
      }

      // ── Tâche locale ─────────────────────────────────────────────────────
      if (opp.actionable === 'human') {
        ignored += 1;
        perRepo[repoFullName].ignored += 1;
        log(`[bridge] HUMAN ${repoFullName} #${opp.issue_number} ${opp.id} laissée dans GitHub`);
        if (!dry) {
          const ok = publish(
            repoFullName,
            opp.issue_number,
            'blocked',
            'humanGate/moneyPath : exécution automatique interdite',
            { taskId: opp.id, fingerprint: opp.fingerprint, gh: ghFn },
          );
          if (!ok) statusFailures += 1;
        }
        continue;
      }

      // Un dry-run ne mute JAMAIS la queue : il annonce ce qui serait fait.
      wouldImport += 1;
      perRepo[repoFullName].wouldImport += 1;
      known.fingerprints.add(opp.fingerprint);
      known.ids.add(opp.id);
      wouldImportTasks.push({ repo: repoFullName, issue: opp.issue_number, taskId: opp.id });
      log(`[bridge] ${dry ? 'would import' : 'import'} ${repoFullName} #${opp.issue_number} → ${opp.id} (${opp.actionable})`);

      if (!dry) {
        queue.opportunities.push(opp);
        imported += 1;
        perRepo[repoFullName].imported += 1;
        importedTasks.push({ repo: repoFullName, issue: opp.issue_number, taskId: opp.id });
        writeOppFile(opp);
        const ok = publish(
          repoFullName,
          opp.issue_number,
          'imported',
          `opportunité ${opp.id} (${opp.actionable})`,
          { taskId: opp.id, fingerprint: opp.fingerprint, gh: ghFn },
        );
        if (!ok) statusFailures += 1;
      }
    }
  }

  if (imported && !dry) saveQueue(queue);

  return {
    imported,
    wouldImport,
    relayed,
    wouldRelay,
    ignored,
    rejected,
    statusFailures,
    perRepo,
    relayedTasks,
    importedTasks,
    wouldImportTasks,
    localRepo,
  };
}

// ── Initialisation des champs de consommation ────────────────────────────────

/**
 * Ajoute les champs de consommation à une opportunité fraîchement importée.
 * Les champs sont initialisés à l'état 'new' : non réclamée, sans verrou,
 * sans tentative de retry.
 */
function initConsumptionFields(opp) {
  opp.status = 'new';
  opp.maxRetries = opp.maxRetries || DEFAULT_MAX_RETRIES;
  opp.retryCount = 0;
  for (const f of CONSUMPTION_FIELDS) {
    if (opp[f] === undefined) opp[f] = null;
  }
  return opp;
}

// ── Consommation de la queue ───────────────────────────────────────────────

/**
 * Génère un identifiant de verrou unique pour une réclamation.
 */
function makeLockId() {
  return `lock_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

/**
 * Calcule le backoff exponentiel pour une tentative de retry.
 * retryCount 1 → 5s, 2 → 15s, 3 → 45s, ...
 */
function computeBackoffMs(retryCount) {
  return BASE_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, retryCount - 1);
}

/**
 * Réclame atomiquement la prochaine opportunité exécutable.
 *
 * Règles de sélection (par ordre dans le tableau) :
 *   1. status === 'new' (jamais réclamée) ;
 *   2. status === 'failed' avec retryCount < maxRetries et nextRetryAt <= maintenant (retry dû).
 *
 * Marque l'opportunité comme 'claimed' avec un verrou, un timestamp et un
 * identifiant de runner. Retourne { opp, lockId } ou null si rien à réclamer.
 *
 * @param {object} queue           queue en mémoire (mutée)
 * @param {object} deps            dépendances injectables (runnerId, orphanTimeoutMs, logPath)
 * @returns {object|null}
 */
function claimNext(queue, deps = {}) {
  const opportunities = queue.opportunities || [];
  const now = Date.now();
  const runnerId = deps.runnerId || `runner-${process.pid}`;

  // 1. Récupération des verrous orphelins (claimés mais jamais ACK depuis trop longtemps)
  recoverOrphanedLocks(queue, deps);

  // 2. Sélection de la prochaine opportunité réclamable
  for (const opp of opportunities) {
    if (opp.status === 'new') {
      return doClaim(opp, runnerId, deps);
    }
    if (
      opp.status === 'failed'
      && (opp.retryCount || 0) < (opp.maxRetries || DEFAULT_MAX_RETRIES)
      && opp.nextRetryAt
      && new Date(opp.nextRetryAt).getTime() <= now
    ) {
      return doClaim(opp, runnerId, deps);
    }
  }

  return null;
}

function doClaim(opp, runnerId, deps) {
  const lockId = makeLockId();
  const nowIso = new Date().toISOString();

  opp.status = 'claimed';
  opp.claimedAt = nowIso;
  opp.claimedBy = runnerId;
  opp.lockId = lockId;

  appendRunLog(deps, `CLAIM ${opp.id} lock=${lockId} by=${runnerId}`);
  return { opp, lockId };
}

/**
 * Accuse réception de l'exécution d'une opportunité.
 *
 * @param {object} queue        queue en mémoire (mutée)
 * @param {string} taskId       ID de la tâche
 * @param {'completed'|'failed'} outcome  résultat de l'exécution
 * @param {string} details      détail du résultat (message d'erreur si failed)
 * @param {object} deps         dépendances injectables
 * @returns {object} { ok, opp?, error? }
 */
function acknowledge(queue, taskId, outcome, details, deps = {}) {
  if (outcome !== 'completed' && outcome !== 'failed') {
    return { ok: false, error: `outcome invalide: ${outcome} (attendu: completed|failed)` };
  }

  const opportunities = queue.opportunities || [];
  const idx = opportunities.findIndex((o) => o.id === taskId);
  if (idx < 0) {
    return { ok: false, error: `tâche ${taskId} introuvable en queue` };
  }

  const opp = opportunities[idx];
  if (opp.status !== 'claimed') {
    return { ok: false, error: `tâche ${taskId} n'est pas réclamée (statut: ${opp.status})` };
  }

  const nowIso = new Date().toISOString();
  const maxRetries = opp.maxRetries || DEFAULT_MAX_RETRIES;

  if (outcome === 'completed') {
    opp.status = 'completed';
    opp.completedAt = nowIso;
    opp.ackDetail = details || '';
    delete opp.error;
    delete opp.nextRetryAt;
    appendRunLog(deps, `ACK ${taskId} completed detail=${details || '(aucun)'}`);
    (deps.publishStatus || publishStatus)(
      opp.repository_full_name,
      opp.issue_number,
      'completed',
      details || 'tâche complétée',
      { taskId: opp.id, fingerprint: opp.fingerprint },
    );
  } else {
    // Échec : incrémenter le compteur de retry
    opp.retryCount = (opp.retryCount || 0) + 1;
    opp.failedAt = nowIso;
    opp.error = details || '';

    if (opp.retryCount >= maxRetries) {
      // Quarantaine définitive
      opp.status = 'quarantined';
      opp.quarantinedAt = nowIso;
      opp.quarantineReason = details || `échec après ${maxRetries} tentatives`;
      delete opp.nextRetryAt;
      appendRunLog(
        deps,
        `QUARANTINE ${taskId} après ${opp.retryCount} échecs: ${details || '(aucun)'}`,
      );
      (deps.publishStatus || publishStatus)(
        opp.repository_full_name,
        opp.issue_number,
        'failed',
        `quaranténé après ${opp.retryCount} échecs: ${details || '(aucun)'}`,
        { taskId: opp.id, fingerprint: opp.fingerprint },
      );
    } else {
      // Réessai avec backoff exponentiel
      opp.status = 'failed';
      opp.backoffMs = computeBackoffMs(opp.retryCount);
      opp.nextRetryAt = new Date(Date.now() + opp.backoffMs).toISOString();
      appendRunLog(
        deps,
        `RETRY ${taskId} tentative ${opp.retryCount}/${maxRetries} backoff=${opp.backoffMs}ms next=${opp.nextRetryAt}`,
      );
      (deps.publishStatus || publishStatus)(
        opp.repository_full_name,
        opp.issue_number,
        'failed',
        `échec tentative ${opp.retryCount}/${maxRetries}, prochain essai dans ${opp.backoffMs}ms`,
        { taskId: opp.id, fingerprint: opp.fingerprint },
      );
    }
  }

  return { ok: true, opp };
}

/**
 * Récupère les verrous orphelins : toute opportunité 'claimed' dont le
 * timestamp de réclamation dépasse orphanTimeoutMs est réinitialisée à 'new',
 * afin qu'elle puisse être réclamée à nouveau après un redémarrage du runner.
 *
 * Retourne le nombre de verrous récupérés.
 */
function recoverOrphanedLocks(queue, deps = {}) {
  const opportunities = queue.opportunities || [];
  const orphanTimeoutMs = deps.orphanTimeoutMs || DEFAULT_ORPHAN_TIMEOUT_MS;
  const now = Date.now();
  let recovered = 0;

  for (const opp of opportunities) {
    if (opp.status === 'claimed' && opp.claimedAt) {
      const claimedTime = new Date(opp.claimedAt).getTime();
      if (!isNaN(claimedTime) && now - claimedTime > orphanTimeoutMs) {
        opp.status = 'new';
        delete opp.claimedAt;
        delete opp.claimedBy;
        delete opp.lockId;
        recovered += 1;
        appendRunLog(deps, `RECOVER ${opp.id} verrou orphelin réinitialisé (claimé il y a ${Math.round((now - claimedTime) / 1000)}s)`);
      }
    }
  }

  return recovered;
}

/**
 * Met une opportunité en quarantaine manuellement (hors cycle de retry normal).
 */
function quarantineOpportunity(queue, taskId, reason, deps = {}) {
  const opportunities = queue.opportunities || [];
  const opp = opportunities.find((o) => o.id === taskId);
  if (!opp) {
    return { ok: false, error: `tâche ${taskId} introuvable en queue` };
  }

  opp.status = 'quarantined';
  opp.quarantinedAt = new Date().toISOString();
  opp.quarantineReason = reason || 'quaranténée manuellement';
  delete opp.nextRetryAt;
  appendRunLog(deps, `QUARANTINE (manuel) ${taskId}: ${reason || '(sans raison)'}`);
  (deps.publishStatus || publishStatus)(
    opp.repository_full_name,
    opp.issue_number,
    'failed',
    `quaranténé manuellement: ${reason || '(sans raison)'}`,
    { taskId: opp.id, fingerprint: opp.fingerprint },
  );
  return { ok: true, opp };
}

/**
 * Ajoute une ligne horodatée au journal de run.
 * Si `deps.log` est une fonction (tests), elle reçoit la ligne et rien n'est
 * écrit sur le disque. Sinon, écrit dans `.ai/autopilot/runs/runner.log`.
 * Échec silencieux : le journal est une aide au diagnostic, jamais bloquant.
 */
function appendRunLog(deps, message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  if (typeof deps.log === 'function') {
    deps.log(line);
    return;
  }
  const logPath = deps.logPath || C.paths.runnerLog;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, line, 'utf8');
  } catch (e) {
    console.log(`[bridge] journalisation impossible: ${e.message}`);
  }
}

/**
 * Cycle de consommation complet : récupère les orphelins, réclame la prochaine
 * opportunité, et l'affiche sur stdout au format JSON pour que le runner
 * (session OpenCode) puisse l'exécuter. Retourne { claimed: true, opp, lockId }
 * ou { claimed: false, reason: 'aucune opportunité disponible' }.
 */
function runConsumeCycle(queue, deps = {}) {
  const claimed = claimNext(queue, deps);
  if (!claimed) {
    appendRunLog(deps, 'CONSUME aucune opportunité réclamable');
    return { claimed: false, reason: 'aucune opportunité réclamable' };
  }
  appendRunLog(deps, `CONSUME ${claimed.opp.id} prête à exécuter (lock=${claimed.lockId})`);
  return { claimed: true, opp: claimed.opp, lockId: claimed.lockId };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) {
        // Forme `--clé=valeur`.
        out[a.slice(2, eq)] = a.slice(eq + 1);
        continue;
      }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        out[key] = next;
        i += 1;
      } else {
        out[key] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

/** Faux explicite : `false`, `0`, `no`, `off` (insensible à la casse). */
function isFalse(value) {
  return ['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

/**
 * Politique BOT-WOW : le dépôt distant est TOUJOURS en lecture seule.
 * Les anciens flags restent acceptés pour compatibilité, mais ne peuvent
 * jamais réactiver la publication distante.
 */
function resolveRelayStatus(args = {}) {
  const requested = args['relay-status'] !== undefined
    ? args['relay-status']
    : process.env.AUTOPILOT_RELAY_STATUS;
  if (requested !== undefined && !isFalse(requested)) {
    console.log('[bridge] publication distante interdite par la politique BOT-WOW; relayStatus=off');
  }
  return false;
}

function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);

  // ── Consommation : réclamer la prochaine opportunité ─────────────────────
  if (args.consume) {
    const queue = mem.loadQueue();
    const deps = {
      runnerId: args.runner || `runner-${process.pid}`,
      orphanTimeoutMs: args['orphan-timeout'] ? Number(args['orphan-timeout']) : undefined,
      logPath: undefined,
    };
    const result = runConsumeCycle(queue, deps);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // ── Consommation : accuser réception d'une exécution ─────────────────────
  if (args.ack) {
    const taskId = String(args.ack);
    const outcome = String(args.outcome || '').toLowerCase();
    const detail = args.detail || '';
    if (outcome !== 'completed' && outcome !== 'failed') {
      console.error(`MULTI-REPO-BRIDGE ERROR: --outcome doit être 'completed' ou 'failed' (reçu: ${outcome})`);
      process.exit(1);
    }
    const queue = mem.loadQueue();
    const ackResult = acknowledge(queue, taskId, outcome, detail, {
      runnerId: args.runner || `runner-${process.pid}`,
      logPath: undefined,
    });
    if (!ackResult.ok) {
      console.error(`MULTI-REPO-BRIDGE ERROR: ${ackResult.error}`);
      process.exit(1);
    }
    mem.saveQueue(queue);
    console.log(JSON.stringify({ ok: true, taskId, status: ackResult.opp.status, ackDetail: ackResult.opp.ackDetail || '', error: ackResult.opp.error || '', retryCount: ackResult.opp.retryCount || 0 }, null, 2));
    return;
  }

  // ── Publication d'un statut de cycle de vie ──────────────────────────────
  if (args.status) {
    const repo = String(args.repo || '');
    const issue = Number(args.issue);
    if (!isAllowedRepo(repo)) {
      console.error(`MULTI-REPO-BRIDGE ERROR: dépôt non autorisé: ${repo || '(vide)'}`);
      process.exit(1);
    }
    if (!Number.isInteger(issue) || issue <= 0) {
      console.error('MULTI-REPO-BRIDGE ERROR: --issue doit être un numéro d\'issue valide');
      process.exit(1);
    }
    const ok = publishStatus(repo, issue, String(args.status), String(args.detail || ''), {
      taskId: args.task ? String(args.task) : undefined,
      fingerprint: args.fingerprint ? String(args.fingerprint) : undefined,
    });
    console.log(`MULTI-REPO-BRIDGE STATUS · ${repo}#${issue} · ${args.status} · published=${ok}`);
    if (!ok) process.exit(1);
    return;
  }

  // ── Ingestion ────────────────────────────────────────────────────────────
  const dry = args.dry === true || args.dry === 'true';
  const relayStatus = resolveRelayStatus(args);
  const result = ingestMultiRepo({ dry, log: console.log, relayStatus });
  const imported = dry ? result.wouldImport : result.imported;
  const relayed = dry ? result.wouldRelay : result.relayed;
  console.log(
    `MULTI-REPO-BRIDGE ${dry ? 'DRY' : 'PASS'} · imported=${imported} relayed=${relayed} ` +
    `ignored=${result.ignored} rejected=${result.rejected} statusFailures=${result.statusFailures} ` +
    `local=${result.localRepo} relayStatus=${relayStatus ? 'on' : 'off'}`,
  );
  for (const [repo, stats] of Object.entries(result.perRepo)) {
    const repoImported = dry ? stats.wouldImport : stats.imported;
    const repoRelayed = dry ? stats.wouldRelay : stats.relayed;
    console.log(
      `   ${repo} : issues=${stats.issues} imported=${repoImported} relayed=${repoRelayed} ` +
      `ignored=${stats.ignored} rejected=${stats.rejected}`,
    );
  }
  if (result.statusFailures > 0) process.exit(1);
}

if (require.main === module) {
  try {
    runCli();
  } catch (e) {
    console.error('MULTI-REPO-BRIDGE ERROR: ' + e.message);
    process.exit(1);
  }
}

module.exports = {
  ALLOWED_REPOS,
  DEFAULT_LOCAL_REPO,
  REQUIRED_CONTRACT,
  STATUSES,
  CONSUMPTION_STATUSES,
  DEFAULT_MAX_RETRIES,
  detectLocalRepo,
  requiredContract,
  isAllowedRepo,
  taskIdOf,
  fingerprint,
  legacyFingerprint,
  buildKnownIndex,
  isAlreadyKnown,
  loadOpenAutopilotIssuesForRepo,
  extractTask,
  normalizeFiles,
  priorityToSeverity,
  toOpportunity,
  publishStatus,
  ingestMultiRepo,
  parseArgs,
  resolveRelayStatus,
  initConsumptionFields,
  claimNext,
  acknowledge,
  recoverOrphanedLocks,
  quarantineOpportunity,
  runConsumeCycle,
  runCli,
};
